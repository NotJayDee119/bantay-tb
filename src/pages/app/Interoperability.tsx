import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileJson,
  Info,
  Lock,
  Search,
  Send,
  ShieldCheck,
  Siren,
  Loader2,
  Circle,
  Clock,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
  Spinner,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { cn, formatDateTime } from "../../lib/utils";

// ───────────────────────────────────────────────────────────────────────────
// What this screen is for
//
// The system administrator's view of the outbound FHIR pipeline: pick a case,
// pick a destination, render the HL7 FHIR R4 payload, and send it over HTTPS.
//
// Two things are deliberately visible on screen rather than buried in a log
// file, because they are the claims that have to be defensible: the exact
// bytes transmitted (and their SHA-256), and the ids the receiving system
// assigned to each resource.
//
// The audit trail of everything done here lives on its own page
// (AuditLog.tsx) -- and because that log is append-only, the admin's own
// actions are recorded in a trail the admin cannot edit.
//
// Layout note: both grid columns carry `min-w-0`. Without it a grid track
// grows to fit its widest child, and a FHIR payload has lines far wider than
// the screen -- the right column would push the page sideways and slide under
// the left one.
// ───────────────────────────────────────────────────────────────────────────

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

interface CaseOption {
  id: string;
  patient_code: string | null;
  given_name: string | null;
  family_name: string | null;
  barangay_psgc: number;
  disease: string;
  diagnosis_status: string | null;
  treatment_outcome: string;
  reported_at: string;
  patient_profile_id: string | null;
}

interface EndpointRow {
  id: string;
  name: string;
  kind: "fhir_rest" | "mirth_channel";
  base_url: string;
  resource_path: string;
  auth_scheme: "none" | "bearer" | "basic" | "apikey";
  credential_hint: string | null;
  active: boolean;
  notes: string | null;
}

interface ExportResult {
  ok: boolean;
  mode: "preview" | "transmit";
  endpoint: { id: string; name: string; kind: string; target_url: string } | null;
  bundle: unknown;
  payload: {
    bundle_id: string;
    sha256: string;
    bytes: number;
    resource_count: number;
    resource_types: string[];
    disclosure: string;
  };
  transmission: {
    http_status: number | null;
    latency_ms: number;
    summary: string;
    created: string[];
    body: string;
    error: string | null;
  } | null;
  audit:
    | { logged: true; audit_id: string; audit_seq: number; audit_hash: string }
    | { logged: false; error: string | null };
}

const DISEASE_LABEL: Record<string, string> = {
  tb: "TB",
  pneumonia: "Pneumonia",
  covid19: "COVID-19",
  asthma: "Asthma",
};

const DIAGNOSIS_LABEL: Record<string, string> = {
  presumptive: "Presumptive",
  clinically_diagnosed: "Clinically diagnosed",
  bacteriologically_confirmed: "Lab-confirmed",
};

const OUTCOME_LABEL: Record<string, string> = {
  ongoing: "On treatment",
  cured: "Cured",
  completed: "Completed",
  failed: "Failed",
  died: "Died",
  lost_to_followup: "Lost to follow-up",
  not_evaluated: "Not evaluated",
};

function patientName(c: CaseOption): string | null {
  const name = [c.given_name, c.family_name].filter(Boolean).join(" ");
  return name || null;
}

function caseLabel(c: CaseOption): string {
  const name = [c.given_name, c.family_name].filter(Boolean).join(" ");
  return c.patient_code ?? (name || `Case ${c.id.slice(0, 8)}`);
}

function caseOptionText(c: CaseOption): string {
  const parts = [caseLabel(c), DISEASE_LABEL[c.disease] ?? c.disease];
  if (c.diagnosis_status) {
    parts.push(DIAGNOSIS_LABEL[c.diagnosis_status] ?? c.diagnosis_status);
  }
  return parts.join(" · ");
}

function endpointUrl(e: EndpointRow): string {
  return e.base_url + (e.resource_path ? `/${e.resource_path}` : "");
}

