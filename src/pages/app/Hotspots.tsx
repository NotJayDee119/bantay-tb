import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  Popup,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { divIcon } from "leaflet";
import type {
  CircleMarker as LeafletCircleMarker,
  Map as LeafletMap,
  Path as LeafletPath,
  PathOptions,
} from "leaflet";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";
import { Spinner } from "../../components/ui";
import { OpenFreeMapLayer } from "../../components/OpenFreeMapLayer";
import { supabase } from "../../lib/supabase";
import { loadHotspotSettings } from "../../lib/hotspotSettings";
import type { GiClass } from "../../lib/spatialStats";
import {
  giDetail,
  hotspotCertainty,
  neighboursWithCases,
} from "../../lib/hotspotUtils";
import { HotspotReason } from "../../components/HotspotReason";
import { ConfidenceExplainer } from "../../components/ConfidenceExplainer";
import {
  DEBOUNCE_MS,
  RELOAD_DEBOUNCE_MS,
  freshnessLabel,
  shouldDetect,
  type DetectReason,
} from "../../lib/hotspotRefresh";
import { formatDate, formatDateTime } from "../../lib/utils";
import { useAreaScope } from "../../hooks/useAreaScope";
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
  gi_z: number | null;
  gi_p: number | null;
  gi_class: GiClass | null;
}

/** Latest detection run — the citywide Moran's I. */
interface HotspotRun {
  id: string;
  run_at: string;
  metric: "rate_per_100k" | "case_count";
  n_units: number;
  cases_considered: number;
  moran_i: number;
  moran_expected: number;
  moran_z: number;
  moran_p_sim: number;
  permutations: number;
  hotspot_count: number;
  coldspot_count: number;
}

interface GiResultRow {
  barangay_psgc: number;
  case_count: number;
  value: number;
  gi_z: number;
  gi_p: number;
  gi_class: GiClass;
}

type BarangayGeo = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { psgc: number; ADM4_EN: string }
>;

// Choropleth fill per Gi* class — warm for hot, cool for cold, none otherwise.
const GI_FILL: Record<GiClass, string | null> = {
  hotspot_99: "#dc2626",
  hotspot_95: "#f97316",
  not_significant: null,
  coldspot_95: "#60a5fa",
  coldspot_99: "#2563eb",
};

const GI_LABEL: Record<GiClass, string> = {
  hotspot_99: "Hotspot — 99% confidence",
  hotspot_95: "Hotspot — 95% confidence",
  not_significant: "No clear pattern",
  coldspot_95: "Low-TB area — 95% confidence",
  coldspot_99: "Low-TB area — 99% confidence",
};

const GI_ORDER: GiClass[] = [
  "hotspot_99",
  "hotspot_95",
  "coldspot_95",
  "coldspot_99",
];

function formatP(p: number | null | undefined): string {
  if (p === null || p === undefined) return "—";
  return p < 0.001 ? "< 0.001" : p.toFixed(3);
}

const SEVERITY_COLOR: Record<Severity, string> = {
  watch: "#60a5fa",
  moderate: "#fbbf24",
  high: "#f97316",
  urgent: "#dc2626",
  low: "#60a5fa",
  medium: "#fbbf24",
};

// Gi* hotspots are high (95%) or urgent (99%); the rest are legacy values.
const SEVERITY_LABEL: Record<Severity, string> = {
  watch: "Watch",
  moderate: "Moderate",
  high: "High",
  urgent: "Urgent",
  low: "Watch",
  medium: "Moderate",
};

// One line explaining what each level means and what to do about it.
const SEVERITY_MEANING: Record<Severity, string> = {
  watch: "A few cases nearby. Keep an eye on it.",
  moderate: "Several cases grouped together.",
  high: "Strong pattern (95% confidence). Start outreach here.",
  urgent: "Very strong pattern (99% confidence). Act right away.",
  low: "A few cases nearby. Keep an eye on it.",
  medium: "Several cases grouped together.",
};

// Dark glass console chrome — shared language with the GIS map overlays.
const GLASS =
  "rounded-xl border border-white/10 bg-brand-950/90 shadow-lift backdrop-blur";
