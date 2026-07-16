import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, Tooltip, ZoomControl } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import { Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { Spinner } from "../../components/ui";
import { OpenFreeMapLayer } from "../../components/OpenFreeMapLayer";
import { supabase } from "../../lib/supabase";
import { dbscan, type DbscanPoint } from "../../lib/dbscan";
import { loadDbscanSettings } from "../../lib/dbscanSettings";
import { formatDateTime } from "../../lib/utils";
import barangays from "../../data/barangays.json";
import { toast } from "sonner";

type Severity = "watch" | "moderate" | "high" | "urgent" | "low" | "medium";

interface Hotspot {
  id: string;
  barangay_psgc: number;
  case_count: number;
  density: number;
  severity: Severity;
  detected_at: string;
  centroid_lat: number;
  centroid_lon: number;
  radius_km: number;
}

const SEVERITY_COLOR: Record<Severity, string> = {
  watch: "#60a5fa",
  moderate: "#fbbf24",
  high: "#f97316",
  urgent: "#dc2626",
  low: "#60a5fa",
  medium: "#fbbf24",
};

// Canonical severities for the legend — "low"/"medium" are DB aliases.
const SEVERITY_ORDER: Severity[] = ["watch", "moderate", "high", "urgent"];

// Dark glass console chrome — shared language with the GIS map overlays.
const GLASS =
  "rounded-xl border border-white/10 bg-brand-950/90 shadow-lift backdrop-blur";
const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400";

function SeverityChip({ severity }: { severity: Severity }) {
  const c = SEVERITY_COLOR[severity];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
      style={{ color: c, borderColor: `${c}66`, background: `${c}1a` }}
    >
      {severity}
    </span>
  );
}

