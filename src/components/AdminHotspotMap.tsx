import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Pane,
  Popup,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import {
  AlertTriangle,
  Activity,
  ChevronDown,
  ChevronUp,
  Flame,
  Layers,
  MapPin,
} from "lucide-react";
import { HeatmapLayer } from "./HeatmapLayer";
import { BarangayBoundaries } from "./BarangayBoundaries";
import { OpenFreeMapLayer } from "./OpenFreeMapLayer";
import type { OfmStyleName } from "../lib/openFreeMap";
import type {
  BarangayStat,
  HotspotCluster,
  HotspotInsights,
  HotspotSeverity,
} from "../lib/hotspotUtils";

const BASE_STYLES: { name: OfmStyleName; label: string }[] = [
  { name: "positron", label: "Clean" },
  { name: "liberty", label: "Detail" },
  { name: "dark", label: "Dark" },
];

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

// Canonical severities for the legend — the extra "low"/"medium" keys above
// are DB aliases and would render as duplicate rows.
const SEVERITY_ORDER: HotspotSeverity[] = ["watch", "moderate", "high", "urgent"];

const DENSITY_RAMP = ["#bae6fd", "#7dd3fc", "#0ea5e9", "#f97316", "#dc2626"];

// Shared chrome for every floating panel — the dark glass console language
// established by the public hero map (PublicCaseMap).
const GLASS =
  "rounded-xl border border-white/10 bg-brand-950/90 shadow-lift backdrop-blur";
const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400";