// Friendly panel heading — sentence case, easy to read at a glance.
const PANEL_TITLE = "text-sm font-semibold text-white";

function SeverityChip({ severity }: { severity: Severity }) {
  const c = SEVERITY_COLOR[severity];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: c, borderColor: `${c}66`, background: `${c}1a` }}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function Hotspots() {
  const scope = useAreaScope();
  // Detection clusters the whole city and fans out alerts to coordinators.
  // An area-scoped account only reads its own barangay's cases and profiles,
  // so its recompute would cluster partial data and skip citywide recipients.
  // Scoped staff still see every hotspot RLS grants them — they just don't
  // trigger the run; the detect-hotspots Edge Function does it citywide.
  const canRecompute = !scope.scoped;
  // The citywide "Hotspot areas" list is for coordinators; BHW/nurse/doctor
  // and barangay admin accounts just see the map.
  const showHotspotList = !scope.scoped;
  // Area staff see where the hotspots are, not how many patients sit behind
  // them — case figures stay with citywide accounts.
  const showCaseCounts = !scope.scoped;
  const [list, setList] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  // True while an automatic run is in flight. Kept apart from `running` so the
  // manual button doesn't show a spinner for work the user didn't ask for.
  const [autoChecking, setAutoChecking] = useState(false);
  // How many days of recent cases the detection considers (from Settings).
  // Shown to users so it's clear older cases aren't counted.
  const [windowDays, setWindowDays] = useState(365);
  const [run, setRun] = useState<HotspotRun | null>(null);
  const [results, setResults] = useState<Map<number, GiResultRow>>(new Map());
  const [geo, setGeo] = useState<BarangayGeo | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [zoom, setZoom] = useState(11);
  // Barangay whose cases are open in the side panel (a circle or area click).
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    fetch("/data/davao-city-barangays.geojson")
      .then((r) => r.json())
      .then((d: BarangayGeo) => setGeo(d))
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("hotspots")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setList((data ?? []) as Hotspot[]);

    const { data: runs } = await supabase
      .from("hotspot_runs")
      .select(
        "id, run_at, metric, n_units, cases_considered, moran_i, moran_expected, moran_z, moran_p_sim, permutations, hotspot_count, coldspot_count"
      )
      .order("run_at", { ascending: false })
      .limit(1);
    const latest = (runs?.[0] ?? null) as HotspotRun | null;
    setRun(latest);
    if (latest) {
      const { data: rows } = await supabase
        .from("hotspot_results")
        .select("barangay_psgc, case_count, value, gi_z, gi_p, gi_class")
        .eq("run_id", latest.id);
      setResults(
        new Map(
          ((rows ?? []) as GiResultRow[]).map((r) => [Number(r.barangay_psgc), r])
        )
      );
    } else {
      setResults(new Map());
    }
    setLoading(false);
  }

  // ── Automatic detection ──────────────────────────────────────────────
  // Everything below exists so the map keeps itself current. It used to sit on
  // whatever the last person to encode a case had left behind, and a scoped
  // account could not refresh it at all — the manual button is citywide-only.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectInFlight = useRef(false);
  const disposed = useRef(false);

  /**
   * One reload per detection run, not one per row. A run deletes every TB
   * hotspot and re-inserts them, so reacting to each change event emptied the
   * map and refilled it — the markers visibly flashed away and back.
   */
  function scheduleReload() {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      if (!disposed.current) void load();
    }, RELOAD_DEBOUNCE_MS);
  }

  /**
   * Ask the Edge Function to recompute. Detection only ever runs there: it
   * runs as service_role and sees every case, so Gi* is computed on the whole
   * city whichever role triggered it — a scoped account's RLS view would
   * otherwise feed the statistic a partial map.
   */
  async function runDetection(reason: DetectReason) {
    if (detectInFlight.current || disposed.current) return;

    // The floor is checked against the latest stored run, not a local
    // timestamp, so open dashboards don't each fire a run for the same case.
    // (Not hotspots.detected_at: a hotspot row keeps the time it was FIRST
    // detected, and a run with no hotspots writes no row at all.)
    const { data: latest } = await supabase
      .from("hotspot_runs")
      .select("run_at")
      .order("run_at", { ascending: false })
      .limit(1);
    const lastRun = latest?.[0]?.run_at ?? null;
    const decision = shouldDetect(lastRun, reason);
    if (!decision.run) {
      // Somebody else recomputed for this same change — the case form fires a
      // run of its own, and other open dashboards race us. Their result is the
      // one we wanted, so pick it up instead of sitting on a stale list.
      if (decision.skipped === "too_soon" && !disposed.current) await load();
      return;
    }

    detectInFlight.current = true;
    setAutoChecking(true);
    try {
      const { error } = await supabase.functions.invoke("detect-hotspots", {
        body: { trigger: `auto_${reason}` },
      });
      // Quiet on failure. Nobody asked for this run, so a toast would be an
      // interruption reporting a job the user never started; the realtime
      // subscription and the freshness label already tell the truth.
      if (error) console.warn("Automatic hotspot detection failed:", error);
      else if (!disposed.current) await load();
    } catch (err) {
      console.warn("Automatic hotspot detection failed:", err);
    } finally {
      detectInFlight.current = false;
      if (!disposed.current) setAutoChecking(false);
    }
  }

  function scheduleDetection(reason: DetectReason) {
    if (detectTimer.current) clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(() => {
      void runDetection(reason);
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    disposed.current = false;
    load();
    loadHotspotSettings().then((s) => setWindowDays(s.window_days));

    // On open: refresh anything gone stale. The detection window slides, so a
    // result can go out of date without a single new case being recorded.
    void runDetection("stale");

    const ch = supabase
      .channel("hotspots-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hotspots" },
        scheduleReload
      )
      // The half that makes this automatic. A case recorded anywhere in the
      // city — by anyone, on any device — now re-runs detection here. Writing
      // hotspots cannot re-trigger this, so there is no feedback loop.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        () => scheduleDetection("cases_changed")
      )
      .subscribe();

    return () => {
      disposed.current = true;
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      if (detectTimer.current) clearTimeout(detectTimer.current);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Manual "check again" — always runs, citywide, in the Edge Function. */
  async function recompute() {
    setRunning(true);
    try {
      const settings = await loadHotspotSettings();
      setWindowDays(settings.window_days);
      const { data, error } = await supabase.functions.invoke("detect-hotspots", {
        body: { trigger: "manual" },
      });
      if (error) throw error;
      const count = (data as { hotspots?: unknown[] } | null)?.hotspots?.length ?? 0;
      toast.success(
        count === 0
          ? "No hotspot barangays right now."
          : `${count} hotspot barangay${count === 1 ? "" : "s"}.`
      );
      await load();
    } catch (err) {
      console.error("Hotspot recompute failed:", err);
      toast.error("Something went wrong while checking. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  // Re-render on a slow tick so "Updated 2 minutes ago" doesn't freeze at the
  // value it had when the last hotspot arrived.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const center = useMemo<[number, number]>(() => [7.0731, 125.6128], []);
  const urgentCount = useMemo(
    () => list.filter((h) => h.severity === "urgent" || h.severity === "high").length,
    [list]
  );
  // The run row is written even when no barangay qualifies, so it is the
  // honest "last checked" time; the newest hotspot row is the fallback.
  const lastChecked = run?.run_at ?? (list.length > 0 ? list[0].detected_at : null);

  const geoStyle = (feature?: GeoJSON.Feature): PathOptions => {
    const psgc = Number(feature?.properties?.psgc);
    const r = results.get(psgc);
    const fill = r ? GI_FILL[r.gi_class] : null;
    return {
      color: "#94a3b8",
      weight: 0.6,
      opacity: 0.35,
      fillColor: fill ?? "#0f172a",
      fillOpacity: fill ? 0.38 : 0,
    };
  };

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
            <ZoomWatcher onZoom={setZoom} />
            <FitToHotspots hotspots={list} />
            {geo && (
              // Keyed on the run so Leaflet restyles when a new run lands.
              <GeoJSON
                key={run?.id ?? "no-run"}
                data={geo}
                style={geoStyle}
                onEachFeature={(feature, layer) => {
                  const r = results.get(Number(feature.properties?.psgc));
                  if (!r) return;
                  // pcm-tooltip is transparent by design and expects its own
                  // dark card inside — bare text would sit dark-on-dark.
                  const name = escapeHtml(String(feature.properties?.ADM4_EN ?? ""));
                  const dot = GI_FILL[r.gi_class] ?? "#94a3b8";
                  const cases = r.case_count;
                  const card =
                    `<div style="font-size:12px;font-weight:600;color:#fff">${name}</div>` +
                    `<div style="margin-top:2px;display:flex;align-items:center;gap:6px;font-size:11px;color:#cbd5e1">` +
                    `<span style="width:8px;height:8px;border-radius:9999px;background:${dot};flex-shrink:0"></span>` +
                    `${GI_LABEL[r.gi_class]}</div>` +
                    (showCaseCounts
                      ? `<div style="margin-top:2px;font-size:10px;color:#94a3b8">` +
                        `${cases.toLocaleString()} TB patient${cases === 1 ? "" : "s"} living here</div>`
                      : "");
                  layer.bindTooltip(`<div class="pcm-tooltip-inner">${card}</div>`, {
                    sticky: true,
                    className: "pcm-tooltip",
                  });
                  // Hover never happens on a phone, and a click should name
                  // the area too — the same card, pinned where it was tapped.
                  layer.bindPopup(`<div style="min-width:160px">${card}</div>`, {
                    className: "ghm-popup",
                  });
                  layer.on("popupopen", () => layer.closeTooltip());
                  layer.on("click", () => setSelected(Number(feature.properties?.psgc)));
                  // Outline the area under the cursor so it's clear which
                  // barangay the card is describing.
                  const path = layer as LeafletPath;
                  layer.on("mouseover", () => {
                    path.setStyle({ color: "#e2e8f0", weight: 1.6, opacity: 0.9, fillOpacity: 0.55 });
                  });
                  layer.on("mouseout", () => path.setStyle(geoStyle(feature)));
                }}
              />
            )}
            {/* Own pane above the overlay pane (z 400). The GeoJSON above is
                keyed on the run, so it remounts after the circles and would
                otherwise be drawn over them — swallowing every click and
                hover meant for a hotspot. */}
            <Pane name="hotspot-circles" style={{ zIndex: 450 }}>
            {list.map((h) => {
              const color = SEVERITY_COLOR[h.severity];
              const r = Math.min(30, 10 + Math.max(0, h.gi_z ?? 0) * 3);
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
                    eventHandlers={{
                      click: () => setSelected(h.barangay_psgc),
                      mouseover: (e) => {
                        const c = e.target as LeafletCircleMarker;
                        c.setStyle({ color: "#fff", weight: 2.5, fillOpacity: 0.8 });
                        c.bringToFront();
                      },
                      mouseout: (e) =>
                        (e.target as LeafletCircleMarker).setStyle({
                          color,
                          weight: 1.5,
                          fillOpacity: 0.5,
                        }),
                      // The hover card and the click card say the same thing —
                      // never show both stacked on one circle.
                      popupopen: (e) =>
                        (e.target as LeafletCircleMarker).closeTooltip(),
                      tooltipopen: (e) => {
                        const c = e.target as LeafletCircleMarker;
                        if (c.isPopupOpen()) c.closeTooltip();
                      },
                    }}
                  >
                    {/* Tooltip anchors at the circle's centre — clear the
                        radius plus the r+7 halo so the card never covers it.
                        Both cards name Leaflet's own panes explicitly: inside
                        <Pane> react-leaflet would otherwise put them in
                        hotspot-circles, under the name labels (z 460). */}
                    <Tooltip
                      pane="tooltipPane"
                      direction="top"
                      offset={[0, -(r + 10)]}
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
                        {showCaseCounts && (
                          <div className="mt-1 font-display text-2xl font-extrabold tabular-nums leading-none tracking-tight text-white">
                            {h.case_count.toLocaleString()}
                          </div>
                        )}
                        <div
                          className="mt-0.5 text-[11px] font-semibold"
                          style={{ color }}
                        >
                          {SEVERITY_LABEL[h.severity]}
                        </div>
                        {showCaseCounts && (
                          <div className="text-[10px] text-slate-300">
                            TB patient{h.case_count === 1 ? "" : "s"} living here
                          </div>
                        )}
                      </div>
                    </Tooltip>
                    <Popup className="ghm-popup" pane="popupPane">
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
                        {showCaseCounts && (
                          <HotspotReason
                            name={barangayName(h.barangay_psgc)}
                            ownCases={h.case_count}
                            neighbours={neighboursWithCases(
                              h.barangay_psgc,
                              (p) => results.get(p)?.case_count ?? 0
                            )}
                          />
                        )}
                        <p
                          className="mt-2 text-[11px] leading-snug text-slate-400"
                          title={giDetail(h.gi_z, h.gi_p)}
                        >
                          {SEVERITY_MEANING[h.severity]}
                        </p>
                        <div className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-slate-500">
                          Hotspot since {formatDateTime(h.detected_at)}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                </Fragment>
              );
            })}
            </Pane>
            {/* Names on the map once zoomed in far enough for them not to
                collide — at city zoom the circles overlap and labels would
                pile up, so there the hover card does the naming. */}
            {zoom >= LABEL_MIN_ZOOM && (
              <Pane
                name="hotspot-labels"
                style={{ zIndex: 460, pointerEvents: "none" }}
              >
                {list.map((h) => (
                  <Marker
                    key={h.id}
                    position={[h.centroid_lat, h.centroid_lon]}
                    interactive={false}
                    keyboard={false}
                    icon={hotspotLabelIcon(
                      barangayName(h.barangay_psgc),
                      Math.min(30, 10 + Math.max(0, h.gi_z ?? 0) * 3)
                    )}
                  />
                ))}
              </Pane>
            )}
      </MapContainer>

      {/* ── Title + action — top-left console panel ─────────────────── */}
      <div className={"absolute left-3 top-3 z-[500] w-64 p-3.5 sm:left-4 sm:top-4 " + GLASS}>
        <div className={"flex items-center gap-1.5 " + PANEL_TITLE}>
          <AlertTriangle className="h-4 w-4 text-vigil-400" />
          TB hotspots
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">
          A hotspot is an area where TB is higher than normal &mdash; in the
          barangay and the barangays around it. A hotspot can have only a few
          cases of its own if the barangays next to it have many.
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          Based on TB cases from the last{" "}
          {windowDays === 365 ? "12 months" : `${windowDays} days`}, counted
          where the patients live.
        </p>

        {run && canRecompute && <MoranCard run={run} />}

        {/* Live status. This panel used to claim detection ran "on a schedule",
            which was not true — there is no cron job. Now it says what is
            actually happening, and it is actually happening. */}
        <div
          aria-live="polite"
          className="mt-3 flex items-center gap-1.5 border-t border-white/10 pt-2.5 text-[11px] text-slate-400"
        >
          {autoChecking ? (
            <>
              <Spinner className="h-3 w-3 shrink-0 text-accent-400" />
              <span className="text-slate-300">Checking for hotspots…</span>
            </>
          ) : (
            <>
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]"
              />
              <span>
                <span className="font-semibold text-slate-300">Live</span>
                {lastChecked ? ` · ${freshnessLabel(lastChecked, now)}` : ""}
              </span>
            </>
          )}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          This map updates by itself whenever a case is recorded anywhere in the
          city. You don&rsquo;t need to refresh it.
        </p>

        {canRecompute && (
        <button
          type="button"
          onClick={recompute}
          disabled={running}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-2.5 py-2 text-[12px] font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <>
              <Spinner className="h-3.5 w-3.5 text-accent-400" />
              Checking…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Check again now
            </>
          )}
        </button>
        )}
        {scope.scoped && (
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Showing hotspots for{" "}
            <span className="font-semibold text-slate-300">
              {scope.name ?? "your assigned area"}
            </span>
            . Detection itself runs city-wide, so your barangay is always
            compared against its real neighbours.
          </p>
        )}
      </div>

      {showHotspotList && (
      <>
      {/* ── Detections chip — compact, only while the rail is hidden ─── */}
      <div className="pointer-events-none absolute right-3 top-3 z-[500] md:hidden">
        <div className={"pointer-events-auto flex items-center gap-2 px-3 py-2 " + GLASS}>
          <Activity className="h-4 w-4 text-accent-400" />
          <div>
            <div className="font-display text-lg font-extrabold leading-none tracking-tight text-white">
              {list.length}
            </div>
            <div className="text-[11px] text-slate-300">
              hotspot{list.length === 1 ? "" : "s"} · {urgentCount} need attention
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent hotspots — right rail, can be hidden to clear the map ─ */}
      <div
        className={
          "absolute bottom-3 right-3 top-3 z-[500] hidden w-72 flex-col overflow-hidden sm:bottom-4 sm:right-4 sm:top-4 " +
          (railOpen ? "md:flex " : "md:hidden ") +
          GLASS
        }
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + PANEL_TITLE}>
            <AlertTriangle className="h-4 w-4 text-vigil-400" />
            Hotspot areas
          </div>
          <div className="flex items-center gap-2">
            {list.length > 0 && (
              <span className="text-[11px] tabular-nums text-slate-400">
                {urgentCount} need attention
              </span>
            )}
            <button
              type="button"
              onClick={() => setRailOpen(false)}
              aria-label="Hide list"
              title="Hide list"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="border-b border-white/10 px-4 py-2">
          <p className="text-[11px] leading-snug text-slate-400">
            Hotspot barangays over the last {windowDays} days, strongest
            first. Tap one to find it on the map.
          </p>
          {lastChecked && (
            <p className="mt-1 text-[10px] text-slate-500">
              Last checked {formatDateTime(lastChecked)}
            </p>
          )}
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner className="text-accent-400" />
          </div>
        ) : list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm leading-relaxed text-slate-400">
            No hotspot barangays right now — no area of the city has more TB
            than chance would explain. This list updates on its own as cases
            are recorded.
          </p>
        ) : (
          <ul className="flex-1 divide-y divide-white/5 overflow-y-auto">
            {[...list]
              .sort((a, b) => (b.gi_z ?? 0) - (a.gi_z ?? 0))
              .map((h) => (
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
                  <div className="mt-1 pl-4 text-[11px] text-slate-400">
                    <span title={giDetail(h.gi_z, h.gi_p)}>
                      {h.case_count} TB patient{h.case_count === 1 ? "" : "s"} living
                      here · {hotspotCertainty(h.severity).short}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Reopen tab — only on desktop while the rail is hidden ────── */}
      {!railOpen && (
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          className={
            "absolute right-3 top-3 z-[500] hidden items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-white/10 md:flex sm:right-4 sm:top-4 " +
            GLASS
          }
        >
          <ChevronLeft className="h-4 w-4" />
          <AlertTriangle className="h-4 w-4 text-vigil-400" />
          {list.length} hotspot{list.length === 1 ? "" : "s"}
        </button>
      )}
      </>
      )}

      {selected !== null && (
        <BarangayCasesPanel
          psgc={selected}
          windowDays={windowDays}
          ownPsgc={scope.psgc}
          scoped={scope.scoped}
          onClose={() => setSelected(null)}
        />
      )}

      {/* ── Severity legend — bottom-left, clear of the zoom control ── */}
      <div className={"absolute bottom-3 left-14 z-[500] px-3 py-2 sm:bottom-4 sm:left-16 " + GLASS}>
        <div className="text-[11px] font-semibold text-slate-200">
          What the colours mean
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
          {GI_ORDER.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 text-[11px] text-slate-300"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: GI_FILL[c] ?? undefined }}
              />
              {GI_LABEL[c]}
            </span>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          Barangays with no colour show no clear pattern.
        </div>
        <ConfidenceExplainer tone="dark" className="mt-1.5 max-w-xs" />
      </div>

      {/* ── Empty overlay — map stays visible behind ────────────────── */}
      {!loading && list.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] grid place-items-center bg-brand-950/50 backdrop-blur-sm">
          <p className="max-w-xs px-6 text-center text-sm leading-relaxed text-slate-300">
            {autoChecking ? (
              <>Checking for areas with a high concentration of TB cases…</>
            ) : (
              <>
                No hotspots to show. No area of the city has more TB than
                chance would explain — this map will fill in by itself if that
                changes.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Citywide clustering test for coordinators: Global Moran's I is run before
 * Gi*, and a Gi* hotspot reads differently when the city as a whole shows no
 * significant clustering.
 */
function MoranCard({ run }: { run: HotspotRun }) {
  const significant = run.moran_p_sim < 0.05;
  const verdict =
    significant && run.moran_i > run.moran_expected
      ? {
          answer: "Yes",
          text: "Barangays with many TB cases are grouped together in one part of the city.",
        }
      : significant
        ? {
            answer: "No",
            text: "Barangays with many TB cases are spread out across the city.",
          }
        : {
            answer: "Not clearly",
            text: "TB is not grouped in one part of the city. Visit each hotspot to check the situation on the ground.",
          };
  return (
    <div className="mt-3 border-t border-white/10 pt-2.5">
      <div className="text-[11px] font-semibold text-slate-200">
        Is TB grouped in one part of the city?
      </div>
      <p className="mt-1 text-[12px] leading-snug text-slate-300">
        <span className="font-semibold text-white">{verdict.answer}.</span>{" "}
        {verdict.text}
      </p>
      {run.metric === "case_count" && (
        <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
          Note: this compares numbers of cases only. Barangay population numbers
          have not been added yet.
        </p>
      )}
      {/* The statistics stay available for reports and the manuscript,
          folded away so they never confuse a health worker. */}
      <details className="mt-1.5 text-[10px] text-slate-500">
        <summary className="cursor-pointer select-none font-semibold text-slate-400 underline underline-offset-2 hover:text-slate-200">
          Show the numbers
        </summary>
        <dl className="mt-1.5 grid grid-cols-3 gap-2 text-center">
          {[
            ["I", run.moran_i.toFixed(3)],
            ["z", run.moran_z.toFixed(2)],
            ["p", formatP(run.moran_p_sim)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-white/5 px-1 py-1">
              <dt className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                {k}
              </dt>
              <dd className="font-display text-sm font-bold tabular-nums text-white">
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-1 leading-snug">
          Global Moran&rsquo;s I · E[I] = {run.moran_expected.toFixed(4)} ·{" "}
          {run.permutations} permutations · {run.n_units} barangays ·{" "}
          {run.cases_considered.toLocaleString()} cases
          {run.metric === "case_count" ? " · case counts, not rates per 100,000" : ""}
        </p>
      </details>
    </div>
  );
}

interface PanelCase {
  id: string;
  reported_at: string;
  diagnosis_status: string | null;
  treatment_outcome: string;
  age: number | null;
  sex: string;
  given_name: string | null;
  family_name: string | null;
  patient_code: string | null;
}

const DX_LABEL: Record<string, string> = {
  presumptive: "Presumptive",
  clinically_diagnosed: "Clinically diagnosed",
  bacteriologically_confirmed: "Bact. confirmed",
};

const PANEL_LIMIT = 50;

/**
 * The cases behind a barangay on the map — the same set detection counted:
 * TB, by residence, inside the detection window. RLS decides which rows the
 * viewer may open, so area staff only ever see their own area's patients.
 */
function BarangayCasesPanel({
  psgc,
  windowDays,
  ownPsgc,
  scoped,
  onClose,
}: {
  psgc: number;
  windowDays: number;
  ownPsgc: number | null;
  scoped: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<PanelCase[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    supabase
      .from("cases")
      .select(
        "id, reported_at, diagnosis_status, treatment_outcome, age, sex, given_name, family_name, patient_code",
        { count: "exact" }
      )
      .eq("barangay_psgc", psgc)
      .eq("disease", "tb")
      .gte("reported_at", since.toISOString())
      .order("reported_at", { ascending: false })
      .limit(PANEL_LIMIT)
      .then(({ data, count, error }) => {
        if (cancelled) return;
        if (error) toast.error(error.message);
        setRows((data ?? []) as PanelCase[]);
        setTotal(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [psgc, windowDays]);

  const name = barangayName(psgc);
  const outsideArea = scoped && ownPsgc !== psgc;

  return (
    <div
      className={
        "absolute inset-x-3 bottom-3 z-[510] flex max-h-[60%] flex-col overflow-hidden md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-80 " +
        GLASS
      }
    >
      <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className={"truncate " + PANEL_TITLE}>{name}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            TB cases living here · last{" "}
            {windowDays === 365 ? "12 months" : `${windowDays} days`}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cases"
          title="Close"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {rows === null ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner className="text-accent-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] leading-relaxed text-slate-400">
          {outsideArea
            ? `Cases in ${name} are handled by that barangay's health workers. Your account only opens cases in your own area.`
            : "No TB cases recorded here in this period."}
        </p>
      ) : (
        <ul className="flex-1 divide-y divide-white/5 overflow-y-auto">
          {rows.map((c) => {
            const who =
              [c.family_name, c.given_name].filter(Boolean).join(", ") ||
              c.patient_code ||
              "Unnamed patient";
            const meta = [
              c.age !== null ? `${c.age}` : null,
              c.sex ? c.sex.charAt(0).toUpperCase() : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={c.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-white">
                    {who}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                    {formatDate(c.reported_at)}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {[
                    meta || null,
                    DX_LABEL[c.diagnosis_status ?? ""] ?? null,
                    c.treatment_outcome.replace(/_/g, " "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="border-t border-white/10 px-4 py-2.5">
          {total > rows.length && (
            <p className="mb-1.5 text-[10px] text-slate-500">
              Showing the latest {rows.length} of {total.toLocaleString()}.
            </p>
          )}
          <Link
            to={`/app/cases?barangay=${psgc}&closed=1`}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-2.5 py-2 text-[12px] font-semibold text-white transition hover:bg-white/15"
          >
            Open in Cases
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

/** For text placed into Leaflet's HTML tooltips. */
function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}

function barangayName(psgc: number): string {
  return barangays.find((b) => b.psgc === psgc)?.name ?? "—";
}

/** Zoom level from which hotspot names are drawn on the map itself. */
const LABEL_MIN_ZOOM = 13;

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

/**
 * Opens the map framed on the hotspots themselves rather than the whole city.
 * Runs once, on the first non-empty list — later live updates must not yank
 * the view away from wherever the user has panned to.
 */
function FitToHotspots({ hotspots }: { hotspots: Hotspot[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || hotspots.length === 0) return;
    done.current = true;
    // Median, not the bounding-box centre: one outlying hotspot (Lasang, up
    // north) would drag the box centre away from the main cluster.
    const median = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const centre: [number, number] = [
      median(hotspots.map((h) => h.centroid_lat)),
      median(hotspots.map((h) => h.centroid_lon)),
    ];
    // Fixed at the label zoom: close enough that every hotspot carries its
    // name, wide enough to show the city's cluster.
    map.setView(centre, LABEL_MIN_ZOOM, { animate: false });
    // An unanimated setView can skip zoomend; report it so the name labels
    // follow.
    map.fire("zoomend");
  }, [hotspots, map]);
  return null;
}

/** A name pill sitting just under a hotspot circle of radius `r` px. */
function hotspotLabelIcon(name: string, r: number) {
  return divIcon({
    className: "hs-label",
    html: `<span>${escapeHtml(name)}</span>`,
    iconSize: [0, 0],
    // Anchor at the circle's centre; the pill is pushed below the halo.
    iconAnchor: [0, -(r + 9)],
  });
}
