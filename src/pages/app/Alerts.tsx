import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Badge, Button, Card, PageHeader, Spinner } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { formatDateTime } from "../../lib/utils";
import barangays from "../../data/barangays.json";
import { toast } from "sonner";

interface AlertRow {
  id: string;
  read_at: string | null;
  created_at: string;
  hotspot_id: string;
  hotspots: {
    barangay_psgc: number;
    case_count: number;
    severity: "low" | "medium" | "high";
    radius_km: number;
    detected_at: string;
  } | null;
}

const SEVERITY_TONE: Record<"low" | "medium" | "high", "warning" | "danger"> = {
  low: "warning",
  medium: "warning",
  high: "danger",
};

export function Alerts() {
  const [list, setList] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("hotspot_alerts")
      .select(
        "id, read_at, created_at, hotspot_id, hotspots(barangay_psgc, case_count, severity, radius_km, detected_at)"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setList((data ?? []) as unknown as AlertRow[]);
    setLoading(false);
  }

  useEffect(() => {
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
  }, []);

  async function markRead(id: string) {
    const { error } = await supabase
      .from("hotspot_alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  async function markAllRead() {
    const ids = list.filter((a) => !a.read_at).map((a) => a.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("hotspot_alerts")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
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
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          ) : null
        }
      />

      <Card className="p-0">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner />
          </div>
        ) : list.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">
            No alerts yet. Run DBSCAN from the Hotspots page to generate
            alerts.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {list.map((a) => {
              const unread = !a.read_at;
              const h = a.hotspots;
              return (
                <li
                  key={a.id}
                  className={
                    "flex items-start gap-3 px-4 py-3 " +
                    (unread ? "bg-amber-50/60" : "")
                  }
                >
                  <div
                    className={
                      "mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full " +
                      (h?.severity === "high"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700")
                    }
                  >
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {h ? barangayName(h.barangay_psgc) : "(hotspot deleted)"}
                      {h && (
                        <Badge tone={SEVERITY_TONE[h.severity]}>
                          {h.severity}
                        </Badge>
                      )}
                      {unread && (
                        <span className="rounded-full bg-red-100 px-2 text-xs font-semibold text-red-700">
                          new
                        </span>
                      )}
                    </div>
                    {h && (
                      <div className="mt-0.5 text-xs text-slate-600">
                        {h.case_count} cases · radius {h.radius_km.toFixed(1)} km
                        · detected {formatDateTime(h.detected_at)}
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
