import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  CircleMarker,
  LayersControl,
  MapContainer,
  Pane,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import {
  AlertTriangle,
  Activity,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Flame,
  Layers,
  MapPin,
} from "lucide-react";
import { HeatmapLayer } from "./HeatmapLayer";
import { BarangayBoundaries } from "./BarangayBoundaries";
import type {
  BarangayStat,
  HotspotCluster,
  HotspotInsights,
  HotspotSeverity,
} from "../lib/hotspotUtils";

interface AdminHotspotMapProps {
  hotspotInsights: HotspotInsights | null;
  focusBarangay?: string | null;
  highlightPsgc?: number | null;
  heatPoints?: [number, number][];
}

const DAVAO_CENTER: [number, number] = [7.0731, 125.6128];
const DAVAO_ZOOM = 11;
const FOCUS_ZOOM = 14;

const SEVERITY_COLOR: Record<HotspotSeverity, string> = {
  watch: "#60a5fa",
  moderate: "#f59e0b",
  high: "#ea580c",
  urgent: "#dc2626",
  low: "#60a5fa",
  medium: "#f59e0b",
};

const SEVERITY_LABEL: Record<HotspotSeverity, string> = {
  watch: "Watch (routine)",
  moderate: "Moderate (monitor)",
  high: "High (enhanced)",
  urgent: "Urgent (intervene)",
  low: "Watch (routine)",
  medium: "Moderate (monitor)",
};

function barangayFill(count: number, max: number): string {
  if (max <= 0 || count <= 0) return "#cbd5e1";
  const ratio = count / max;
  if (ratio < 0.2) return "#bae6fd";
  if (ratio < 0.4) return "#7dd3fc";
  if (ratio < 0.6) return "#0ea5e9";
  if (ratio < 0.8) return "#f97316";
  return "#dc2626";
}

function barangayRadius(count: number, max: number): number {
  if (max <= 0) return 5;
  const ratio = Math.sqrt(Math.max(count, 0.5) / Math.max(max, 1));
  return 5 + ratio * 14;
}

function FocusController({
  target,
}: {
  target: { lat: number; lon: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lon], FOCUS_ZOOM, { duration: 0.8 });
  }, [target, map]);
  return null;
}

