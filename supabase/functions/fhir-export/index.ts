// BANTAY-TB outbound interoperability service.
//
// One pipeline, four steps, all of them inside this function:
//
//   1. EXTRACT     read one `public.cases` row and the barangay, DOTS facility
//                  and DOTS adherence rows that hang off it -- using the
//                  *caller's* JWT, so Row Level Security decides what this
//                  particular health worker is allowed to export.
//   2. SERIALIZE   build an HL7 FHIR R4 transaction Bundle from those rows
//                  (../_shared/fhir.ts). Nothing is stored pre-rendered; the
//                  payload is generated from live database state per request.
//   3. TRANSMIT    POST it over HTTPS to an allow-listed external endpoint,
//                  with a credential the function itself never sees in
//                  plaintext until dispatch time.
//   4. AUDIT       append the attempt, its SHA-256, its HTTP outcome and an
//                  encrypted copy of the payload to the hash-chained,
//                  append-only `public.interop_audit_log`.
//
// This is the "native backend route": the integration service is an Edge
// Function in the project's existing stack (Deno + PostgREST + Supabase),
// rather than a Mirth Connect channel. The equivalent Mirth deployment is
// described in docs/FHIR-INTEROP.md; nothing in the database layer would
// change, because an endpoint of kind 'mirth_channel' is just another row in
// `interop_endpoints`.
//
// ── Access control ───────────────────────────────────────────────────────────
// Three independent gates, because any single one is a single point of failure:
//   * the platform verifies the JWT signature before the request reaches us
//     (verify_jwt = true, see scripts/deploy-functions.mjs);
//   * the extract step runs as the caller, so RLS scopes it to the barangay or
//     facility that caller is assigned to -- a BHW cannot export a case from
//     another barangay even by guessing its UUID;
//   * every action here -- previewing, transmitting, and any identified
//     (non-pseudonymous) disclosure -- is restricted to the system
//     administrator. Every other role is refused and the refusal is logged.
// The service_role key is used for exactly two things: dispatch lookup and
// audit append. It is never used to read a case.

import { corsHeaders } from "../_shared/cors.ts";
import { buildCaseBundle, createdLocations, sha256Hex, summariseFhirResponse } from "../_shared/fhir.ts";
import type { AdherenceSummary, BarangayRecord, CaseRecord, Disclosure, FacilityRecord, ScheduleRecord } from "../_shared/fhir.ts";

interface RequestBody {
  case_id?: string;
  endpoint_id?: string;
  /** true renders the payload without transmitting it. */
  dry_run?: boolean;
  /** Includes name, phone, street and household coordinates. Coordinator only. */
  include_identifiers?: boolean;
}

interface ProfileRow {
  id: string;
  email: string | null;
  role: string;
}

interface DispatchRow {
  endpoint_id: string;
  endpoint_name: string;
  endpoint_kind: string;
  target_url: string;
  auth_header_name: string | null;
  auth_header_value: string | null;
}

interface AuditRow {
  audit_id: string;
  audit_seq: number;
  audit_hash: string;
  logged_at: string;
}

const CASE_COLUMNS = [
  "id",
  "patient_code",
  "given_name",
  "family_name",
  "contact_phone",
  "address",
  "residence_lat",
  "residence_lon",
  "barangay_psgc",
  "facility_id",
  "patient_profile_id",
  "disease",
  "tb_classification",
  "tb_site",
  "diagnosis_status",
  "age",
  "age_group",
  "sex",
  "treatment_outcome",
  "reported_at",
  "diagnosis_date",
  "notes",
  "source",
  "created_at",
].join(",");

/**
 * Sharing patient records outside BANTAY-TB is a system administrator act,
 * end to end: rendering a payload, transmitting it, and lifting
 * pseudonymisation. The two lists are kept separate so a later decision to
 * let another role *preview* (but not send) is a one-line change.
 */
const PREVIEW_ROLES = ["system_admin"];
const DISCLOSE_ROLES = ["system_admin"];

/**
 * Public FHIR reference servers. A payload bound for one of these is tagged
 * HTEST, so no unmarked Philippine health data ever sits in a sandbox that
 * anybody on the internet can read back.
 */
