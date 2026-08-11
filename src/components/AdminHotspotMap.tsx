import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  Polyline,
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
  Cross,
  Flame,
  Layers,
  MapPin,
  X,
} from "lucide-react";
import { HeatmapLayer } from "./HeatmapLayer";
import { BarangayBoundaries } from "./BarangayBoundaries";
import { OpenFreeMapLayer } from "./OpenFreeMapLayer";
import { LatLngBounds, divIcon } from "leaflet";
import type { OfmStyleName } from "../lib/openFreeMap";
import type {
  BarangayStat,
  CaseAttribution,
  CasePin,
  FacilityFlowStat,
  HotspotCluster,
  HotspotInsights,
  HotspotSeverity,
} from "../lib/hotspotUtils";
import { attributionPsgc } from "../lib/hotspotUtils";

const BASE_STYLES: { name: OfmStyleName; label: string }[] = [
  { name: "positron", label: "Clean" },
  { name: "liberty", label: "Detail" },
  { name: "dark", label: "Dark" },
];

interface AdminHotspotMapProps {
  hotspotInsights: HotspotInsights | null;
  /** Which barangay a case is counted under. */
  attribution?: CaseAttribution;
  onAttributionChange?: (next: CaseAttribution) => void;
  /** DOTS facilities with their patients' residence-barangay breakdown. */
  facilityFlows?: FacilityFlowStat[];
  /** One pin per case, carrying both its home and its registering facility.
   *  Drives the drill-down in either direction. */
  casePins?: CasePin[];
  focusBarangay?: string | null;
  highlightPsgc?: number | null;
  heatPoints?: [number, number][];
  /**
   * One line explaining whose cases are on the map. Area staff can see cases
   * whose patients live outside their barangay when the case was registered
   * at a facility inside it, so markers legitimately appear elsewhere —
   * without a note that reads as a bug.
   */
  scopeNote?: string | null;
}

// Opening view: framed on the Davao City urban core (Agdao / Bajada / Ma-a),
// zoomed in tight so the map lands on the city instead of the wider region.
const DAVAO_CENTER: [number, number] = [7.08, 125.555];
const DAVAO_ZOOM = 13;
const FOCUS_ZOOM = 14;
// Drilling into a marker goes one step tighter than a plain focus, so the
// individual case dots separate instead of piling on top of each other.
const SPREAD_ZOOM = 15;

// Keep the view on Davao City: a hard wall around the city extent plus a
// minimum zoom so users can't pan or zoom out into neighbouring areas. The
// bounds are padded slightly beyond the barangay bbox (lat 6.96–7.57,
// lon 125.22–125.68) so the whole city stays reachable.
const DAVAO_BOUNDS = new LatLngBounds([6.82, 125.05], [7.72, 125.83]);
const MIN_ZOOM = 10;

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

// Teal marks everything facility-related — markers, flow lines, origin dots —
// so the treatment axis is visually separate from the blue-red case ramp.
const FACILITY_COLOR = "#2dd4bf";

const FACILITY_CROSS_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>';

