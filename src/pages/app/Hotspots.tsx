import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Badge, Button, Card, PageHeader, Spinner } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { dbscan, type DbscanPoint } from "../../lib/dbscan";
import { loadDbscanSettings } from "../../lib/dbscanSettings";
import { formatDateTime } from "../../lib/utils";
import barangays from "../../data/barangays.json";
import { toast } from "sonner";

interface Hotspot {
  id: string;
  barangay_psgc: number;
  case_count: number;
  density: number;
  severity: "low" | "medium" | "high";
  detected_at: string;
  centroid_lat: number;
  centroid_lon: number;
  radius_km: number;
}

const SEVERITY_COLOR: Record<Hotspot["severity"], string> = {
  low: "#fbbf24",
  medium: "#f97316",
  high: "#dc2626",
};

const SEVERITY_TONE: Record<Hotspot["severity"], "warning" | "danger"> = {
  low: "warning",
  medium: "warning",
  high: "danger",
};

export function Hotspots() {
  const [list, setList] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("hotspots")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setList((data ?? []) as Hotspot[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("hotspots")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hotspots" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function recompute() {
    setRunning(true);
    try {
      const settings = await loadDbscanSettings();
      const since = new Date();
      since.setDate(since.getDate() - settings.window_days);
      const { data, error } = await supabase
        .from("cases")
        .select("id, barangay_psgc, jitter_lat, jitter_lon")
        .gte("reported_at", since.toISOString())
        .limit(20000);
      if (error) throw error;
      const points: DbscanPoint[] = (data ?? []).map(
        (c: { id: string; jitter_lat: number; jitter_lon: number }) => ({
          id: c.id,
          lat: c.jitter_lat,
          lon: c.jitter_lon,
        })
      );
      const clusters = dbscan(points, settings.eps_km, settings.min_pts);

      const inserts = clusters.map((cl) => {
        // Most-represented barangay in the cluster
        const counts = new Map<number, number>();
        for (const p of cl.points) {
          const cs = (data ?? []).find(
            (c: { id: string }) => c.id === p.id
          ) as { barangay_psgc: number } | undefined;
          if (!cs) continue;
          counts.set(cs.barangay_psgc, (counts.get(cs.barangay_psgc) ?? 0) + 1);
        }
        const topBgy = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const radii = cl.points.map((p) => {
          const dLat = p.lat - cl.centroid.lat;
          const dLon = p.lon - cl.centroid.lon;
          return Math.sqrt(dLat * dLat + dLon * dLon) * 111;
        });
        const radius_km = Math.max(0.3, Math.max(...radii));
        const density = cl.points.length / (Math.PI * radius_km * radius_km);
        const severity =
          cl.points.length >= 25 ? "high" : cl.points.length >= 15 ? "medium" : "low";
        return {
          barangay_psgc: topBgy ?? barangays[0].psgc,
          disease: "tb" as const,
          case_count: cl.points.length,
          density,
          severity,
          window_start: since.toISOString(),
          window_end: new Date().toISOString(),
          centroid_lat: cl.centroid.lat,
          centroid_lon: cl.centroid.lon,
          radius_km,
        };
      });

      const { error: insErr } = await supabase.from("hotspots").insert(inserts);
      if (insErr) throw insErr;
      toast.success(`Detected ${inserts.length} hotspot cluster(s)`);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  }

  const center = useMemo<[number, number]>(() => [7.0731, 125.6128], []);

  return (
    <>
      <PageHeader
        title="Hotspot Detection"
        subtitle="DBSCAN clustering across the last 90 days. Re-runs automatically when new cases are imported."
        actions={
          <Button
            variant="secondary"
            onClick={recompute}
            disabled={running}
          >
            {running ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Re-run DBSCAN
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="overflow-hidden p-0">
          <MapContainer
            center={center}
            zoom={11}
            style={{ height: 540, width: "100%" }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {list.map((h) => (
              <CircleMarker
                key={h.id}
                center={[h.centroid_lat, h.centroid_lon]}
                radius={Math.min(40, 8 + h.case_count * 0.6)}
                pathOptions={{
                  color: SEVERITY_COLOR[h.severity],
                  fillColor: SEVERITY_COLOR[h.severity],
                  fillOpacity: 0.45,
                }}
              >
                <Popup>
                  <div>
                    <div className="font-semibold">
                      {barangayName(h.barangay_psgc)}
                    </div>
                    <div className="text-xs text-slate-600">
                      {h.case_count} cases · radius {h.radius_km.toFixed(1)} km
                    </div>
                    <div className="text-xs">
                      Severity: <strong>{h.severity}</strong>
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(h.detected_at)}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </Card>

        <Card className="p-0">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            Recent hotspots
          </div>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : list.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No hotspots detected yet. Click "Re-run DBSCAN".
            </p>
          ) : (
            <ul className="max-h-[480px] divide-y divide-slate-200 overflow-y-auto">
              {list.map((h) => (
                <li key={h.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-slate-900">
                      <AlertTriangle
                        className="h-4 w-4"
                        style={{ color: SEVERITY_COLOR[h.severity] }}
                      />
                      {barangayName(h.barangay_psgc)}
                    </span>
                    <Badge tone={SEVERITY_TONE[h.severity]}>
                      {h.severity}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {h.case_count} cases · {h.radius_km.toFixed(1)} km radius ·{" "}
                    {formatDateTime(h.detected_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function barangayName(psgc: number): string {
  return barangays.find((b) => b.psgc === psgc)?.name ?? "—";
}