export function Hotspots() {
  const [list, setList] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

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
        const severity: Severity =
          cl.points.length >= 50 ? "urgent" : cl.points.length >= 20 ? "high" : cl.points.length >= 10 ? "moderate" : "watch";
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

      const { data: insertedHotspots, error: insErr } = await supabase
        .from("hotspots")
        .insert(inserts)
        .select("id, severity, barangay_psgc");
      if (insErr) throw insErr;

      // Fan-out alerts for high/urgent clusters — mirrors edge function logic.
      const highClusters = (insertedHotspots ?? []).filter(
        (h) => h.severity === "high" || h.severity === "urgent"
      );
      if (highClusters.length > 0) {
        const { data: staff } = await supabase
          .from("profiles")
          .select("id, role, barangay_psgc")
          .in("role", ["tb_coordinator", "barangay_admin", "health_worker", "system_admin"]);
        const alerts: { hotspot_id: string; recipient_id: string }[] = [];
        for (const h of highClusters) {
          for (const p of staff ?? []) {
            if (p.role === "tb_coordinator" || p.role === "system_admin") {
              alerts.push({ hotspot_id: h.id, recipient_id: p.id });
            } else if (
              p.barangay_psgc != null &&
              h.barangay_psgc != null &&
              p.barangay_psgc === h.barangay_psgc
            ) {
              alerts.push({ hotspot_id: h.id, recipient_id: p.id });
            }
          }
        }
        if (alerts.length > 0) {
          await supabase.from("hotspot_alerts").insert(alerts);
        }
      }

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
  const urgentCount = useMemo(
    () => list.filter((h) => h.severity === "urgent" || h.severity === "high").length,
    [list]
  );

  function flyTo(h: Hotspot) {
    mapRef.current?.flyTo([h.centroid_lat, h.centroid_lon], 13.5, {
      duration: 0.8,
    });
  }

  return (
    <div className="relative isolate h-full overflow-hidden bg-brand-950">
      {/* ── Cluster map — full-bleed dark surveillance console ────────── */}
      <MapContainer
        center={center}
        zoom={11}
        zoomControl={false}
        style={{ height: "100%", width: "100%", background: "#061020" }}
        ref={(m: LeafletMap | null) => {
          mapRef.current = m;
        }}
      >
            <OpenFreeMapLayer styleName="dark" />
            <ZoomControl position="bottomleft" />
            {list.map((h) => {
              const color = SEVERITY_COLOR[h.severity];
              const r = Math.min(40, 8 + h.case_count * 0.6);
              return (
                <Fragment key={h.id}>
                  {/* Soft halo — blurred via CSS so the cluster melts into
                      the basemap instead of cutting off sharply. */}
                  <CircleMarker
                    center={[h.centroid_lat, h.centroid_lon]}
                    radius={r + 7}
                    interactive={false}
                    pathOptions={{
                      className: "pcm-glow",
                      stroke: false,
                      fillColor: color,
                      fillOpacity: 0.3,
                    }}
                  />
                  <CircleMarker
                    center={[h.centroid_lat, h.centroid_lon]}
                    radius={r}
                    pathOptions={{
                      className: "pcm-core",
                      color,
                      opacity: 0.85,
                      weight: 1.5,
                      fillColor: color,
                      fillOpacity: 0.5,
                    }}
                  >
                    <Tooltip
                      direction="top"
                      offset={[0, -8]}
                      opacity={1}
                      className="pcm-tooltip"
                    >
                      <div className="pcm-tooltip-inner text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ background: color }}
                          />
                          <span className="text-xs font-semibold text-white">
                            {barangayName(h.barangay_psgc)}
                          </span>
                        </div>
                        <div className="mt-1 font-display text-2xl font-extrabold leading-none tracking-tight text-white">
                          {h.case_count}
                        </div>
                        <div
                          className="mt-1 font-mono text-[9px] uppercase tracking-wider"
                          style={{ color }}
                        >
                          {h.severity}
                        </div>
                      </div>
                    </Tooltip>
                    <Popup className="ghm-popup">
                      <div className="min-w-[190px]">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                          <AlertTriangle
                            className="h-4 w-4"
                            style={{ color }}
                          />
                          <span className="truncate">
                            {barangayName(h.barangay_psgc)}
                          </span>
                          <span className="ml-auto">
                            <SeverityChip severity={h.severity} />
                          </span>
                        </div>
                        <div className="mt-2">
                          <span className="font-display text-xl font-extrabold tracking-tight text-white">
                            {h.case_count}
                          </span>
                          <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                            case{h.case_count === 1 ? "" : "s"} · ~{h.radius_km.toFixed(1)} km radius
                          </span>
                        </div>
                        <div className="mt-2 border-t border-white/10 pt-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                          Detected {formatDateTime(h.detected_at)}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                </Fragment>
              );
            })}
      </MapContainer>

      {/* ── Title + action — top-left console panel ─────────────────── */}
      <div className={"absolute left-3 top-3 z-[500] w-60 p-3 sm:left-4 sm:top-4 " + GLASS}>
        <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
          <AlertTriangle className="h-3.5 w-3.5 text-vigil-400" />
          Hotspot detection
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          DBSCAN clustering across the configured lookback window. Re-runs
          automatically when new cases are imported.
        </p>
        <button
          type="button"
          onClick={recompute}
          disabled={running}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-2.5 py-2 text-[11px] font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <Spinner className="h-3.5 w-3.5 text-accent-400" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Re-run DBSCAN
        </button>
      </div>

      {/* ── Detections chip — compact, only while the rail is hidden ─── */}
      <div className="pointer-events-none absolute right-3 top-3 z-[500] md:hidden">
        <div className={"pointer-events-auto flex items-center gap-2 px-3 py-2 " + GLASS}>
          <Activity className="h-4 w-4 text-accent-400" />
          <div>
            <div className="font-display text-lg font-extrabold leading-none tracking-tight text-white">
              {list.length}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              detection{list.length === 1 ? "" : "s"} · {urgentCount} high+
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent hotspots — right rail over the map ───────────────── */}
      <div
        className={
          "absolute bottom-3 right-3 top-3 z-[500] hidden w-72 flex-col overflow-hidden md:flex sm:bottom-4 sm:right-4 sm:top-4 " +
          GLASS
        }
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <AlertTriangle className="h-3.5 w-3.5 text-vigil-400" />
            Recent hotspots
          </div>
          {list.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {list.length} · {urgentCount} high+
            </span>
          )}
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner className="text-accent-400" />
          </div>
        ) : list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            No hotspots detected yet. Click “Re-run DBSCAN”.
          </p>
        ) : (
          <ul className="flex-1 divide-y divide-white/5 overflow-y-auto">
            {list.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => flyTo(h)}
                  className="w-full px-4 py-3 text-left transition hover:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-white">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: SEVERITY_COLOR[h.severity],
                          boxShadow: `0 0 6px ${SEVERITY_COLOR[h.severity]}`,
                        }}
                      />
                      <span className="truncate">
                        {barangayName(h.barangay_psgc)}
                      </span>
                    </span>
                    <SeverityChip severity={h.severity} />
                  </div>
                  <div className="mt-1 pl-4 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {h.case_count} cases · {h.radius_km.toFixed(1)} km ·{" "}
                    {formatDateTime(h.detected_at)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Severity legend — bottom-left, clear of the zoom control ── */}
      <div className={"absolute bottom-3 left-14 z-[500] px-3 py-2 sm:bottom-4 sm:left-16 " + GLASS}>
        <div className={MICRO_LABEL}>Severity</div>
        <div className="mt-1 flex items-center gap-3">
          {SEVERITY_ORDER.map((sev) => (
            <span
              key={sev}
              className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-slate-300"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: SEVERITY_COLOR[sev] }}
              />
              {sev}
            </span>
          ))}
        </div>
      </div>

      {/* ── Empty overlay — map stays visible behind ────────────────── */}
      {!loading && list.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] grid place-items-center bg-brand-950/50 backdrop-blur-sm">
          <p className="max-w-xs px-6 text-center text-sm text-slate-300">
            No hotspots detected yet. Run{" "}
            <span className="font-semibold text-white">Re-run DBSCAN</span>{" "}
            to scan recent cases for clusters.
          </p>
        </div>
      )}
    </div>
  );
}

function barangayName(psgc: number): string {
  return barangays.find((b) => b.psgc === psgc)?.name ?? "—";
}
