import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CheckCheck, Home } from "lucide-react";
import { Button, Card, ListSkeleton, PageHeader } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useAreaScope } from "../../hooks/useAreaScope";
import type { AreaScope } from "../../lib/areaScope";
import { formatDateTime } from "../../lib/utils";
import barangays from "../../data/barangays.json";
import { toast } from "sonner";

type Severity = "watch" | "moderate" | "high" | "urgent" | "low" | "medium";

interface AlertRow {
  id: string;
  read_at: string | null;
  created_at: string;
  hotspot_id: string;
  hotspots: {
    barangay_psgc: number;
    barangay_psgcs: number[] | null;
    case_ids: string[] | null;
    case_count: number;
    severity: Severity;
    radius_km: number;
    detected_at: string;
  } | null;
}

/**
 * A case behind an alert. `barangay_psgc` + `address` are the residence — the
 * axis that decides whose case this is. `facility_id` is only where it was
 * registered, which is routinely another barangay's clinic, so it is shown as
 * context and never as ownership.
 */
interface CaseRef {
  id: string;
  barangay_psgc: number;
  address: string | null;
  facility_id: string | null;
  reported_at: string | null;
}

// How many residences to print per alert before collapsing to a count. An
// urgent cluster can run to 50+ cases; the inbox has to stay scannable.
const MAX_ADDRESSES_SHOWN = 5;

// Shared severity scale — watch blue → urgent red, same as the map pages.
const SEVERITY_COLOR: Record<Severity, string> = {
  watch: "#0284c7",
  moderate: "#d97706",
  high: "#ea580c",
  urgent: "#dc2626",
  low: "#0284c7",
  medium: "#d97706",
};

function SeverityChip({ severity }: { severity: Severity }) {
  const c = SEVERITY_COLOR[severity];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
      style={{ color: c, borderColor: `${c}55`, background: `${c}14` }}
    >
      {severity}
    </span>
  );
}