function barangayFill(count: number, max: number): string {
  if (max <= 0 || count <= 0) return "#cbd5e1";
  const ratio = count / max;
  if (ratio < 0.2) return DENSITY_RAMP[0];
  if (ratio < 0.4) return DENSITY_RAMP[1];
  if (ratio < 0.6) return DENSITY_RAMP[2];
  if (ratio < 0.8) return DENSITY_RAMP[3];
  return DENSITY_RAMP[4];
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

/** Hover card shared by barangay markers — name, big count, mono caption. */
function MarkerTooltip({
  stat,
  fill,
  assigned = false,
}: {
  stat: BarangayStat;
  fill: string;
  assigned?: boolean;
}) {
  return (
    <Tooltip direction="top" offset={[0, -6]} opacity={1} className="pcm-tooltip">
      <div className="pcm-tooltip-inner text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: fill }}
          />
          <span className="text-xs font-semibold text-white">{stat.name}</span>
        </div>
        <div className="mt-1 font-display text-2xl font-extrabold leading-none tracking-tight text-white">
          {stat.caseCount}
        </div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
          case{stat.caseCount === 1 ? "" : "s"}
        </div>
        {assigned && (
          <div className="mt-1 border-t border-white/10 pt-1 font-mono text-[9px] uppercase tracking-wider text-vigil-300">
            Your assigned area
          </div>
        )}
      </div>
    </Tooltip>
  );
}

/** Click-through popup shared by barangay markers — dark glass card. */
function MarkerPopup({
  stat,
  assigned = false,
}: {
  stat: BarangayStat;
  assigned?: boolean;
}) {
  return (
    <Popup className="ghm-popup">
      <div className="min-w-[190px]">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <MapPin
            className={"h-4 w-4 " + (assigned ? "text-vigil-400" : "text-accent-400")}
          />
          <span className="truncate">{stat.name}</span>
          {assigned && (
            <span className="ml-auto rounded-full border border-vigil-400/40 bg-vigil-400/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-vigil-300">
              Your area
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
              Total cases
            </div>
            <div className="font-display text-xl font-extrabold tracking-tight text-white">
              {stat.caseCount}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
              Last 30 days
            </div>
            <div className="font-display text-xl font-extrabold tracking-tight text-white">
              {stat.recentCases}
            </div>
          </div>
        </div>
        <div className="mt-2 border-t border-white/10 pt-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500">
          PSGC {stat.psgc}
        </div>
      </div>
    </Popup>
  );
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
  // Boundaries start off — the choropleth polygons are opt-in so the map
  // opens clean, with markers carrying the story by default.
  const [showBoundaries, setShowBoundaries] = useState(false);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [baseStyle, setBaseStyle] = useState<OfmStyleName>("positron");

  // Dark basemap auto-activates with the heatmap for contrast; Clean is
  // restored when the heatmap is off. Mirrors the old LayersControl behavior.
  useEffect(() => {
    setBaseStyle(showHeat ? "dark" : "positron");
  }, [showHeat]);

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

  const layerToggles = [
    {
      key: "boundaries",
      label: "Boundaries",
      icon: Layers,
      on: showBoundaries,
      dot: "#2dd4bf",
      toggle: () => setShowBoundaries((v) => !v),
    },
    {
      key: "heat",
      label: "Heat map",
      icon: Flame,
      on: showHeat,
      dot: "#fbbf24",
      toggle: () => setShowHeat((v) => !v),
    },
    {
      key: "markers",
      label: "Markers",
      icon: MapPin,
      on: showMarkers,
      dot: "#38bdf8",
      toggle: () => setShowMarkers((v) => !v),
    },
  ];

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={DAVAO_CENTER}
        zoom={DAVAO_ZOOM}
        zoomControl={false}
        style={{ height: "100%", width: "100%", background: "#061020" }}
        ref={(m: LeafletMap | null) => {
          mapRef.current = m;
        }}
      >
        <OpenFreeMapLayer styleName={baseStyle} />
        <ZoomControl position="bottomright" />

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
            <Popup className="ghm-popup">
              <div className="min-w-[210px]">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  <AlertTriangle
                    className="h-4 w-4"
                    style={{ color: SEVERITY_COLOR[cluster.severity] }}
                  />
                  Hotspot #{cluster.id + 1}
                  <span
                    className="ml-auto rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
                    style={{
                      color: SEVERITY_COLOR[cluster.severity],
                      borderColor: `${SEVERITY_COLOR[cluster.severity]}66`,
                      background: `${SEVERITY_COLOR[cluster.severity]}1a`,
                    }}
                  >
                    {SEVERITY_LABEL[cluster.severity].split(" ")[0]}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="font-display text-xl font-extrabold tracking-tight text-white">
                    {cluster.caseCount}
                  </span>
                  <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                    case{cluster.caseCount === 1 ? "" : "s"} · {SEVERITY_LABEL[cluster.severity]}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  Radius ~{cluster.radiusKm.toFixed(2)} km ·{" "}
                  {cluster.centroid.lat.toFixed(4)}, {cluster.centroid.lon.toFixed(4)}
                </div>
                {cluster.barangays.length > 0 && (
                  <div className="mt-2 border-t border-white/10 pt-2">
                    <div className="font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                      Top barangays
                    </div>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {cluster.barangays.slice(0, 5).map((b) => (
                        <li key={b.psgc} className="flex justify-between gap-2">
                          <span className="truncate text-slate-300">{b.name}</span>
                          <span className="font-semibold tabular-nums text-white">
                            {b.count}
                          </span>
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
              <MarkerTooltip
                stat={stat}
                fill={barangayFill(stat.caseCount, maxCount)}
              />
              <MarkerPopup stat={stat} />
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
              <MarkerTooltip
                stat={stat}
                fill={barangayFill(stat.caseCount, maxCount)}
                assigned
              />
              <MarkerPopup stat={stat} assigned />
            </CircleMarker>
          ))}

        <FocusController target={focusTarget} />
      </MapContainer>

      {/* ── Basemap switcher — segmented control, top-right ─────────── */}
      <div
        className={
          "pointer-events-auto absolute right-3 top-3 z-[500] flex overflow-hidden sm:right-4 sm:top-4 " +
          GLASS
        }
        role="group"
        aria-label="Basemap style"
      >
        {BASE_STYLES.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => setBaseStyle(s.name)}
            aria-pressed={baseStyle === s.name}
            className={
              "px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider transition " +
              (baseStyle === s.name
                ? "bg-white/15 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white")
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Overview + most affected — top-left console column ──────── */}
      {summary && (
        <div className="absolute left-3 top-3 z-[500] flex w-48 flex-col gap-2 sm:left-4 sm:top-4 sm:w-56">
          <div className={"px-3 py-2.5 " + GLASS}>
            <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
              <Activity className="h-3.5 w-3.5 text-accent-400" />
              TB hotspot overview
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <div className="font-display text-xl font-extrabold leading-none tracking-tight text-white">
                  {summary.totalCases.toLocaleString()}
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                  Cases
                </div>
              </div>
              <div>
                <div className="font-display text-xl font-extrabold leading-none tracking-tight text-white">
                  {summary.recentCases.toLocaleString()}
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                  {summary.recentWindowDays}-day
                </div>
              </div>
              <div>
                <div className="font-display text-xl font-extrabold leading-none tracking-tight text-white">
                  {summary.clusters.length}
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                  Hotspots
                </div>
              </div>
            </div>
          </div>

          {summary.topBarangays.length > 0 && (
            <div className={"hidden p-3 md:block " + GLASS}>
              <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
                <MapPin className="h-3.5 w-3.5 text-accent-400" />
                Most affected
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {summary.topBarangays.slice(0, 5).map((b) => (
                  <li key={b.psgc}>
                    <button
                      type="button"
                      onClick={() =>
                        mapRef.current?.flyTo([b.lat, b.lon], FOCUS_ZOOM, {
                          duration: 0.8,
                        })
                      }
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs transition hover:bg-white/10"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: barangayFill(b.caseCount, maxCount) }}
                      />
                      <span className="truncate text-slate-300">{b.name}</span>
                      <span className="ml-auto font-semibold tabular-nums text-white">
                        {b.caseCount}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Layer toggles — bottom-right, clear of the zoom control ─── */}
      <div
        className={
          "pointer-events-auto absolute bottom-3 right-14 z-[500] flex flex-col p-1 sm:bottom-4 sm:right-16 " +
          GLASS
        }
        role="group"
        aria-label="Map layers"
      >
        {layerToggles.map(({ key, label, icon: Icon, on, dot, toggle }) => (
          <button
            key={key}
            type="button"
            onClick={toggle}
            aria-pressed={on}
            className={
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition " +
              (on
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white")
            }
          >
            <Icon
              className="h-3.5 w-3.5"
              style={on ? { color: dot } : undefined}
            />
            {label}
            <span
              aria-hidden
              className="ml-auto h-1.5 w-1.5 rounded-full transition"
              style={{
                background: on ? dot : "rgba(148, 163, 184, 0.35)",
                boxShadow: on ? `0 0 6px ${dot}` : "none",
              }}
            />
          </button>
        ))}
      </div>

      {/* ── Legend — collapsible, bottom-left ───────────────────────── */}
      <div
        className={
          "pointer-events-auto absolute bottom-3 left-3 z-[500] w-48 sm:bottom-4 sm:left-4 " +
          GLASS
        }
      >
        <button
          type="button"
          onClick={() => setLegendCollapsed((v) => !v)}
          aria-expanded={!legendCollapsed}
          className={
            "flex w-full items-center justify-between gap-2 px-3 py-2 transition hover:text-white " +
            MICRO_LABEL
          }
        >
          Legend
          {legendCollapsed
            ? <ChevronUp className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {!legendCollapsed && (
          <div className="px-3 pb-2.5">
            <ul className="space-y-1">
              {SEVERITY_ORDER.map((sev) => (
                <li key={sev} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: SEVERITY_COLOR[sev] }}
                  />
                  {SEVERITY_LABEL[sev]}
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                Case density
              </div>
              <div className="mt-1 flex items-center gap-1">
                {DENSITY_RAMP.map((color) => (
                  <span
                    key={color}
                    className="h-2 flex-1 first:rounded-l-full last:rounded-r-full"
                    style={{ background: color }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
                <span>Low</span>
                <span>High</span>
              </div>
              <div className="mt-1.5 text-[10px] text-slate-500">
                Markers sized by case count.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminHotspotMap;