export function AdminHotspotMap({
  hotspotInsights,
  focusBarangay,
  highlightPsgc = null,
  heatPoints = [],
}: AdminHotspotMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [showHeat, setShowHeat] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(false);

  const barangayStats: BarangayStat[] = useMemo(
    () => hotspotInsights?.barangayStats ?? [],
    [hotspotInsights]
  );
  const clusters: HotspotCluster[] = useMemo(
    () => hotspotInsights?.clusters ?? [],
    [hotspotInsights]
  );
  const maxCount = useMemo(
    () => barangayStats.reduce((m, s) => Math.max(m, s.caseCount), 0),
    [barangayStats]
  );

  const focusTarget = useMemo(() => {
    if (!focusBarangay) return null;
    const needle = focusBarangay.trim().toLowerCase();
    if (!needle) return null;
    const match = barangayStats.find(
      (s) =>
        s.name.toLowerCase() === needle ||
        s.name.toLowerCase().includes(needle) ||
        String(s.psgc) === needle
    );
    if (!match) return null;
    return { lat: match.lat, lon: match.lon };
  }, [focusBarangay, barangayStats]);

  const summary = hotspotInsights;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={DAVAO_CENTER}
        zoom={DAVAO_ZOOM}
        zoomControl
        style={{ height: "100%", width: "100%" }}
        ref={(m: LeafletMap | null) => {
          mapRef.current = m;
        }}
      >
        {/* LayersControl re-mounts when showHeat changes so the checked base
            layer prop is picked up fresh — Dark Matter auto-activates with the
            heatmap, Light is restored when heatmap is off. */}
        <LayersControl key={showHeat ? "lc-dark" : "lc-light"} position="topright">
          <LayersControl.BaseLayer checked={!showHeat} name="Clean (Carto Light)">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              subdomains={["a", "b", "c", "d"]}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Detail (Carto Voyager)">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains={["a", "b", "c", "d"]}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked={showHeat} name="Dark (Carto Dark Matter)">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains={["a", "b", "c", "d"]}
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {showBoundaries && (
          <BarangayBoundaries
            barangayStats={barangayStats}
            maxCount={maxCount}
            fillFn={barangayFill}
          />
        )}

        {/* Cluster panes — render cluster halos below barangay markers so the
            markers stay clearly visible inside the cluster. */}
        <Pane name="cluster-halo" style={{ zIndex: 410 }} />
        <Pane name="cluster-core" style={{ zIndex: 415 }} />
        <Pane name="barangay-markers" style={{ zIndex: 425 }} />
        {/* Assigned-area marker renders above all others so it's never hidden */}
        <Pane name="assigned-area" style={{ zIndex: 440 }} />

        {showHeat && heatPoints.length > 0 && (
          <HeatmapLayer points={heatPoints} />
        )}

        {showMarkers && clusters.map((cluster) => (
          <Circle
            key={`cluster-halo-${cluster.id}`}
            center={[cluster.centroid.lat, cluster.centroid.lon]}
            radius={cluster.radiusKm * 1000}
            pane="cluster-halo"
            pathOptions={{
              color: SEVERITY_COLOR[cluster.severity],
              fillColor: SEVERITY_COLOR[cluster.severity],
              fillOpacity: 0.12,
              weight: 1,
              dashArray: "4 4",
            }}
          />
        ))}

        {showMarkers && clusters.map((cluster) => (
          <Circle
            key={`cluster-core-${cluster.id}`}
            center={[cluster.centroid.lat, cluster.centroid.lon]}
            radius={Math.max(120, cluster.radiusKm * 220)}
            pane="cluster-core"
            pathOptions={{
              color: SEVERITY_COLOR[cluster.severity],
              fillColor: SEVERITY_COLOR[cluster.severity],
              fillOpacity: 0.45,
              weight: 2,
            }}
          >
            <Popup>
              <div className="min-w-[200px] text-sm">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <AlertTriangle
                    className="h-4 w-4"
                    style={{ color: SEVERITY_COLOR[cluster.severity] }}
                  />
                  Hotspot #{cluster.id + 1}
                </div>
                <div className="mt-1 text-slate-700">
                  <span className="font-semibold">{cluster.caseCount}</span>{" "}
                  case(s) · {SEVERITY_LABEL[cluster.severity]}
                </div>
                <div className="text-xs text-slate-500">
                  Radius ~{cluster.radiusKm.toFixed(2)} km · centroid{" "}
                  {cluster.centroid.lat.toFixed(4)},{" "}
                  {cluster.centroid.lon.toFixed(4)}
                </div>
                {cluster.barangays.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Top barangays
                    </div>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                      {cluster.barangays.slice(0, 5).map((b) => (
                        <li
                          key={b.psgc}
                          className="flex justify-between gap-2"
                        >
                          <span>{b.name}</span>
                          <span className="font-semibold">{b.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Popup>
          </Circle>
        ))}

        {showMarkers && barangayStats
          .filter((stat) => stat.psgc !== highlightPsgc)
          .map((stat) => (
            <CircleMarker
              key={`bgy-${stat.psgc}`}
              center={[stat.lat, stat.lon]}
              radius={barangayRadius(stat.caseCount, maxCount)}
              pane="barangay-markers"
              pathOptions={{
                color: "#0f172a",
                weight: 0.8,
                fillColor: barangayFill(stat.caseCount, maxCount),
                fillOpacity: 0.85,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                <span className="text-xs">
                  <strong>{stat.name}</strong> — {stat.caseCount}
                </span>
              </Tooltip>
              <Popup>
                <div className="min-w-[180px] text-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <MapPin className="h-4 w-4 text-brand-600" />
                    {stat.name}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500">Total cases</div>
                      <div className="text-base font-semibold text-slate-900">
                        {stat.caseCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Last 30 days</div>
                      <div className="text-base font-semibold text-slate-900">
                        {stat.recentCases}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    PSGC {stat.psgc}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* Assigned-area marker: rendered last so it's on top with a distinct
            gold ring to immediately draw the health worker's eye to their zone. */}
        {showMarkers && barangayStats
          .filter((stat) => stat.psgc === highlightPsgc)
          .map((stat) => (
            <CircleMarker
              key={`bgy-assigned-${stat.psgc}`}
              center={[stat.lat, stat.lon]}
              radius={barangayRadius(stat.caseCount, maxCount) + 4}
              pane="assigned-area"
              pathOptions={{
                color: "#f59e0b",
                weight: 3,
                fillColor: barangayFill(stat.caseCount, maxCount),
                fillOpacity: 0.92,
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -6]}
                opacity={0.97}
                permanent={false}
              >
                <span className="text-xs">
                  <strong>{stat.name}</strong> — {stat.caseCount} cases · Your assigned area
                </span>
              </Tooltip>
              <Popup>
                <div className="min-w-[180px] text-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-brand-700">
                    <MapPin className="h-4 w-4 text-amber-500" />
                    {stat.name}
                    <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      Your area
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500">Total cases</div>
                      <div className="text-base font-semibold text-slate-900">
                        {stat.caseCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Last 30 days</div>
                      <div className="text-base font-semibold text-slate-900">
                        {stat.recentCases}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    PSGC {stat.psgc}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        <FocusController target={focusTarget} />
      </MapContainer>

      {/* Stats overlay. Offset to the right so it sits past the zoom control. */}
      {summary && (
        <div className="pointer-events-none absolute left-12 top-3 z-[500] flex flex-col gap-2 sm:left-14 sm:top-4">
          <div
            className={
              "pointer-events-auto rounded-xl border px-3 py-2 shadow-md backdrop-blur " +
              (showHeat
                ? "border-slate-700 bg-slate-900/90 text-white"
                : "border-slate-200 bg-white/95 text-slate-900")
            }
          >
            <div
              className={
                "flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide " +
                (showHeat ? "text-slate-400" : "text-slate-500")
              }
            >
              <Activity className="h-3.5 w-3.5 text-brand-400" />
              TB hotspot overview
            </div>
            <div className="mt-1 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold">
                  {summary.totalCases.toLocaleString()}
                </div>
                <div className={showHeat ? "text-[10px] text-slate-400" : "text-[10px] text-slate-500"}>Total cases</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {summary.recentCases.toLocaleString()}
                </div>
                <div className={showHeat ? "text-[10px] text-slate-400" : "text-[10px] text-slate-500"}>
                  Last {summary.recentWindowDays}d
                </div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {summary.clusters.length}
                </div>
                <div className={showHeat ? "text-[10px] text-slate-400" : "text-[10px] text-slate-500"}>Hotspots</div>
              </div>
            </div>
          </div>

          {summary.topBarangays.length > 0 && (
            <div
              className={
                "pointer-events-auto max-w-[15rem] rounded-xl border p-3 shadow-md backdrop-blur " +
                (showHeat
                  ? "border-slate-700 bg-slate-900/90"
                  : "border-slate-200 bg-white/95")
              }
            >
              <div
                className={
                  "flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide " +
                  (showHeat ? "text-slate-400" : "text-slate-500")
                }
              >
                <CalendarClock className="h-3.5 w-3.5 text-brand-400" />
                Top barangays
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs">
                {summary.topBarangays.slice(0, 5).map((b) => (
                  <li key={b.psgc} className="flex justify-between gap-2">
                    <span className={showHeat ? "truncate text-slate-300" : "truncate text-slate-700"}>{b.name}</span>
                    <span className={showHeat ? "font-semibold tabular-nums text-white" : "font-semibold tabular-nums text-slate-900"}>
                      {b.caseCount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Layer toggles — bottom-right, clear of the zoom control and legend */}
      <div className="pointer-events-auto absolute bottom-3 right-3 z-[500] flex flex-col gap-1.5 sm:bottom-4 sm:right-4">
        <button
          type="button"
          onClick={() => setShowBoundaries((v) => !v)}
          className={
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur transition " +
            (showBoundaries
              ? "border-teal-400 bg-teal-500 text-white hover:bg-teal-600"
              : "border-slate-200 bg-white/95 text-slate-600 hover:text-slate-800")
          }
        >
          <Layers className="h-3.5 w-3.5" />
          {showBoundaries ? "Boundaries ON" : "Boundaries"}
        </button>
        <button
          type="button"
          onClick={() => setShowHeat((v) => !v)}
          className={
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur transition " +
            (showHeat
              ? "border-amber-400 bg-amber-500 text-white hover:bg-amber-600"
              : "border-slate-200 bg-white/95 text-slate-600 hover:text-slate-800")
          }
        >
          <Flame className="h-3.5 w-3.5" />
          {showHeat ? "Heat map ON" : "Heat map"}
        </button>
        <button
          type="button"
          onClick={() => setShowMarkers((v) => !v)}
          className={
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold shadow-md backdrop-blur transition " +
            (showMarkers
              ? "border-brand-400 bg-brand-600 text-white hover:bg-brand-700"
              : "border-slate-200 bg-white/95 text-slate-600 hover:text-slate-800")
          }
        >
          <MapPin className="h-3.5 w-3.5" />
          {showMarkers ? "Markers ON" : "Markers"}
        </button>
      </div>

      {/* Legend — collapsible */}
      <div
        className={
          "pointer-events-auto absolute bottom-3 left-3 z-[500] rounded-xl border text-[11px] shadow-md backdrop-blur sm:bottom-4 sm:left-4 " +
          (showHeat
            ? "border-slate-700 bg-slate-900/90 text-slate-300"
            : "border-slate-200 bg-white/95 text-slate-600")
        }
      >
        <button
          type="button"
          onClick={() => setLegendCollapsed((v) => !v)}
          className={
            "flex w-full items-center justify-between gap-2 px-3 py-2 " +
            (showHeat ? "font-semibold uppercase tracking-wide text-slate-400" : "font-semibold uppercase tracking-wide text-slate-500")
          }
        >
          Hotspot density
          {legendCollapsed
            ? <ChevronUp className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {!legendCollapsed && (
          <div className="px-3 pb-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {(Object.keys(SEVERITY_COLOR) as HotspotSeverity[]).map((sev) => (
                <span key={sev} className="inline-flex items-center gap-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: SEVERITY_COLOR[sev] }}
                  />
                  <span>{SEVERITY_LABEL[sev]}</span>
                </span>
              ))}
            </div>
            <div className="mt-1">Markers sized by case count.</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminHotspotMap;
