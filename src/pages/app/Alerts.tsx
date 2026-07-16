import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { Button, Card, ListSkeleton, PageHeader } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
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
    case_count: number;
    severity: Severity;
    radius_km: number;
    detected_at: string;
  } | null;
}

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
  const recipientId = profile?.id;
  const [list, setList] = useState<AlertRow[]>([]);
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
        "id, read_at, created_at, hotspot_id, hotspots(barangay_psgc, case_count, severity, radius_km, detected_at)"
      )
      .eq("recipient_id", recipientId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setList((data ?? []) as unknown as AlertRow[]);
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

  async function markRead(id: string) {
    if (!recipientId) return;
    const { error } = await supabase
      .from("hotspot_alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("recipient_id", recipientId);
    if (error) toast.error(error.message);
    else load();
  }

  async function markAllRead() {
    if (!recipientId) return;
    const ids = list.filter((a) => !a.read_at).map((a) => a.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("hotspot_alerts")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids)
      .eq("recipient_id", recipientId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Marked ${ids.length} alert(s) as read`);
      load();
    }
  }

  const unreadCount = list.filter((a) => !a.read_at).length;

  return (
    <>
      <PageHeader
        title="Hotspot Alerts"
        subtitle="DBSCAN-detected clusters that require frontline follow-up."
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
              No alerts yet. Run DBSCAN from the{" "}
              <span className="font-semibold text-slate-700">Hotspots</span>{" "}
              page to generate alerts.
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
                    <div className="mt-0.5 text-xs text-slate-400">
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

function barangayName(psgc: number): string {
  return barangays.find((b) => b.psgc === psgc)?.name ?? "—";
}