function facilityIcon(active: boolean, dimmed: boolean) {
  return divIcon({
    className: "ahm-facility-icon",
    html: `<div class="ahm-facility${active ? " is-active" : ""}${
      dimmed ? " is-dim" : ""
    }">${FACILITY_CROSS_SVG}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
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
  attribution,
  assigned = false,
  open = false,
}: {
  stat: BarangayStat;
  fill: string;
  attribution: CaseAttribution;
  assigned?: boolean;
  /** True when this barangay is the one currently drilled into. */
  open?: boolean;
}) {
  const byFacility = attribution === "facility";
  // The other axis, always shown underneath. A Mintal patient registered in
  // Talomo has to be visible from both sides: Talomo reads "registered here",
  // Mintal still reads "live here". Neither barangay loses the case.
  const secondary = byFacility
    ? `${stat.residentCases} live${stat.residentCases === 1 ? "s" : ""} here`
    : `${stat.registeredCases} registered here`;
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
        {/* Never the bare word "cases": the number means something different
            on each axis, and one label for both is what let a facility count
            and a residence count be read as the same figure. */}
        <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
          {byFacility
            ? "registered here"
            : `resident${stat.caseCount === 1 ? "" : "s"} with TB`}
        </div>
        <div className="mt-1 border-t border-white/10 pt-1 text-[10px] text-slate-400">
          {secondary}
        </div>
        {assigned && (
          <div className="mt-1 border-t border-white/10 pt-1 font-mono text-[9px] uppercase tracking-wider text-vigil-300">
            Your assigned area
          </div>
        )}
        <div className="mt-1 border-t border-white/10 pt-1 font-mono text-[9px] uppercase tracking-wider text-accent-300">
          {open ? "Click to collapse" : "Click to spread the cases"}
        </div>
      </div>
    </Tooltip>
  );
}

export function AdminHotspotMap({
  hotspotInsights,
  attribution = "residence",
  onAttributionChange,
  facilityFlows = [],
  casePins = [],
  focusBarangay,
  highlightPsgc = null,
  heatPoints = [],
  scopeNote = null,
}: AdminHotspotMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [showHeat, setShowHeat] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  /**
   * What is currently drilled into. One state for both marker kinds, because
   * they are two directions through the same link and only one can be open at
   * a time:
   *
   *   barangay — "these people live here; where did they register?"
   *   facility — "this facility registered these; where do they live?"
   *
   * Null is the aggregate overview.
   */
  const [selection, setSelection] = useState<
    { kind: "barangay"; psgc: number } | { kind: "facility"; id: string } | null
  >(null);
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

  const spreadFacility = useMemo(
    () =>
      selection?.kind === "facility"
        ? (facilityFlows.find((f) => f.id === selection.id) ?? null)
        : null,
    [facilityFlows, selection]
  );
  const spreadBarangay = useMemo(
    () =>
      selection?.kind === "barangay"
        ? (barangayStats.find((s) => s.psgc === selection.psgc) ?? null)
        : null,
    [barangayStats, selection]
  );
  const isSpread = selection !== null;

  /**
   * The cases the current selection drills into, one pin each.
   *
   * A barangay's pins are selected by the same rule its circle was counted
   * with — on the facility axis, clicking Talomo opens the cases *registered*
   * in Talomo (whose dots then sit on their homes in Mintal and elsewhere),
   * not Talomo's residents. Filtering on a different axis than the count is
   * how a circle ends up disagreeing with the list it opens.
   */
  const spreadPins = useMemo(() => {
    if (!selection) return [];
    return selection.kind === "barangay"
      ? casePins.filter(
          (p) =>
            attributionPsgc(
              p.barangayPsgc,
              p.facilityBarangayPsgc,
              attribution
            ) === selection.psgc
        )
      : casePins.filter((p) => p.facilityId === selection.id);
  }, [casePins, selection, attribution]);

  /**
   * Facilities the open selection actually involves. Drilling into a barangay
   * has to reveal the facilities its residents registered at even when the
   * Facilities layer is switched off — otherwise the lines run to nothing.
   */
  const involvedFacilityIds = useMemo(() => {
    if (selection?.kind === "facility") return new Set([selection.id]);
    return new Set(
      spreadPins
        .map((p) => p.facilityId)
        .filter((id): id is string => id !== null)
    );
  }, [selection, spreadPins]);

  /** Which facilities a drilled-into barangay's residents registered at. */
  const barangayDestinations = useMemo(() => {
    if (selection?.kind !== "barangay") return [];
    const counts = new Map<
      string,
      { name: string; lat: number; lon: number; count: number }
    >();
    let unregistered = 0;
    for (const p of spreadPins) {
      if (!p.facilityId || p.facilityLat === null || p.facilityLon === null) {
        unregistered += 1;
        continue;
      }
      const hit = counts.get(p.facilityId);
      if (hit) hit.count += 1;
      else
        counts.set(p.facilityId, {
          name: p.facilityName ?? "Unknown facility",
          lat: p.facilityLat,
          lon: p.facilityLon,
          count: 1,
        });
    }
    const rows = [...counts.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count);
    return unregistered
      ? [
          ...rows,
          { id: "__none__", name: "Not yet registered", lat: 0, lon: 0, count: unregistered },
        ]
      : rows;
  }, [selection, spreadPins]);

  /**
   * Where the cases a barangay registered actually come from.
   *
   * The mirror of `barangayDestinations`, for the facility axis: Talomo's
   * circle counts the cases Talomo registered, so its breakdown has to answer
   * "and where do those patients live?" — otherwise the map records the case
   * in Talomo and says nothing about Mintal.
   */
  const barangayOrigins = useMemo(() => {
    if (selection?.kind !== "barangay") return [];
    const counts = new Map<number, { name: string; count: number }>();
    for (const p of spreadPins) {
      const hit = counts.get(p.barangayPsgc);
      if (hit) hit.count += 1;
      else
        counts.set(p.barangayPsgc, {
          name: p.barangayName ?? `PSGC ${p.barangayPsgc}`,
          count: 1,
        });
    }
    return [...counts.entries()]
      .map(([psgc, v]) => ({ psgc, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [selection, spreadPins]);

  /** Of the cases registered here, how many patients live somewhere else. */
  const registeredFromElsewhere = useMemo(() => {
    if (selection?.kind !== "barangay") return 0;
    return spreadPins.filter((p) => p.barangayPsgc !== selection.psgc).length;
  }, [selection, spreadPins]);

  const closeSpread = useCallback(() => setSelection(null), []);

  /**
   * Drill into a marker, or close it if it is already the open one.
   *
   * The zoom only happens on the way in. Flying again on the closing click
   * would yank the map while the user is trying to get back to the overview.
   */
  const openBarangay = useCallback(
    (stat: BarangayStat) => {
      // Read state directly rather than from a setState updater: React may
      // run an updater twice in development, which would fire two flyTos.
      if (selection?.kind === "barangay" && selection.psgc === stat.psgc) {
        setSelection(null);
        return;
      }
      setSelection({ kind: "barangay", psgc: stat.psgc });
      mapRef.current?.flyTo([stat.lat, stat.lon], SPREAD_ZOOM, {
        duration: 0.8,
      });
    },
    [selection]
  );

  const openFacility = useCallback(
    (f: FacilityFlowStat) => {
      if (selection?.kind === "facility" && selection.id === f.id) {
        setSelection(null);
        return;
      }
      setSelection({ kind: "facility", id: f.id });
      mapRef.current?.flyTo([f.lat, f.lon], SPREAD_ZOOM, { duration: 0.8 });
    },
    [selection]
  );

  // Escape closes the drill-down, matching the panel's × and a second click
  // on the same marker.
  useEffect(() => {
    if (!isSpread) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelection(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSpread]);

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
      label: "Area shapes",
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
      // "Markers" said nothing about what they mark. These are the barangay
      // circles a health worker clicks to open a case list.
      key: "markers",
      label: "Barangays",
      icon: MapPin,
      on: showMarkers,
      dot: "#38bdf8",
      toggle: () => setShowMarkers((v) => !v),
    },
    {
      key: "facilities",
      label: "Facilities",
      icon: Cross,
      on: showFacilities,
      dot: FACILITY_COLOR,
      // No longer clears the selection: an open drill-down keeps drawing the
      // facilities it involves regardless of this toggle, so turning the
      // layer off can't strand the flow lines.
      toggle: () => setShowFacilities((v) => !v),
    },
  ];

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={DAVAO_CENTER}
        zoom={DAVAO_ZOOM}
        minZoom={MIN_ZOOM}
        maxBounds={DAVAO_BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        // Keep SVG overlay rendering (Leaflet default): with the big cluster
        // halos + boundary polygons, canvas rendering tore during drag because
        // its buffer only covers the pre-drag viewport, leaving the newly
        // revealed edge blank until drag-end. SVG repositions vectors cleanly.
        // Integer zoom steps only — fractional zoom left the MapLibre GL
        // basemap blurry and misaligned against the Leaflet overlays.
        //
        // Gentler, Google-Maps-like wheel zoom: less twitchy per notch and
        // debounced so a fast scroll resolves to one smooth zoom instead of
        // several stuttering steps.
        wheelPxPerZoomLevel={120}
        wheelDebounceTime={40}
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
        {/* Flow layers sit between clusters and barangay markers (lines) and
            above the markers (origin dots + facility chips) so a spread is
            always readable over the aggregate view. */}
        <Pane name="flow-lines" style={{ zIndex: 418 }} />
        <Pane name="barangay-markers" style={{ zIndex: 425 }} />
        <Pane name="flow-origins" style={{ zIndex: 432 }} />
        <Pane name="facility-markers" style={{ zIndex: 435 }} />
        {/* Assigned-area marker renders above all others so it's never hidden */}
        <Pane name="assigned-area" style={{ zIndex: 440 }} />

        {showHeat && heatPoints.length > 0 && (
          <HeatmapLayer points={heatPoints} />
        )}

        {showMarkers && !isSpread && clusters.map((cluster) => (
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

        {showMarkers && !isSpread && clusters.map((cluster) => (
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

        {/* The circle is the primary click target: one click zooms in and
            breaks the aggregate into its individual cases. It used to open a
            popup, which meant the drill-down needed a second, different
            marker to be found first. */}
        {showMarkers && barangayStats
          .filter((stat) => stat.psgc !== highlightPsgc)
          .map((stat) => {
            const open =
              selection?.kind === "barangay" && selection.psgc === stat.psgc;
            return (
              <CircleMarker
                key={`bgy-${stat.psgc}`}
                center={[stat.lat, stat.lon]}
                radius={
                  barangayRadius(stat.caseCount, maxCount) + (open ? 3 : 0)
                }
                pane="barangay-markers"
                eventHandlers={{ click: () => openBarangay(stat) }}
                pathOptions={{
                  color: open ? "#0ea5e9" : "#0f172a",
                  weight: open ? 3 : 0.8,
                  fillColor: barangayFill(stat.caseCount, maxCount),
                  // Everything not drilled into recedes, so the open barangay
                  // and its traced cases carry the story.
                  fillOpacity: !isSpread || open ? 0.85 : 0.18,
                  opacity: !isSpread || open ? 1 : 0.22,
                }}
              >
                <MarkerTooltip
                  stat={stat}
                  fill={barangayFill(stat.caseCount, maxCount)}
                  attribution={attribution}
                  open={open}
                />
              </CircleMarker>
            );
          })}

        {/* Assigned-area marker: rendered last so it's on top with a distinct
            gold ring to immediately draw the health worker's eye to their zone. */}
        {showMarkers && barangayStats
          .filter((stat) => stat.psgc === highlightPsgc)
          .map((stat) => {
            const open =
              selection?.kind === "barangay" && selection.psgc === stat.psgc;
            return (
              <CircleMarker
                key={`bgy-assigned-${stat.psgc}`}
                center={[stat.lat, stat.lon]}
                radius={barangayRadius(stat.caseCount, maxCount) + (open ? 6 : 4)}
                pane="assigned-area"
                eventHandlers={{ click: () => openBarangay(stat) }}
                pathOptions={{
                  color: "#f59e0b",
                  weight: open ? 4 : 3,
                  fillColor: barangayFill(stat.caseCount, maxCount),
                  fillOpacity: !isSpread || open ? 0.92 : 0.3,
                  opacity: !isSpread || open ? 1 : 0.45,
                }}
              >
                <MarkerTooltip
                  stat={stat}
                  fill={barangayFill(stat.caseCount, maxCount)}
                  attribution={attribution}
                  assigned
                  open={open}
                />
              </CircleMarker>
            );
          })}

        {/* ── The spread ─────────────────────────────────────────────
            One line and one dot per case, whichever marker was clicked. From
            a barangay the lines fan outward to the facilities its residents
            registered at; from a facility they converge on the homes. Same
            links, opposite directions. */}
        {spreadPins.map((p, i) => {
          const anchor: [number, number] | null =
            selection?.kind === "facility"
              ? spreadFacility
                ? [spreadFacility.lat, spreadFacility.lon]
                : null
              : p.facilityLat !== null && p.facilityLon !== null
                ? [p.facilityLat, p.facilityLon]
                : null;
          // A case with no registering facility has nothing to join to — it
          // still gets a dot below, just no line.
          if (!anchor) return null;
          return (
            <Polyline
              key={`flow-${i}`}
              positions={[anchor, [p.lat, p.lon]]}
              pane="flow-lines"
              pathOptions={{
                color: FACILITY_COLOR,
                weight: 1.4,
                opacity: 0.55,
              }}
            />
          );
        })}

        {spreadPins.map((p, i) => (
          <CircleMarker
            key={`home-${i}`}
            center={[p.lat, p.lon]}
            radius={p.exact ? 5.5 : 4.5}
            pane="flow-origins"
            pathOptions={{
              color: "#042f2e",
              weight: 1,
              // Solid dot = geocoded household; dashed, paler dot = only a
              // barangay-level approximation is on file.
              dashArray: p.exact ? undefined : "2 2",
              fillColor: FACILITY_COLOR,
              fillOpacity: p.exact ? 0.95 : 0.55,
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -6]}
              opacity={1}
              className="pcm-tooltip"
            >
              {/* One case. Left-aligned rather than centred: these are
                  addresses that wrap over two lines, and centred wrapped
                  text is markedly harder to scan than a flush-left block. */}
              <div className="pcm-tooltip-inner text-left">
                <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                  Lives at
                </div>
                <div className="mt-0.5 text-xs font-semibold leading-snug text-white">
                  {p.address ?? p.barangayName ?? "Unknown barangay"}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  {p.exact
                    ? (p.barangayName ?? "—")
                    : `${p.barangayName ?? "—"} · approximate, no street address on file`}
                </div>
                <div className="mt-1.5 border-t border-white/10 pt-1.5">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                    Registered at
                  </div>
                  <div
                    className="mt-0.5 text-[11px] font-semibold leading-snug"
                    style={{ color: p.facilityName ? FACILITY_COLOR : "#94a3b8" }}
                  >
                    {p.facilityName ?? "Not yet registered"}
                  </div>
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Facilities the open selection needs are drawn even when the layer
            is off — drilling into a barangay must reveal where its residents
            registered, or the lines run to nothing. */}
        {facilityFlows
          .filter((f) => showFacilities || involvedFacilityIds.has(f.id))
          .map((f) => {
            const involved = involvedFacilityIds.has(f.id);
            return (
          <Marker
            key={`fac-${f.id}`}
            position={[f.lat, f.lon]}
            pane="facility-markers"
            icon={facilityIcon(involved, isSpread && !involved)}
            eventHandlers={{ click: () => openFacility(f) }}
          >
            <Tooltip
              direction="top"
              offset={[0, -12]}
              opacity={1}
              className="pcm-tooltip"
            >
              <div className="pcm-tooltip-inner text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: FACILITY_COLOR }}
                  />
                  <span className="text-xs font-semibold text-white">
                    {f.name}
                  </span>
                </div>
                <div className="mt-1 font-display text-2xl font-extrabold leading-none tracking-tight text-white">
                  {f.caseCount}
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                  case{f.caseCount === 1 ? "" : "s"} registered here
                </div>
                <div className="mt-1 border-t border-white/10 pt-1 font-mono text-[9px] uppercase tracking-wider text-vigil-300">
                  {selection?.kind === "facility" && selection.id === f.id
                    ? "Click to collapse"
                    : "Click to trace home barangays"}
                </div>
              </div>
            </Tooltip>
          </Marker>
            );
          })}

        <FocusController target={focusTarget} />
      </MapContainer>

      {/* ── Standing hint — only while nothing is open ─────────────────
          The drill-down is the whole point of this map and nothing on screen
          said so; a worker had to discover it by clicking a circle that
          previously just opened a popup. */}
      {!isSpread && (
        <div
          className={
            "pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 px-3 py-1.5 sm:top-4 " +
            GLASS
          }
        >
          <p className="whitespace-nowrap text-[11px] text-slate-300">
            <span className="font-semibold text-white">Click a barangay</span>{" "}
            to zoom in and spread out its cases
          </p>
        </div>
      )}

      {/* ── Spread breakdown — where the selected marker's cases sit ────
          Docks to the top-right, which is free now that the basemap switcher
          lives inside the Layers panel. It used to sit under that switcher,
          so the two stacked into one tall column of chrome. */}
      {isSpread && (
        <div
          className={
            "ahm-panel-in pointer-events-auto absolute right-3 top-3 z-[500] w-60 sm:right-4 sm:top-4 sm:w-64 " +
            GLASS
          }
        >
          <div className="flex items-start gap-2 p-3 pb-2">
            <div className="min-w-0 flex-1">
              <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
                {spreadBarangay ? (
                  <>
                    <MapPin className="h-3.5 w-3.5 text-accent-400" />
                    {attribution === "facility"
                      ? "Where are they from?"
                      : "Registered where?"}
                  </>
                ) : (
                  <>
                    <Cross
                      className="h-3.5 w-3.5"
                      style={{ color: FACILITY_COLOR }}
                    />
                    Case origins
                  </>
                )}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-white">
                {spreadBarangay?.name ?? spreadFacility?.name}
              </div>
            </div>
            <button
              type="button"
              onClick={closeSpread}
              aria-label="Close breakdown"
              className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 px-3">
            <div>
              <div className="font-display text-xl font-extrabold leading-none tracking-tight text-white">
                {spreadBarangay
                  ? spreadBarangay.caseCount
                  : (spreadFacility?.caseCount ?? 0)}
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                {spreadBarangay
                  ? attribution === "facility"
                    ? "Registered here"
                    : "Living here"
                  : "Registered here"}
              </div>
            </div>
            <div>
              <div className="font-display text-xl font-extrabold leading-none tracking-tight text-white">
                {spreadBarangay
                  ? attribution === "facility"
                    ? registeredFromElsewhere
                    : spreadBarangay.recentCases
                  : (spreadFacility?.outsideCount ?? "—")}
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                {spreadBarangay
                  ? attribution === "facility"
                    ? "Live elsewhere"
                    : "Last 30 days"
                  : "Live elsewhere"}
              </div>
            </div>
          </div>

          {/* Barangay drill-down, facility axis: the origins of the cases
              registered here. This is the panel's "still indicate where the
              patient came from" — Talomo's 40 broken out as Mintal 12,
              Talomo 21, and so on. */}
          {spreadBarangay && attribution === "facility" && (
            barangayOrigins.length > 0 ? (
              <ul className="mt-2 space-y-0.5 border-t border-white/10 p-2">
                {barangayOrigins.slice(0, 8).map((o) => (
                  <li key={o.psgc}>
                    <div className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background:
                            o.psgc === spreadBarangay.psgc
                              ? "#38bdf8"
                              : "#94a3b8",
                        }}
                      />
                      <span className="truncate text-slate-300">
                        {o.name}
                        {o.psgc === spreadBarangay.psgc && (
                          <span className="text-slate-500"> · own residents</span>
                        )}
                      </span>
                      <span className="ml-auto font-semibold tabular-nums text-white">
                        {o.count}
                      </span>
                    </div>
                  </li>
                ))}
                {barangayOrigins.length > 8 && (
                  <li className="px-1.5 pt-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                    +{barangayOrigins.length - 8} more
                  </li>
                )}
              </ul>
            ) : (
              <div className="mt-2 border-t border-white/10 p-3 text-xs text-slate-400">
                No cases are registered in this barangay yet.
              </div>
            )
          )}

          {/* Barangay drill-down, residence axis: where its residents registered. */}
          {spreadBarangay &&
            attribution === "residence" &&
            (barangayDestinations.length > 0 ? (
              <ul className="mt-2 space-y-0.5 border-t border-white/10 p-2">
                {barangayDestinations.slice(0, 8).map((d) => (
                  <li key={d.id}>
                    {/* Hops straight into that facility's own breakdown, so
                        the two directions chain instead of dead-ending. */}
                    <button
                      type="button"
                      disabled={d.id === "__none__"}
                      onClick={() => {
                        const f = facilityFlows.find((x) => x.id === d.id);
                        if (f) openFacility(f);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors duration-200 hover:bg-white/10 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{
                          background:
                            d.id === "__none__" ? "#64748b" : FACILITY_COLOR,
                        }}
                      />
                      <span className="truncate text-slate-300">{d.name}</span>
                      <span className="ml-auto font-semibold tabular-nums text-white">
                        {d.count}
                      </span>
                    </button>
                  </li>
                ))}
                {barangayDestinations.length > 8 && (
                  <li className="px-1.5 pt-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                    +{barangayDestinations.length - 8} more
                  </li>
                )}
              </ul>
            ) : (
              <div className="mt-2 border-t border-white/10 p-3 text-xs text-slate-400">
                None of these cases has a registering facility on file yet.
              </div>
            ))}

          {/* Facility drill-down: where its cases live. */}
          {spreadFacility &&
            (spreadFacility.origins.length > 0 ? (
              <ul className="mt-2 space-y-0.5 border-t border-white/10 p-2">
                {spreadFacility.origins.slice(0, 8).map((o) => (
                  <li key={o.psgc}>
                    {/* Hops into that barangay's own breakdown — the reverse
                        direction, one click away. */}
                    <button
                      type="button"
                      onClick={() => {
                        const stat = barangayStats.find(
                          (s) => s.psgc === o.psgc
                        );
                        if (stat) openBarangay(stat);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors duration-200 hover:bg-white/10"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: FACILITY_COLOR }}
                      />
                      <span className="truncate text-slate-300">{o.name}</span>
                      {o.psgc === spreadFacility.barangayPsgc && (
                        <span className="shrink-0 font-mono text-[8px] uppercase tracking-wider text-slate-500">
                          own bgy
                        </span>
                      )}
                      <span className="ml-auto font-semibold tabular-nums text-white">
                        {o.count}
                      </span>
                    </button>
                  </li>
                ))}
                {spreadFacility.origins.length > 8 && (
                  <li className="px-1.5 pt-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                    +{spreadFacility.origins.length - 8} more barangay
                    {spreadFacility.origins.length - 8 === 1 ? "" : "s"}
                  </li>
                )}
              </ul>
            ) : (
              <div className="mt-2 border-t border-white/10 p-3 text-xs text-slate-400">
                No cases are linked to this facility yet.
              </div>
            ))}

          <div className="border-t border-white/10 px-3 py-2 text-[10px] text-slate-500">
            {spreadBarangay
              ? attribution === "facility"
                ? "The cases this barangay's facilities registered, each dot on the home it came from — solid when a street address is on file, dashed when only the barangay is known. The case is recorded here; the dot says where the patient lives."
                : "One dot per case at its household (solid) or a barangay-level point (dashed), with a line to the facility that registered it. Residents skipping the nearest facility is a service-gap signal."
              : "One line per case, traced to the household when a street address is on file (solid dot) or to a barangay-level point when not (dashed dot). Transmission risk sits where the patient lives, not at the facility that registered them."}
          </div>
        </div>
      )}

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
            {/* Which barangay a case is filed under. The panel's rule: a
                Mintal resident registered at Talomo DOTS is Talomo's case,
                because Talomo holds the register entry. Flipping to "Lives in"
                answers the other question — where the patient came from —
                without either number being hidden. */}
            {onAttributionChange && (
              <div className="mt-2 border-t border-white/10 pt-2">
                <div className={MICRO_LABEL}>Count cases by</div>
                <div
                  role="group"
                  aria-label="Count cases by"
                  className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-0.5"
                >
                  {(
                    [
                      ["facility", "Registered at"],
                      ["residence", "Lives in"],
                    ] as [CaseAttribution, string][]
                  ).map(([key, label]) => {
                    const on = attribution === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onAttributionChange(key)}
                        aria-pressed={on}
                        className={
                          "rounded-md px-2 py-1 text-[10px] font-semibold transition " +
                          (on
                            ? "bg-accent-400 text-brand-950"
                            : "text-slate-300 hover:bg-white/10 hover:text-white")
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                  {attribution === "facility"
                    ? "Circles count the cases each barangay's DOTS facilities registered. Hover for how many of them also live there; click to trace them home."
                    : "Circles count the patients living in each barangay. Hover for how many were registered there instead."}
                </p>
              </div>
            )}
            {scopeNote && (
              <p className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-slate-400">
                {scopeNote}
              </p>
            )}
          </div>

          {summary.topBarangays.length > 0 && (
            <div className={"hidden p-3 md:block " + GLASS}>
              <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
                <MapPin className="h-3.5 w-3.5 text-accent-400" />
                Most affected
              </div>
              {/* Same action as clicking the circle on the map. It used to
                  only pan there, so the list and the map behaved differently
                  for what looks like the same thing. */}
              <ul className="mt-1.5 space-y-0.5">
                {summary.topBarangays.slice(0, 5).map((b) => {
                  const open =
                    selection?.kind === "barangay" && selection.psgc === b.psgc;
                  return (
                    <li key={b.psgc}>
                      <button
                        type="button"
                        onClick={() => openBarangay(b)}
                        aria-pressed={open}
                        className={
                          "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors duration-200 hover:bg-white/10 " +
                          (open ? "bg-white/10" : "")
                        }
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{
                            background: barangayFill(b.caseCount, maxCount),
                          }}
                        />
                        <span
                          className={
                            "truncate " +
                            (open ? "font-semibold text-white" : "text-slate-300")
                          }
                        >
                          {b.name}
                        </span>
                        <span className="ml-auto font-semibold tabular-nums text-white">
                          {b.caseCount}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Layers + basemap — one control cluster, bottom-right ──────
          These were two separate floating panels at opposite corners, which
          meant "what is drawn" and "what it is drawn on" were unrelated
          places to look. Same panel now, divided. */}
      <div
        className={
          "pointer-events-auto absolute bottom-3 right-14 z-[500] flex w-40 flex-col p-1 sm:bottom-4 sm:right-16 " +
          GLASS
        }
      >
        <div role="group" aria-label="Map layers" className="flex flex-col">
          {layerToggles.map(({ key, label, icon: Icon, on, dot, toggle }) => (
            <button
              key={key}
              type="button"
              onClick={toggle}
              aria-pressed={on}
              className={
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-colors duration-200 " +
                (on
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white")
              }
            >
              <Icon
                className="h-3.5 w-3.5 shrink-0"
                style={on ? { color: dot } : undefined}
              />
              {label}
              <span
                aria-hidden
                className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-200"
                style={{
                  background: on ? dot : "rgba(148, 163, 184, 0.35)",
                  boxShadow: on ? `0 0 6px ${dot}` : "none",
                }}
              />
            </button>
          ))}
        </div>

        <div className="mt-1 border-t border-white/10 px-2.5 pb-1 pt-2">
          <div className={MICRO_LABEL}>Base map</div>
          <div
            className="mt-1.5 flex overflow-hidden rounded-lg border border-white/10"
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
                  "flex-1 px-1.5 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-wider transition-colors duration-200 " +
                  (baseStyle === s.name
                    ? "bg-white/15 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white")
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
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
            {/* States the term once, where the severity colours are read, so
                "hotspot" always means the same thing across the app. */}
            <div className="mb-1.5 text-[10px] leading-snug text-slate-500">
              Hotspot — an area with a high concentration of TB cases.
            </div>
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
                {attribution === "facility"
                  ? "Cases registered"
                  : "Cases by residence"}
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
                {attribution === "facility"
                  ? "Circles sized by cases registered in the barangay. Click one to zoom in and trace those cases back to the homes they came from."
                  : "Circles sized by residents. Click one to zoom in and spread its cases out to the facilities that registered them."}
              </div>
            </div>
            <div className="mt-2 border-t border-white/10 pt-2">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                <span
                  className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded"
                  style={{ background: FACILITY_COLOR }}
                >
                  <Cross className="h-2 w-2 text-brand-950" strokeWidth={3.5} />
                </span>
                DOTS facility
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                Or click a facility for the reverse — its cases traced back to
                where the patients live. Solid dots are geocoded households,
                dashed dots barangay-level only.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminHotspotMap;