function bytes(n: number | null): string {
  if (n === null) return "—";
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

function seconds(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** A created location like `Patient/123/_history/1` → a link on the receiver. */
function resourceHref(targetUrl: string, location: string): string | null {
  if (/^https:\/\//.test(location)) return location;
  const path = location.split("/_history/")[0];
  if (!/^[A-Za-z]+\/[A-Za-z0-9\-.]+$/.test(path)) return null;
  return `${targetUrl.replace(/\/+$/, "")}/${path}`;
}

export function Interoperability() {
  const { profile } = useAuth();
  // The route already admits only system_admin; this keeps the controls
  // honest if the page is ever reached another way.
  const canTransmit = profile?.role === "system_admin";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [caseId, setCaseId] = useState("");
  const [endpointId, setEndpointId] = useState("");
  const [includeIdentifiers, setIncludeIdentifiers] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // When the current request started, so the processing view can show a live
  // seconds counter instead of an unexplained spinner.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // One query per pause in typing, not one per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: cases, isFetching: casesLoading } = useQuery({
    queryKey: ["interop_cases", debouncedSearch],
    queryFn: async () => {
      let q = supabase
        .from("cases")
        .select(
          "id, patient_code, given_name, family_name, barangay_psgc, disease, diagnosis_status, treatment_outcome, reported_at, patient_profile_id"
        )
        .order("reported_at", { ascending: false })
        .limit(50);
      if (debouncedSearch) {
        // Strip PostgREST filter syntax characters so a search term can never
        // break out of the `or=(...)` expression it is placed in.
        const term = debouncedSearch.replace(/[%,()*]/g, " ").trim();
        if (term) {
          q = q.or(
            `patient_code.ilike.%${term}%,family_name.ilike.%${term}%,given_name.ilike.%${term}%`
          );
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CaseOption[];
    },
  });

  const { data: endpoints, isPending: endpointsLoading } = useQuery({
    queryKey: ["interop_endpoints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interop_endpoints")
        .select(
          "id, name, kind, base_url, resource_path, auth_scheme, credential_hint, active, notes"
        )
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EndpointRow[];
    },
  });

  // Only one destination: choose it for the user instead of making them.
  useEffect(() => {
    if (!endpointId && endpoints?.length === 1) setEndpointId(endpoints[0].id);
  }, [endpoints, endpointId]);

  const selectedEndpoint = useMemo(
    () => endpoints?.find((e) => e.id === endpointId) ?? null,
    [endpoints, endpointId]
  );

  // Keep the chosen case's details even when a new search no longer lists it.
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);
  useEffect(() => {
    const found = cases?.find((c) => c.id === caseId);
    if (found) setSelectedCase(found);
    if (!caseId) setSelectedCase(null);
  }, [cases, caseId]);

  const exportMutation = useMutation({
    mutationFn: async (mode: "preview" | "transmit") => {
      const { data, error } = await supabase.functions.invoke("fhir-export", {
        body: {
          case_id: caseId,
          endpoint_id: endpointId || undefined,
          dry_run: mode === "preview",
          include_identifiers: includeIdentifiers,
        },
      });
      if (error) {
        // The function returns its reason in the body; surface that rather
        // than the generic "non-2xx status code" the client wraps it in.
        throw new Error(await readFunctionError(error));
      }
      return data as ExportResult;
    },
    onMutate: () => {
      setStartedAt(Date.now());
      setElapsedMs(0);
    },
    onSettled: () => setStartedAt(null),
    onSuccess: (data) => {
      setResult(data);
      setConfirming(false);
      if (data.mode === "preview") {
        toast.success(`Preview ready — ${data.payload.resource_count} FHIR resources`);
      } else if (data.ok) {
        toast.success(
          `Sent to ${data.endpoint?.name} — HTTP ${data.transmission?.http_status}`
        );
      } else if (!data.audit.logged) {
        toast.error("Sent, but the audit log could not be written — see the result panel");
      } else {
        toast.error(
          `The destination refused the payload — HTTP ${data.transmission?.http_status ?? "—"}`
        );
      }
    },
    onError: (err: Error) => {
      setConfirming(false);
      toast.error(err.message || "Export failed");
    },
  });

  const busy = exportMutation.isPending;
  const busyMode = busy ? exportMutation.variables ?? null : null;

  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => setElapsedMs(Date.now() - startedAt);
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [startedAt]);
  const payloadJson = result ? JSON.stringify(result.bundle, null, 2) : "";
  const payloadLines = payloadJson ? payloadJson.split("\n").length : 0;

  // What still stands between the user and each button, in plain words.
  const previewBlocker = !caseId ? "Choose a case first." : null;
  const transmitBlocker = !canTransmit
    ? "Only the system administrator can send records."
    : !caseId
    ? "Choose a case first."
    : !endpointId
    ? "Choose a destination to send to."
    : null;

  const steps = [
    { label: "Choose a case", done: Boolean(caseId) },
    { label: "Choose a destination", done: Boolean(endpointId) },
    {
      label: "Preview and send",
      done: result?.mode === "transmit" && result.ok,
    },
  ];

  function resetResult() {
    setResult(null);
    setCopied(false);
  }

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(payloadJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed — select the payload and copy it manually.");
    }
  }

  function downloadPayload() {
    if (!result) return;
    const blob = new Blob([payloadJson], { type: "application/fhir+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fhir-bundle-${result.payload.bundle_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="FHIR Interoperability"
        eyebrow="HL7 FHIR R4 · System administrator"
        subtitle="Send a TB case to another health system in the standard HL7 FHIR format, over a secure HTTPS connection. Patient names are removed by default, and every action is recorded in the audit log."
      />

      {/* ── Progress ──────────────────────────────────────────────────── */}
      <ol className="mb-4 grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className={cn(
              "flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors",
              s.done
                ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                : "border-slate-200 bg-white text-slate-600"
            )}
          >
            <span
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                s.done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
              )}
            >
              {s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="truncate font-medium">{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* ── Left: build and send ────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">
          <Card className="p-5">
            {/* Step 1 */}
            <section className="space-y-3">
              <h2 className={MICRO_LABEL}>Step 1 · Patient record</h2>

              <div className="space-y-1.5">
                <Label htmlFor="interop-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="interop-search"
                    className="pl-9"
                    placeholder="TB code or surname"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="interop-case">Case</Label>
                  <span className="text-[11px] text-slate-400">
                    {casesLoading
                      ? "Searching…"
                      : `${cases?.length ?? 0} ${
                          debouncedSearch ? "matches" : "most recent"
                        }`}
                  </span>
                </div>
                <Select
                  id="interop-case"
                  className="w-full"
                  value={caseId}
                  onChange={(e) => {
                    setCaseId(e.target.value);
                    resetResult();
                  }}
                >
                  <option value="">Select a case…</option>
                  {/* Keep the current choice selectable even if the latest
                      search no longer returns it. */}
                  {selectedCase &&
                    !(cases ?? []).some((c) => c.id === selectedCase.id) && (
                      <option value={selectedCase.id}>
                        {caseOptionText(selectedCase)}
                      </option>
                    )}
                  {(cases ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {caseOptionText(c)}
                    </option>
                  ))}
                </Select>
                {!casesLoading && cases?.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No cases match “{debouncedSearch}”.
                  </p>
                )}
              </div>

              {selectedCase && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
                  <div className="min-w-0">
                    <dt className="text-slate-500">Patient</dt>
                    <dd className="truncate font-semibold text-slate-900">
                      {patientName(selectedCase) ?? "No name on file"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-slate-500">TB code</dt>
                    <dd
                      className={cn(
                        "truncate",
                        selectedCase.patient_code
                          ? "font-mono font-semibold text-slate-900"
                          : "italic text-slate-400"
                      )}
                    >
                      {selectedCase.patient_code ?? "Not assigned"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-slate-500">Diagnosis</dt>
                    <dd className="truncate font-medium text-slate-800">
                      {selectedCase.diagnosis_status
                        ? DIAGNOSIS_LABEL[selectedCase.diagnosis_status] ??
                          selectedCase.diagnosis_status
                        : DISEASE_LABEL[selectedCase.disease] ?? selectedCase.disease}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-slate-500">Outcome</dt>
                    <dd className="truncate font-medium text-slate-800">
                      {OUTCOME_LABEL[selectedCase.treatment_outcome] ??
                        selectedCase.treatment_outcome}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-slate-500">Reported</dt>
                    <dd className="truncate font-medium text-slate-800">
                      {formatDateTime(selectedCase.reported_at)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-slate-500">DOTS regimen</dt>
                    <dd className="truncate font-medium text-slate-800">
                      {selectedCase.patient_profile_id ? "Included" : "None yet"}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            <hr className="my-5 border-slate-200" />

            {/* Step 2 */}
            <section className="space-y-3">
              <h2 className={MICRO_LABEL}>Step 2 · Destination</h2>
              <div className="space-y-1.5">
                <Label htmlFor="interop-endpoint">Send to</Label>
                <Select
                  id="interop-endpoint"
                  className="w-full"
                  value={endpointId}
                  onChange={(e) => {
                    setEndpointId(e.target.value);
                    resetResult();
                  }}
                >
                  <option value="">
                    {endpointsLoading ? "Loading…" : "Select a destination…"}
                  </option>
                  {(endpoints ?? []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </div>

              {selectedEndpoint && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="success" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Secure HTTPS
                    </Badge>
                    <Badge>
                      {selectedEndpoint.kind === "mirth_channel"
                        ? "Mirth Connect"
                        : "FHIR server"}
                    </Badge>
                    <Badge>
                      {selectedEndpoint.auth_scheme === "none"
                        ? "No login needed"
                        : `Login: ${selectedEndpoint.auth_scheme}${
                            selectedEndpoint.credential_hint
                              ? ` ${selectedEndpoint.credential_hint}`
                              : ""
                          }`}
                    </Badge>
                  </div>
                  <div className="break-all font-mono text-[11px] text-slate-700">
                    {endpointUrl(selectedEndpoint)}
                  </div>
                  {selectedEndpoint.notes && (
                    <p className="text-slate-500">{selectedEndpoint.notes}</p>
                  )}
                </div>
              )}
            </section>

            <hr className="my-5 border-slate-200" />

            {/* Step 3 */}
            <section className="space-y-3">
              <h2 className={MICRO_LABEL}>Step 3 · Preview and send</h2>

              {/* Lifting pseudonymisation is a separate, deliberate act. */}
              {canTransmit && (
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                    includeIdentifiers
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    checked={includeIdentifiers}
                    onChange={(e) => {
                      setIncludeIdentifiers(e.target.checked);
                      resetResult();
                    }}
                  />
                  <span
                    className={cn(
                      "min-w-0 text-xs",
                      includeIdentifiers ? "text-amber-900" : "text-slate-600"
                    )}
                  >
                    <span
                      className={cn(
                        "block font-semibold",
                        includeIdentifiers ? "text-amber-950" : "text-slate-900"
                      )}
                    >
                      Include the patient's name and address
                    </span>
                    Off by default. Only turn on for a referral the patient
                    agreed to — it is recorded as an{" "}
                    <span className="font-medium">identified</span> disclosure.
                  </span>
                </label>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  className="gap-2"
                  disabled={Boolean(previewBlocker) || busy}
                  loading={busy && exportMutation.variables === "preview"}
                  onClick={() => exportMutation.mutate("preview")}
                >
                  {!(busy && exportMutation.variables === "preview") && (
                    <Eye className="h-4 w-4" />
                  )}
                  Preview
                </Button>
                <Button
                  className="gap-2"
                  disabled={Boolean(transmitBlocker) || busy}
                  loading={busy && exportMutation.variables === "transmit"}
                  onClick={() => setConfirming(true)}
                >
                  {!(busy && exportMutation.variables === "transmit") && (
                    <Send className="h-4 w-4" />
                  )}
                  Transmit
                </Button>
              </div>

              <p className="flex items-start gap-1.5 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {transmitBlocker ??
                  "Preview only builds the file. Nothing leaves BANTAY-TB until you press Transmit and confirm."}
              </p>
            </section>
          </Card>

          {/* ── Result ─────────────────────────────────────────────────── */}
          {result && <ResultCard result={result} />}
        </div>

        {/* ── Right: the payload ──────────────────────────────────────── */}
        <div className="min-w-0">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
              <div className="min-w-0">
                <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
                  <FileJson className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                  FHIR R4 transaction bundle
                </div>
                {result && (
                  <div className="mt-0.5 text-xs text-slate-500">
                    {result.payload.resource_count} resources ·{" "}
                    {bytes(result.payload.bytes)} · {payloadLines} lines
                  </div>
                )}
              </div>
              {result && (
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" size="sm" onClick={copyPayload}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={downloadPayload}>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </div>
              )}
            </div>

            {busyMode ? (
              <div className="min-h-[16rem] px-6 py-10">
                <ProcessingPanel
                  mode={busyMode}
                  elapsedMs={elapsedMs}
                  destination={selectedEndpoint?.name ?? null}
                />
              </div>
            ) : result ? (
              <pre className="max-h-[70vh] min-h-[16rem] overflow-auto whitespace-pre bg-slate-900 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-100">
                {payloadJson}
              </pre>
            ) : (
              <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
                  <FileJson className="h-6 w-6" />
                </span>
                <div className="max-w-sm">
                  <p className="text-sm font-medium text-slate-700">
                    No payload yet
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose a case, then press <strong>Preview</strong> to see
                    the exact FHIR file that would be sent.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Confirm before anything leaves the system ──────────────────── */}
      <Modal
        open={confirming}
        onClose={() => !busy && setConfirming(false)}
        title="Send this record?"
        description="This sends patient data outside BANTAY-TB. The action is recorded in the audit log and cannot be undone."
        icon={<Send className="h-5 w-5 text-brand-600" />}
        className="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-2"
              loading={busy}
              onClick={() => exportMutation.mutate("transmit")}
            >
              {!busy && <Send className="h-3.5 w-3.5" />}
              Send now
            </Button>
          </div>
        }
      >
        {/* Modal leaves body padding to the caller. */}
        <div className="px-5 py-5">
          {busyMode === "transmit" ? (
            <ProcessingPanel
              mode="transmit"
              elapsedMs={elapsedMs}
              destination={selectedEndpoint?.name ?? null}
            />
          ) : (
            <div className="space-y-4">
              <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 text-sm">
                <ConfirmRow label="Patient">
                  <span className="font-semibold text-slate-900">
                    {selectedCase ? patientName(selectedCase) ?? "No name on file" : "—"}
                  </span>
                </ConfirmRow>
                <ConfirmRow label="TB code">
                  {selectedCase?.patient_code ? (
                    <span className="font-mono font-semibold text-slate-900">
                      {selectedCase.patient_code}
                    </span>
                  ) : (
                    <span className="italic text-slate-400">Not assigned</span>
                  )}
                </ConfirmRow>
                <ConfirmRow label="Send to">
                  <span className="block font-medium text-slate-900">
                    {selectedEndpoint?.name ?? "—"}
                  </span>
                  {selectedEndpoint && (
                    <span className="mt-0.5 block break-all font-mono text-[11px] text-slate-500">
                      {endpointUrl(selectedEndpoint)}
                    </span>
                  )}
                </ConfirmRow>
                <ConfirmRow label="Identity">
                  {includeIdentifiers ? (
                    <Badge tone="warning">Name and address included</Badge>
                  ) : (
                    <Badge tone="success">Name removed</Badge>
                  )}
                </ConfirmRow>
              </dl>

              {includeIdentifiers && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    The patient's name, contact number and address will leave
                    BANTAY-TB. Only continue if the patient agreed to this
                    referral.
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

/** One label / value line in the send confirmation. */
function ConfirmRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3 bg-white px-4 py-3">
      <dt className="pt-0.5 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/**
 * What the user sees while a request is in flight. The server does not
 * stream its progress, so the active step is estimated from elapsed time:
 * reading and building take well under a second each, and anything after
 * that is the wait on the destination server. The steps are labelled as
 * what is happening, never as a percentage, so the estimate cannot mislead.
 */
function ProcessingPanel({
  mode,
  elapsedMs,
  destination,
}: {
  mode: "preview" | "transmit";
  elapsedMs: number;
  destination: string | null;
}) {
  const steps =
    mode === "transmit"
      ? [
          { label: "Reading the record from the database", until: 700 },
          { label: "Building the FHIR file", until: 1400 },
          {
            label: `Sending over HTTPS${destination ? ` to ${destination}` : ""}`,
            until: Infinity,
          },
          { label: "Saving to the audit log", until: Infinity },
        ]
      : [
          { label: "Reading the record from the database", until: 700 },
          { label: "Building the FHIR file", until: Infinity },
        ];

  // The first step whose time has not run out is the active one.
  let active = steps.findIndex((s) => elapsedMs < s.until);
  if (active === -1) active = steps.length - 1;

  const slow = mode === "transmit" && elapsedMs > 8000;

  return (
    <div className="mx-auto w-full max-w-sm" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <Spinner className="h-6 w-6 shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {mode === "transmit" ? "Sending the record…" : "Building the preview…"}
          </div>
          <div className="flex items-center gap-1 text-xs tabular-nums text-slate-500">
            <Clock className="h-3 w-3" />
            {(elapsedMs / 1000).toFixed(1)} s
          </div>
        </div>
      </div>

      {/* Indeterminate bar: shows activity without claiming a percentage. */}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full w-1/3 animate-[interop-slide_1.2s_ease-in-out_infinite] rounded-full bg-brand-500" />
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={s.label} className="flex items-start gap-2 text-xs">
              {done ? (
                <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-emerald-600" />
              ) : current ? (
                <Loader2 className="mt-px h-4 w-4 shrink-0 animate-spin text-brand-600" />
              ) : (
                <Circle className="mt-px h-4 w-4 shrink-0 text-slate-300" />
              )}
              <span
                className={cn(
                  "min-w-0 break-words",
                  done && "text-slate-500",
                  current && "font-medium text-slate-900",
                  !done && !current && "text-slate-400"
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      {slow && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Still waiting on the destination. HAPI is a free public server and
          can take up to 20 seconds — please keep this page open.
        </p>
      )}
    </div>
  );
}

function ResultCard({ result }: { result: ExportResult }) {
  const t = result.transmission;
  const sent = result.mode === "transmit";

  const banner = !sent
    ? {
        tone: "border-sky-200 bg-sky-50 text-sky-900",
        icon: <Eye className="h-5 w-5 shrink-0 text-sky-600" />,
        title: "Preview only",
        body: "The file was built but nothing was sent.",
      }
    : result.ok
    ? {
        tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
        icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />,
        title: `Accepted · HTTP ${t?.http_status}`,
        body: `${result.endpoint?.name ?? "The destination"} received the record in ${seconds(
          t?.latency_ms ?? 0
        )}.`,
      }
    : {
        tone: "border-red-200 bg-red-50 text-red-900",
        icon: <XCircle className="h-5 w-5 shrink-0 text-red-600" />,
        title: t?.http_status ? `Not accepted · HTTP ${t.http_status}` : "Not sent",
        body:
          t?.error ??
          "The destination did not accept the payload. The attempt is in the audit log.",
      };

  return (
    <Card className="overflow-hidden p-0">
      <div className={cn("flex items-start gap-3 border-b px-4 py-3", banner.tone)}>
        {banner.icon}
        <div className="min-w-0">
          <div className="text-sm font-semibold">{banner.title}</div>
          <div className="break-words text-xs opacity-90">{banner.body}</div>
        </div>
      </div>

      <div className="space-y-4 p-4 text-xs">
        <div>
          <div className="text-slate-500">
            {result.payload.resource_count} FHIR resources · {bytes(result.payload.bytes)}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {result.payload.resource_types.map((type, i) => (
              <Badge key={`${type}-${i}`}>{type}</Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-slate-500">Patient identity</span>
          <Badge tone={result.payload.disclosure === "identified" ? "warning" : "success"}>
            {result.payload.disclosure === "identified"
              ? "Name and address included"
              : "Name removed"}
          </Badge>
        </div>

        <div>
          <div className="text-slate-500">SHA-256 fingerprint of the file</div>
          <div className="mt-1 break-all rounded bg-slate-50 px-2 py-1.5 font-mono text-[10px] text-slate-700">
            {result.payload.sha256}
          </div>
        </div>

        {sent && t && t.created.length > 0 && (
          <div>
            <div className="text-slate-500">
              Records the destination created ({t.created.length})
            </div>
            <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
              {t.created.map((loc) => {
                const href = result.endpoint
                  ? resourceHref(result.endpoint.target_url, loc)
                  : null;
                return (
                  <li key={loc} className="min-w-0">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-start gap-1 break-all font-mono text-[10px] text-emerald-700 hover:underline"
                      >
                        <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0" />
                        {loc}
                      </a>
                    ) : (
                      <span className="break-all font-mono text-[10px] text-emerald-700">
                        {loc}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 text-slate-500">
              Each record got its own ID, so the destination read and stored
              them — not just received a file. Click one to open it there.
            </p>
          </div>
        )}

        <div className="border-t border-slate-200 pt-3">
          {result.audit.logged ? (
            <p className="flex items-start gap-1.5 text-slate-600">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                Saved to the audit log as entry #{result.audit.audit_seq}. It
                cannot be edited or deleted.
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-red-700">
              <Siren className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-words">
                The audit log could not be written (
                {result.audit.error ?? "unknown error"}). Treat this as
                unrecorded and report it.
              </span>
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * supabase-js wraps a non-2xx Edge Function reply in a FunctionsHttpError and
 * keeps the body on `context`. Reading it is the difference between showing
 * the operator "Edge Function returned a non-2xx status code" and showing them
 * "case not found, or outside your assigned area".
 */
async function readFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // fall through to the generic message
    }
  }
  return error instanceof Error ? error.message : String(error);
}
