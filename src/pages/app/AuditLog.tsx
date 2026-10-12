import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Eye,
  FileJson,
  Link2,
  ShieldCheck,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ListSkeleton,
  Modal,
  PageHeader,
  Select,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import type { Database } from "../../lib/database.types";
import { formatDateTime } from "../../lib/utils";

type AuditEvent = Database["public"]["Tables"]["interop_audit_log"]["Row"]["event"];

// ───────────────────────────────────────────────────────────────────────────
// The interoperability audit trail — system administrator only.
//
// Only the system administrator can share records (Interoperability.tsx) and
// only the system administrator can read this trail. That is safe because the
// trail is append-only: the admin's own transmissions, previews and payload
// reads are recorded in a log the admin cannot edit, delete or truncate, and
// any out-of-band edit breaks the hash chain. The database enforces the
// access (RLS on interop_audit_log, is_super_admin() inside
// verify_interop_audit / interop_payload) — hiding this page is not the gate.
// ───────────────────────────────────────────────────────────────────────────

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

interface AuditRow {
  id: string;
  seq: number;
  event: string;
  case_label: string | null;
  endpoint_url: string | null;
  actor_email: string | null;
  actor_role: string | null;
  disclosure_scope: string | null;
  resource_count: number | null;
  payload_bytes: number | null;
  payload_sha256: string | null;
  http_status: number | null;
  response_summary: string | null;
  latency_ms: number | null;
  outcome: string;
  error_detail: string | null;
  record_hash: string;
  created_at: string;
}

const EVENT_META: Record<
  string,
  { label: string; tone: "default" | "success" | "warning" | "danger" | "info" }
> = {
  payload_previewed: { label: "Previewed", tone: "info" },
  transmit_success: { label: "Transmitted", tone: "success" },
  transmit_failure: { label: "Failed", tone: "danger" },
  payload_viewed: { label: "Payload read", tone: "warning" },
  access_denied: { label: "Denied", tone: "danger" },
  endpoint_credential_set: { label: "Credential set", tone: "default" },
};

/** Only transmissions keep an encrypted copy of what was sent. */
const KEEPS_PAYLOAD = new Set(["transmit_success", "transmit_failure"]);