export function Alerts() {
  const { profile } = useAuth();
  const scope = useAreaScope();
  const recipientId = profile?.id;
  const [list, setList] = useState<AlertRow[]>([]);
  const [caseById, setCaseById] = useState<Map<string, CaseRef>>(new Map());
  const [facilityById, setFacilityById] = useState<Map<string, string>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);

  // Scope every query to the current user's alerts. Staff RLS grants visibility
  // into all recipients' rows, so without an explicit filter a "Mark all read"
  // would silently overwrite other coordinators' inbox state.
  const load = useCallback(async () => {
    if (!recipientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("hotspot_alerts")
      .select(
        "id, read_at, created_at, hotspot_id, hotspots(barangay_psgc, barangay_psgcs, case_ids, case_count, severity, radius_km, detected_at)"
      )
      .eq("recipient_id", recipientId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    const alerts = (data ?? []) as unknown as AlertRow[];
    setList(alerts);

    // Resolve the cases behind the alerts so each one can name the residences
    // it is about. No client-side filtering by area is needed or wanted: the
    // `cases` read policy already returns only this account's own residents
    // plus its own facility's registrations, so whatever comes back is exactly
    // what this user is entitled to act on.
    const ids = [
      ...new Set(alerts.flatMap((a) => a.hotspots?.case_ids ?? [])),
    ];
    if (ids.length === 0) {
      setCaseById(new Map());
      setLoading(false);
      return;
    }
    const { data: caseRows, error: caseErr } = await supabase
      .from("cases")
      .select("id, barangay_psgc, address, facility_id, reported_at")
      .in("id", ids);
    if (caseErr) toast.error(`Could not load case addresses: ${caseErr.message}`);
    setCaseById(
      new Map(((caseRows ?? []) as CaseRef[]).map((c) => [c.id, c]))
    );

    // dots_centers is small and world-readable — one fetch names every
    // registering facility referenced above.
    const facilityIds = new Set(
      ((caseRows ?? []) as CaseRef[])
        .map((c) => c.facility_id)
        .filter((id): id is string => Boolean(id))
    );
    if (facilityIds.size > 0) {
      const { data: facilities } = await supabase
        .from("dots_centers")
        .select("id, name")
        .in("id", [...facilityIds]);
      setFacilityById(
        new Map(
          ((facilities ?? []) as { id: string; name: string }[]).map((f) => [
            f.id,
            f.name,
          ])
        )
      );
    }
    setLoading(false);
  }, [recipientId]);

  useEffect(() => {
    if (!recipientId) return;
    load();
    const ch = supabase
      .channel("alerts-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hotspot_alerts" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [recipientId, load]);

  // Both mark-read actions are optimistic: the row flips to "read" the
  // instant it's clicked, and only rolls back (with a toast) if the write
  // fails. The realtime channel re-syncs the list afterwards regardless.
  async function markRead(id: string) {
    if (!recipientId) return;
    const previous = list;
    const now = new Date().toISOString();
    setList((l) => l.map((a) => (a.id === id ? { ...a, read_at: now } : a)));
    const { error } = await supabase
      .from("hotspot_alerts")
      .update({ read_at: now })
      .eq("id", id)
      .eq("recipient_id", recipientId);
    if (error) {
      setList(previous);
      toast.error(`Could not mark as read: ${error.message}`);
    }
  }

  async function markAllRead() {
    if (!recipientId) return;
    const ids = list.filter((a) => !a.read_at).map((a) => a.id);
    if (ids.length === 0) return;
    const previous = list;
    const now = new Date().toISOString();
    setList((l) => l.map((a) => (a.read_at ? a : { ...a, read_at: now })));
    const { error } = await supabase
      .from("hotspot_alerts")
      .update({ read_at: now })
      .in("id", ids)
      .eq("recipient_id", recipientId);
    if (error) {
      setList(previous);
      toast.error(`Could not mark all as read: ${error.message}`);
    } else {
      toast.success(`Marked ${ids.length} alert(s) as read`);
    }
  }

  const unreadCount = list.filter((a) => !a.read_at).length;

  return (
    <>
      <PageHeader
        title="Hotspot Alerts"
        subtitle="Raised when a new high-severity hotspot area is found. Each alert lists the patient residences behind it — the addresses you follow up, not the facility that registered them."
      />

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <Bell className="h-3.5 w-3.5 text-vigil-500" />
            Alert inbox
            {unreadCount > 0 && (
              <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full border border-vigil-400/50 bg-vigil-300/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold tabular-nums text-vigil-600">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <ListSkeleton rows={5} />
        ) : list.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <BellOff className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              No alerts yet. An alert appears here when a new high-severity
              hotspot area is found — run a check from the{" "}
              <span className="font-semibold text-slate-700">Hotspots</span>{" "}
              page.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((a) => {
              const unread = !a.read_at;
              const h = a.hotspots;
              const color = h ? SEVERITY_COLOR[h.severity] : "#64748b";
              return (
                <li
                  key={a.id}
                  className="flex items-start gap-3 border-l-2 px-4 py-3 transition"
                  style={{
                    borderLeftColor: unread ? color : "transparent",
                    background: unread ? `${color}0d` : undefined,
                  }}
                >
                  <span
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      color,
                      borderColor: `${color}40`,
                      background: `${color}14`,
                    }}
                  >
                    <Bell className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                      {h ? barangayName(h.barangay_psgc) : "(hotspot deleted)"}
                      {/* A cluster filed under Calinan can still be alerting
                          you because your own residents are in it. Say so in
                          the title, or the row looks like another area's
                          problem. */}
                      {h && (h.barangay_psgcs?.length ?? 0) > 1 && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          spans {h.barangay_psgcs!.length} barangays
                        </span>
                      )}
                      {h && <SeverityChip severity={h.severity} />}
                      {unread && (
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: color }}
                        />
                      )}
                    </div>
                    {h && (
                      <div className="mt-0.5 text-xs text-slate-600">
                        {h.case_count} cases · {h.radius_km.toFixed(1)} km
                        radius · detected {formatDateTime(h.detected_at)}
                      </div>
                    )}
                    {h && (
                      <Residences
                        caseIds={h.case_ids ?? []}
                        caseCount={h.case_count}
                        caseById={caseById}
                        facilityById={facilityById}
                        scope={scope}
                      />
                    )}
                    <div className="mt-1.5 text-xs text-slate-400">
                      Notified {formatDateTime(a.created_at)}
                    </div>
                  </div>
                  {unread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markRead(a.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

/**
 * The residences behind an alert.
 *
 * An alert that says only "21 cases in Calinan" cannot be acted on: a health
 * centre has no way to tell which of those patients are its own, and the
 * registering facility does not answer that — a Calinan resident routinely
 * registers at Mintal DOTS. So the alert carries the addresses, and residence
 * is what it leads with; the facility appears as muted provenance.
 *
 * The list is whatever `cases` RLS returned: a barangay dashboard sees its own
 * residents and nobody else's, a health centre sees those plus whatever its own
 * facility registered. When that is fewer than the cluster total, the gap is
 * stated rather than hidden — the missing cases belong to a neighbouring
 * barangay's worker.
 */
function Residences({
  caseIds,
  caseCount,
  caseById,
  facilityById,
  scope,
}: {
  caseIds: string[];
  caseCount: number;
  caseById: Map<string, CaseRef>;
  facilityById: Map<string, string>;
  scope: AreaScope;
}) {
  const visible = useMemo(() => {
    const rows = caseIds
      .map((id) => caseById.get(id))
      .filter((c): c is CaseRef => Boolean(c));
    // Own residents first — that is the worker's follow-up list. A case shown
    // to them because their clinic registered it still matters, but it is
    // somebody else's barangay to trace.
    if (!scope.scoped || scope.psgc === null) return rows;
    return [
      ...rows.filter((c) => c.barangay_psgc === scope.psgc),
      ...rows.filter((c) => c.barangay_psgc !== scope.psgc),
    ];
  }, [caseIds, caseById, scope.scoped, scope.psgc]);

  const inMyArea =
    scope.scoped && scope.psgc !== null
      ? visible.filter((c) => c.barangay_psgc === scope.psgc).length
      : null;

  if (caseIds.length === 0) {
    return (
      <p className="mt-1.5 text-xs text-slate-500">
        No case addresses attached — this hotspot was recorded before alerts
        carried residences.
      </p>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Patient residences
        </span>
        {inMyArea !== null && (
          <span className="text-xs font-semibold text-slate-700">
            {inMyArea} of {caseCount} live in {scope.name ?? "your area"}
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="mt-1.5 text-xs text-slate-500">
          {scope.clinicScoped
            ? "None of these patients live in your area or registered at your facility, so their addresses stay with the barangay that handles them."
            : "None of these patients live in your barangay, so their addresses stay with the barangay that handles them."}
        </p>
      ) : (
        <>
          <ul className="mt-1.5 space-y-1.5">
            {visible.slice(0, MAX_ADDRESSES_SHOWN).map((c) => {
              const facility = c.facility_id
                ? facilityById.get(c.facility_id)
                : null;
              const mine = scope.scoped && c.barangay_psgc === scope.psgc;
              return (
                <li key={c.id} className="flex items-start gap-1.5 text-xs">
                  <Home
                    className={
                      "mt-0.5 h-3.5 w-3.5 shrink-0 " +
                      (mine ? "text-brand-600" : "text-slate-400")
                    }
                  />
                  <span className="min-w-0">
                    <span className="text-slate-800">
                      {c.address?.trim() || "No street address on file"}
                    </span>
                    <span className="text-slate-500">
                      {" · "}
                      {barangayName(c.barangay_psgc)}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {facility
                        ? `Registered at ${facility}`
                        : "No registering facility on file"}
                      {c.reported_at
                        ? ` · reported ${formatDateTime(c.reported_at)}`
                        : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {visible.length > MAX_ADDRESSES_SHOWN && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              +{visible.length - MAX_ADDRESSES_SHOWN} more in the Cases page.
            </p>
          )}
          {visible.length < caseCount && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              {scope.scoped
                ? `${caseCount - visible.length} other case${
                    caseCount - visible.length === 1 ? "" : "s"
                  } in this hotspot live outside your area — the barangay they reside in is alerted separately.`
                : `${caseCount - visible.length} case${
                    caseCount - visible.length === 1 ? "" : "s"
                  } from this hotspot are no longer on file.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function barangayName(psgc: number): string {
  return barangays.find((b) => b.psgc === psgc)?.name ?? "—";
}