const TEST_HOSTS = [
  "hapi.fhir.org",
  "server.fire.ly",
  "fhir-open.cerner.com",
  "launch.smarthealthit.org",
];

const TRANSMIT_TIMEOUT_MS = 20_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Both ids arrive from the client and both end up inside a PostgREST query
 * string, so they are checked against the shape the columns actually hold
 * before they are used. RLS would still contain the damage, but a filter the
 * caller can partly author is not a filter.
 */
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string): string | undefined {
  return Deno.env.get(name);
}

function isTestTarget(url: string): boolean {
  try {
    return TEST_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

interface Rest {
  url: string;
  anonKey: string;
  serviceKey: string;
}

/** A read performed as the signed-in caller, so RLS applies to it. */
async function callerSelect<T>(
  rest: Rest,
  token: string,
  path: string
): Promise<T[]> {
  const res = await fetch(`${rest.url}/rest/v1/${path}`, {
    headers: {
      apikey: rest.anonKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`read ${path.split("?")[0]}: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T[];
}

/**
 * Exact row count via PostgREST's Content-Range header. Counting rather than
 * fetching and tallying keeps a long regimen's dose log -- which can run past
 * the API's max_rows -- from silently truncating the adherence figure.
 */
async function callerCount(
  rest: Rest,
  token: string,
  path: string
): Promise<number> {
  const res = await fetch(`${rest.url}/rest/v1/${path}`, {
    headers: {
      apikey: rest.anonKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  if (!res.ok && res.status !== 206) {
    throw new Error(`count ${path.split("?")[0]}: ${res.status} ${await res.text()}`);
  }
  const range = res.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

/** An RPC performed as service_role -- dispatch lookup and audit append only. */
async function serviceRpc<T>(
  rest: Rest,
  fn: string,
  args: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${rest.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: rest.serviceKey,
      Authorization: `Bearer ${rest.serviceKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    throw new Error(`rpc ${fn}: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

interface LogArgs {
  event: string;
  outcome: "ok" | "denied" | "error";
  actor?: ProfileRow | null;
  caseId?: string | null;
  caseLabel?: string | null;
  endpointId?: string | null;
  endpointUrl?: string | null;
  disclosure?: Disclosure | null;
  bundleId?: string | null;
  resourceCount?: number | null;
  payloadBytes?: number | null;
  payloadSha256?: string | null;
  payload?: string | null;
  httpStatus?: number | null;
  responseSummary?: string | null;
  latencyMs?: number | null;
  errorDetail?: string | null;
}

async function logEvent(rest: Rest, a: LogArgs): Promise<AuditRow | null> {
  const rows = await serviceRpc<AuditRow[]>(rest, "interop_log_event", {
    p_event: a.event,
    p_outcome: a.outcome,
    p_actor_id: a.actor?.id ?? null,
    p_actor_email: a.actor?.email ?? null,
    p_actor_role: a.actor?.role ?? null,
    p_case_id: a.caseId ?? null,
    p_case_label: a.caseLabel ?? null,
    p_endpoint_id: a.endpointId ?? null,
    p_endpoint_url: a.endpointUrl ?? null,
    p_disclosure_scope: a.disclosure ?? null,
    p_fhir_bundle_id: a.bundleId ?? null,
    p_resource_count: a.resourceCount ?? null,
    p_payload_bytes: a.payloadBytes ?? null,
    p_payload_sha256: a.payloadSha256 ?? null,
    p_payload: a.payload ?? null,
    p_http_status: a.httpStatus ?? null,
    p_response_summary: a.responseSummary ?? null,
    p_latency_ms: a.latencyMs ?? null,
    p_error_detail: a.errorDetail ?? null,
  });
  return rows?.[0] ?? null;
}

/**
 * A denial still has to be recorded. It is logged on a best-effort basis
 * because the caller is being refused either way -- but a failure to log is
 * written to the function's own logs rather than swallowed.
 */
async function denyAndLog(
  rest: Rest,
  actor: ProfileRow | null,
  detail: string,
  caseId: string | null,
  status = 403
): Promise<Response> {
  try {
    await logEvent(rest, {
      event: "access_denied",
      outcome: "denied",
      actor,
      caseId,
      errorDetail: detail,
    });
  } catch (err) {
    console.error("audit append failed for access_denied:", err);
  }
  return json({ error: detail }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Use POST" }, 405);
  }

  const url = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    return json(
      {
        error:
          "Supabase env not configured (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)",
      },
      500
    );
  }
  const rest: Rest = { url, anonKey, serviceKey };

  // ── Authenticate ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json({ error: "Missing Authorization bearer token" }, 401);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }
  if (!body.case_id) {
    return json({ error: "case_id is required" }, 400);
  }
  if (!isUuid(body.case_id)) {
    return json({ error: "case_id must be a UUID" }, 400);
  }
  if (body.endpoint_id !== undefined && !isUuid(body.endpoint_id)) {
    return json({ error: "endpoint_id must be a UUID" }, 400);
  }

  // The token is validated by GoTrue, not by decoding it here: a decoded
  // payload proves nothing about the signature.
  let actor: ProfileRow | null = null;
  try {
    const userRes = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) {
      return json({ error: "Invalid or expired session" }, 401);
    }
    const user = (await userRes.json()) as { id?: string };
    if (!user.id) {
      return json({ error: "Invalid or expired session" }, 401);
    }
    const profiles = await callerSelect<ProfileRow>(
      rest,
      token,
      `profiles?select=id,email,role&id=eq.${user.id}&limit=1`
    );
    actor = profiles[0] ?? null;
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }

  if (!actor) {
    return json({ error: "No profile for this account" }, 403);
  }

  // ── Authorize ─────────────────────────────────────────────────────────────
  const dryRun = body.dry_run === true;
  const wantsIdentifiers = body.include_identifiers === true;

  if (!PREVIEW_ROLES.includes(actor.role)) {
    return denyAndLog(
      rest,
      actor,
      `role ${actor.role} may not export case records`,
      body.case_id
    );
  }
  if (!dryRun && !DISCLOSE_ROLES.includes(actor.role)) {
    return denyAndLog(
      rest,
      actor,
      `role ${actor.role} may preview a FHIR payload but not transmit it`,
      body.case_id
    );
  }
  if (wantsIdentifiers && !DISCLOSE_ROLES.includes(actor.role)) {
    return denyAndLog(
      rest,
      actor,
      `role ${actor.role} may not request an identified disclosure`,
      body.case_id
    );
  }
  if (!dryRun && !body.endpoint_id) {
    return json({ error: "endpoint_id is required unless dry_run is true" }, 400);
  }

  const disclosure: Disclosure = wantsIdentifiers ? "identified" : "pseudonymous";

  // ── 1. Extract, as the caller ─────────────────────────────────────────────
  let caseRow: (CaseRecord & { patient_profile_id: string | null }) | undefined;
  let barangay: BarangayRecord | null = null;
  let facility: FacilityRecord | null = null;
  let schedules: ScheduleRecord[] = [];
  let adherence: AdherenceSummary | null = null;

  try {
    const cases = await callerSelect<CaseRecord & { patient_profile_id: string | null }>(
      rest,
      token,
      `cases?select=${CASE_COLUMNS}&id=eq.${body.case_id}&limit=1`
    );
    caseRow = cases[0];
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }

  if (!caseRow) {
    // RLS returns an empty set both for "no such case" and for "not yours".
    // Not distinguishing the two in the response is deliberate: telling a BHW
    // that a case exists but belongs to another barangay is itself a
    // disclosure. The audit row records the attempt either way.
    return denyAndLog(
      rest,
      actor,
      "case not found, or outside your assigned area",
      body.case_id,
      404
    );
  }

  try {
    const bgys = await callerSelect<BarangayRecord>(
      rest,
      token,
      `barangays?select=psgc,name,centroid_lat,centroid_lon&psgc=eq.${caseRow.barangay_psgc}&limit=1`
    );
    barangay = bgys[0] ?? null;

    if (caseRow.facility_id) {
      const facilities = await callerSelect<FacilityRecord>(
        rest,
        token,
        `dots_centers?select=id,name,address,lat,lon,phone,hours&id=eq.${caseRow.facility_id}&limit=1`
      );
      facility = facilities[0] ?? null;
    }

    // The DOTS regimen and its dose log are the part of this payload no
    // hospital EMR can supply. They exist only once the case has been
    // enrolled and the patient has an account.
    if (caseRow.patient_profile_id) {
      const pid = caseRow.patient_profile_id;
      schedules = await callerSelect<ScheduleRecord>(
        rest,
        token,
        `adherence_schedules?select=id,medication,dose,times_per_day,start_date,end_date&patient_id=eq.${pid}&order=start_date.asc`
      );
      if (schedules.length > 0) {
        const [total, taken, missed] = await Promise.all([
          callerCount(rest, token, `adherence_logs?select=id&patient_id=eq.${pid}`),
          callerCount(
            rest,
            token,
            `adherence_logs?select=id&patient_id=eq.${pid}&status=eq.taken`
          ),
          callerCount(
            rest,
            token,
            `adherence_logs?select=id&patient_id=eq.${pid}&status=eq.missed`
          ),
        ]);
        adherence = { total, taken, missed };
      }
    }
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }

  // ── 2. Resolve the target (before serialising, so the HTEST tag is right) ─
  let dispatch: DispatchRow | null = null;
  if (body.endpoint_id) {
    try {
      const rows = await serviceRpc<DispatchRow[]>(
        rest,
        "interop_endpoint_dispatch",
        { p_endpoint_id: body.endpoint_id }
      );
      dispatch = rows?.[0] ?? null;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      try {
        await logEvent(rest, {
          event: "transmit_failure",
          outcome: "error",
          actor,
          caseId: caseRow.id,
          caseLabel: caseRow.patient_code,
          endpointId: body.endpoint_id,
          disclosure,
          errorDetail: `endpoint dispatch failed: ${detail}`,
        });
      } catch (logErr) {
        console.error("audit append failed for dispatch error:", logErr);
      }
      return json({ error: `Endpoint unavailable: ${detail}` }, 400);
    }
    if (!dispatch) {
      return json({ error: "Endpoint not found or inactive" }, 400);
    }
    // The database already refuses a non-HTTPS base_url. Re-check here so the
    // guarantee does not depend on a single constraint remaining in place.
    if (!dispatch.target_url.startsWith("https://")) {
      return json({ error: "Refusing to transmit over a non-HTTPS target" }, 400);
    }
  }

  // ── 3. Serialize ──────────────────────────────────────────────────────────
  const built = buildCaseBundle({
    caseRow,
    barangay,
    facility,
    schedules,
    adherence,
    disclosure,
    // No endpoint yet (a bare preview) counts as test data: the bundle has
    // not been accepted by any system of record.
    testData: dispatch ? isTestTarget(dispatch.target_url) : true,
  });

  const payload = JSON.stringify(built.bundle, null, 2);
  const payloadBytes = new TextEncoder().encode(payload).length;
  const sha256 = await sha256Hex(payload);

  const payloadMeta = {
    bundle_id: built.summary.bundleId,
    sha256,
    bytes: payloadBytes,
    resource_count: built.summary.resourceCount,
    resource_types: built.summary.resourceTypes,
    disclosure: built.summary.disclosure,
  };

  // ── Preview: render, record that it was rendered, transmit nothing ────────
  if (dryRun) {
    let audit: AuditRow | null = null;
    let auditError: string | null = null;
    try {
      audit = await logEvent(rest, {
        event: "payload_previewed",
        outcome: "ok",
        actor,
        caseId: caseRow.id,
        caseLabel: built.summary.caseLabel,
        endpointId: dispatch?.endpoint_id ?? null,
        disclosure,
        bundleId: built.summary.bundleId,
        resourceCount: built.summary.resourceCount,
        payloadBytes,
        payloadSha256: sha256,
        // A preview is not a disclosure to anyone, so there is nothing to keep
        // a copy of. Only the digest is retained, which is enough to prove
        // later that a given payload is the one that was previewed.
        payload: null,
        responseSummary: "payload rendered in-app; not transmitted",
      });
    } catch (err) {
      auditError = err instanceof Error ? err.message : String(err);
      console.error("audit append failed for preview:", auditError);
    }
    return json({
      ok: true,
      mode: "preview",
      endpoint: dispatch
        ? {
            id: dispatch.endpoint_id,
            name: dispatch.endpoint_name,
            kind: dispatch.endpoint_kind,
            target_url: dispatch.target_url,
          }
        : null,
      bundle: built.bundle,
      payload: payloadMeta,
      transmission: null,
      audit: audit
        ? { ...audit, logged: true }
        : { logged: false, error: auditError },
    });
  }

  // ── 4. Transmit over HTTPS ────────────────────────────────────────────────
  const target = dispatch as DispatchRow;
  const headers: Record<string, string> = {
    // The FHIR media type, not application/json: it is what tells the
    // receiver to parse this as FHIR and what makes content negotiation work.
    "Content-Type": "application/fhir+json; charset=utf-8",
    Accept: "application/fhir+json",
    "User-Agent": "BANTAY-TB-FHIR-Export/1.0",
  };
  if (target.auth_header_name && target.auth_header_value) {
    headers[target.auth_header_name] = target.auth_header_value;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSMIT_TIMEOUT_MS);
  const started = Date.now();

  let httpStatus: number | null = null;
  let responseBody = "";
  let transportError: string | null = null;

  try {
    const res = await fetch(target.target_url, {
      method: "POST",
      headers,
      body: payload,
      signal: controller.signal,
    });
    httpStatus = res.status;
    responseBody = await res.text();
  } catch (err) {
    transportError =
      err instanceof Error
        ? err.name === "AbortError"
          ? `timed out after ${TRANSMIT_TIMEOUT_MS} ms`
          : err.message
        : String(err);
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Date.now() - started;
  const success = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;
  const summary = transportError
    ? `transport error: ${transportError}`
    : summariseFhirResponse(httpStatus ?? 0, responseBody);

  // ── 5. Audit ──────────────────────────────────────────────────────────────
  let audit: AuditRow | null = null;
  let auditError: string | null = null;
  try {
    audit = await logEvent(rest, {
      event: success ? "transmit_success" : "transmit_failure",
      outcome: success ? "ok" : "error",
      actor,
      caseId: caseRow.id,
      caseLabel: built.summary.caseLabel,
      endpointId: target.endpoint_id,
      endpointUrl: target.target_url,
      disclosure,
      bundleId: built.summary.bundleId,
      resourceCount: built.summary.resourceCount,
      payloadBytes,
      payloadSha256: sha256,
      // The payload is kept so "what exactly did we disclose about this
      // patient?" is answerable months later. interop_log_event encrypts it
      // inside the database; it is never written in the clear.
      payload,
      httpStatus: httpStatus ?? null,
      responseSummary: summary,
      latencyMs,
      errorDetail: transportError,
    });
  } catch (err) {
    auditError = err instanceof Error ? err.message : String(err);
    console.error("audit append failed for transmission:", auditError);
  }

  return json({
    // A disclosure that could not be recorded is not a compliant disclosure,
    // so the caller is told plainly rather than being shown a green tick.
    ok: success && !auditError,
    mode: "transmit",
    endpoint: {
      id: target.endpoint_id,
      name: target.endpoint_name,
      kind: target.endpoint_kind,
      target_url: target.target_url,
    },
    bundle: built.bundle,
    payload: payloadMeta,
    transmission: {
      http_status: httpStatus,
      latency_ms: latencyMs,
      summary,
      created: createdLocations(responseBody),
      // Truncated: enough to defend the result on screen, bounded so a
      // verbose server cannot flood the response.
      body: responseBody.slice(0, 20_000),
      error: transportError,
    },
    audit: audit ? { ...audit, logged: true } : { logged: false, error: auditError },
  });
});