function bytes(n: number | null): string {
  if (n === null) return "—";
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

export function AuditLog() {
  const queryClient = useQueryClient();
  const [eventFilter, setEventFilter] = useState("all");
  const [chain, setChain] = useState<
    { audit_seq: number; ok: boolean; problem: string | null }[] | null
  >(null);
  const [viewing, setViewing] = useState<{ row: AuditRow; json: string | null } | null>(
    null
  );

  const { data: rows, isPending } = useQuery({
    queryKey: ["interop_audit", eventFilter],
    queryFn: async () => {
      let q = supabase
        .from("interop_audit_log")
        .select(
          "id, seq, event, case_label, endpoint_url, actor_email, actor_role, disclosure_scope, resource_count, payload_bytes, payload_sha256, http_status, response_summary, latency_ms, outcome, error_detail, record_hash, created_at"
        )
        .order("seq", { ascending: false })
        .limit(200);
      if (eventFilter !== "all") {
        q = q.eq("event", eventFilter as AuditEvent);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("verify_interop_audit");
      if (error) throw error;
      return (data ?? []) as {
        audit_seq: number;
        ok: boolean;
        problem: string | null;
      }[];
    },
    onSuccess: (result) => {
      setChain(result);
      const broken = result.filter((r) => !r.ok);
      if (result.length === 0) {
        toast.success("The audit log is empty — nothing to verify yet");
      } else if (broken.length === 0) {
        toast.success(`Hash chain intact across all ${result.length} entries`);
      } else {
        toast.error(
          `${broken.length} entr${broken.length === 1 ? "y" : "ies"} failed verification`
        );
      }
    },
    onError: (err: Error) => toast.error(err.message || "Verification failed"),
  });

  // Decrypting a stored payload is itself an audited act: the database
  // appends a `payload_viewed` row, so the list is refreshed afterwards.
  const payloadMutation = useMutation({
    mutationFn: async (row: AuditRow) => {
      const { data, error } = await supabase.rpc("interop_payload", {
        p_audit_id: row.id,
      });
      if (error) throw error;
      return { row, json: data as string | null };
    },
    onSuccess: ({ row, json }) => {
      let pretty = json;
      if (json) {
        try {
          pretty = JSON.stringify(JSON.parse(json), null, 2);
        } catch {
          pretty = json;
        }
      }
      setViewing({ row, json: pretty });
      setChain(null);
      queryClient.invalidateQueries({ queryKey: ["interop_audit"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not read payload"),
  });

  const chainBySeq = useMemo(() => {
    const map = new Map<number, { ok: boolean; problem: string | null }>();
    for (const r of chain ?? []) map.set(r.audit_seq, { ok: r.ok, problem: r.problem });
    return map;
  }, [chain]);

  const counts = useMemo(() => {
    const c = { sent: 0, failed: 0, denied: 0, identified: 0 };
    for (const r of rows ?? []) {
      if (r.event === "transmit_success") c.sent++;
      if (r.event === "transmit_failure") c.failed++;
      if (r.event === "access_denied") c.denied++;
      if (r.disclosure_scope === "identified" && r.event === "transmit_success") {
        c.identified++;
      }
    }
    return c;
  }, [rows]);

  const brokenCount = chain?.filter((r) => !r.ok).length ?? 0;

  return (
    <>
      <PageHeader
        title="Audit Log"
        eyebrow="Data Privacy Act · RA 10173"
        subtitle="Every FHIR payload previewed, transmitted, refused or read back is recorded here. Entries cannot be edited or deleted, and each one is sealed to the one before it — verifying the chain proves nothing has been altered."
        actions={
          <Button
            className="gap-2"
            onClick={() => verifyMutation.mutate()}
            loading={verifyMutation.isPending}
          >
            {!verifyMutation.isPending && <ShieldCheck className="h-4 w-4" />}
            Verify audit chain
          </Button>
        }
      />

      {/* ── Verification verdict ─────────────────────────────────────── */}
      {chain && (
        <Card
          className={
            "mb-4 flex items-start gap-3 p-4 " +
            (brokenCount === 0
              ? "border-emerald-200 bg-emerald-50/70"
              : "border-red-200 bg-red-50/70")
          }
        >
          {brokenCount === 0 ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          )}
          <div className="text-sm">
            {brokenCount === 0 ? (
              <>
                <div className="font-semibold text-emerald-900">
                  Chain intact — {chain.length} entries verified
                </div>
                <div className="mt-0.5 text-emerald-800">
                  Every entry's fingerprint matches its contents, and every
                  entry links to the one before it. Nothing has been edited or
                  removed.
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold text-red-900">
                  {brokenCount} entr{brokenCount === 1 ? "y" : "ies"} failed
                  verification
                </div>
                <div className="mt-0.5 text-red-800">
                  The log has been altered outside the application. The first
                  flagged entry is where it happened — see the marked rows
                  below.
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* ── At a glance ──────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Transmitted", value: counts.sent, tone: "text-emerald-700" },
          { label: "Failed", value: counts.failed, tone: "text-red-700" },
          { label: "Access denied", value: counts.denied, tone: "text-amber-700" },
          {
            label: "Identified disclosures",
            value: counts.identified,
            tone: "text-amber-700",
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className={MICRO_LABEL}>{s.label}</div>
            <div className={"mt-1 font-display text-2xl font-bold tabular-nums " + s.tone}>
              {isPending ? "—" : s.value}
            </div>
          </Card>
        ))}
      </div>

      {/* ── The trail ────────────────────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <Link2 className="h-3.5 w-3.5 text-accent-600" />
            Interoperability events · append-only, hash-chained
          </div>
          <Select
            aria-label="Filter by event"
            className="h-8 w-auto text-xs"
            value={eventFilter}
            onChange={(e) => {
              setEventFilter(e.target.value);
              setChain(null);
            }}
          >
            <option value="all">All events</option>
            {Object.entries(EVENT_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </Select>
        </div>

        {isPending ? (
          <ListSkeleton rows={6} />
        ) : (rows ?? []).length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            No interoperability events recorded
            {eventFilter === "all" ? " yet" : " of this kind"}.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(rows ?? []).map((row) => {
              const meta = EVENT_META[row.event] ?? {
                label: row.event,
                tone: "default" as const,
              };
              const verified = chainBySeq.get(row.seq);
              return (
                <li
                  key={row.id}
                  className={
                    "px-4 py-3 " + (verified && !verified.ok ? "bg-red-50/60" : "")
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] tabular-nums text-slate-400">
                      #{row.seq}
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {row.case_label && (
                      <span className="font-mono text-[11px] text-slate-700">
                        {row.case_label}
                      </span>
                    )}
                    {row.disclosure_scope === "identified" && (
                      <Badge tone="warning">identified</Badge>
                    )}
                    {row.http_status !== null && (
                      <span className="font-mono text-[10px] text-slate-500">
                        HTTP {row.http_status}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-2">
                      {verified && (
                        <span
                          className={
                            "flex items-center gap-1 text-[10px] " +
                            (verified.ok ? "text-emerald-700" : "text-red-700")
                          }
                          title={verified.problem ?? "fingerprint verified"}
                        >
                          {verified.ok ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {verified.ok ? "verified" : "tampered"}
                        </span>
                      )}
                      {KEEPS_PAYLOAD.has(row.event) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 px-2 text-xs"
                          loading={
                            payloadMutation.isPending &&
                            payloadMutation.variables?.id === row.id
                          }
                          onClick={() => payloadMutation.mutate(row)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View payload
                        </Button>
                      )}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    {formatDateTime(row.created_at)}
                    {row.actor_email ? ` · ${row.actor_email}` : ""}
                    {row.actor_role ? ` (${row.actor_role})` : ""}
                    {row.resource_count !== null
                      ? ` · ${row.resource_count} resources`
                      : ""}
                    {row.payload_bytes !== null ? ` · ${bytes(row.payload_bytes)}` : ""}
                    {row.latency_ms !== null ? ` · ${row.latency_ms} ms` : ""}
                  </div>

                  {row.endpoint_url && (
                    <div className="mt-0.5 break-all font-mono text-[10px] text-slate-500">
                      {row.endpoint_url}
                    </div>
                  )}
                  {row.response_summary && (
                    <div className="mt-1 break-all text-[11px] text-slate-500">
                      {row.response_summary}
                    </div>
                  )}
                  {row.error_detail && (
                    <div className="mt-1 text-[11px] text-red-600">
                      {row.error_detail}
                    </div>
                  )}
                  {row.payload_sha256 && (
                    <div className="mt-1 break-all font-mono text-[10px] text-slate-400">
                      sha256 {row.payload_sha256}
                    </div>
                  )}
                  {verified && !verified.ok && verified.problem && (
                    <div className="mt-1 text-[11px] font-medium text-red-700">
                      {verified.problem}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ── Decrypted payload ────────────────────────────────────────── */}
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={`Payload of entry #${viewing?.row.seq ?? ""}`}
        description={
          viewing
            ? `${viewing.row.case_label ?? "—"} · sent to ${
                viewing.row.endpoint_url ?? "—"
              }. This read has been recorded in the audit log.`
            : undefined
        }
        icon={<FileJson className="h-5 w-5 text-brand-600" />}
        className="max-w-3xl"
      >
        <div className="px-5 py-5">
          {viewing?.json ? (
            <pre className="max-h-[60vh] overflow-auto whitespace-pre rounded-lg bg-slate-900 px-4 py-3 text-[11px] leading-relaxed text-slate-100">
              {viewing.json}
            </pre>
          ) : (
            <p className="text-sm text-slate-600">
              No payload copy was kept for this entry — the transmission failed
              before a payload was built.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
