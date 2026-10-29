import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CircleMarker,
  MapContainer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import { DomEvent, LatLngBounds, point } from "leaflet";
import { Activity, CircleHelp, MapPin, Search, X } from "lucide-react";
import { OpenFreeMapLayer } from "./OpenFreeMapLayer";
import { MAP_TOUR_STEP, MapTour, hasSeenMapTour, markSeen } from "./MapTour";
import barangays from "../data/barangays.json";
import { isCoarsePointer } from "../lib/pointer";
import { usePublicYearlyCounts } from "../hooks/usePublicYearlyCounts";
import { LoadingSpinner } from "./LazyFallback";

/**
 * Public, anonymous-safe map of TB burden by barangay for the landing hero.
 *
 * Data comes from the `barangay_case_counts` RPC — a SECURITY DEFINER
 * aggregate that returns only per-barangay totals (no patient rows, no
 * coordinates, no PII). Coordinates are joined client-side from the bundled
 * `barangays.json`, so nothing sensitive ever leaves the database.
 *
 * Visitors can filter the map by barangay name: matching markers stay lit,
 * everything else dims, and picking a suggestion flies the camera to it.
 *
 * Layout: the map and a solid side panel, side by side from lg and stacked
 * below that. Search, totals, the most-affected list and the legend all live
 * in the panel. They used to be five translucent cards floating over the map
 * itself — on a phone they covered most of it, and every one was blurring
 * the map behind it on each frame of a pan.
 */

const FOCUS_ZOOM = 13.5;
// Every barangay in the city. The map opens framed on this, so a visitor sees
// all 182 at once, and "close" flies back to it.
const CITY_EXTENT = new LatLngBounds([6.96, 125.22], [7.57, 125.68]);
const CITY_PADDING: [number, number] = [24, 24];
// Locked to Davao City, as on the admin hotspot map: a hard wall a little
// beyond the city extent, so nobody drifts into Bukidnon or the gulf. The
// zoom-out floor is the whole-city view itself (see MapResizeSync).
const DAVAO_BOUNDS = new LatLngBounds([6.82, 125.05], [7.72, 125.83]);

// One duration and easing for every camera move, matching the DOTS Locator,
// so the two maps on the public site feel like the same instrument.
const FLY = { duration: 0.7, easeLinearity: 0.22 } as const;

interface BarangayPoint {
  psgc: number;
  name: string;
  lat: number;
  lon: number;
  count: number;
}

// Density ramp tuned for a dark basemap: cool → warm as burden rises.
function fillFor(count: number, max: number): string {
  if (max <= 0 || count <= 0) return "#334155";
  const r = count / max;
  if (r < 0.2) return "#38bdf8";
  if (r < 0.4) return "#22d3ee";
  if (r < 0.6) return "#fbbf24";
  if (r < 0.8) return "#f97316";
  return "#ef4444";
}

function radiusFor(count: number, max: number): number {
  if (max <= 0) return 5;
  const r = Math.sqrt(Math.max(count, 0.5) / Math.max(max, 1));
  return 5 + r * 16;
}

const LEGEND_COLORS = ["#38bdf8", "#22d3ee", "#fbbf24", "#f97316", "#ef4444"];

/** Google-Maps-style wheel behavior: plain scroll keeps scrolling the page,
 *  Ctrl+scroll zooms the map.
 *
 *  There used to be a dark scrim that flashed over the whole map on every
 *  plain scroll to say so. The map is most of the first screen, so the cursor
 *  is over it whenever someone starts scrolling down the page — which made
 *  the flash fire on nearly every visit, on the one gesture that was working
 *  exactly as intended. The how-to now sits as a quiet line under the map. */
function CtrlScrollZoom() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    const enable = (e: KeyboardEvent) => {
      if (e.key === "Control") map.scrollWheelZoom.enable();
    };
    const disable = (e: KeyboardEvent) => {
      if (e.key === "Control") map.scrollWheelZoom.disable();
    };
    const disableOnBlur = () => map.scrollWheelZoom.disable();
    const onWheel = (e: WheelEvent) => {
      // Stop the browser's page-zoom; Leaflet's (now enabled) handler zooms.
      if (e.ctrlKey) e.preventDefault();
    };

    document.addEventListener("keydown", enable);
    document.addEventListener("keyup", disable);
    window.addEventListener("blur", disableOnBlur);
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      document.removeEventListener("keydown", enable);
      document.removeEventListener("keyup", disable);
      window.removeEventListener("blur", disableOnBlur);
      container.removeEventListener("wheel", onWheel);
    };
  }, [map]);

  return null;
}

/** Keeps Leaflet's internal size in sync with its container. Leaflet only
 *  measures its container once on init — it never notices the hero card
 *  being resized by a breakpoint change or the browser's own
 *  resize/orientation events, which otherwise leaves stale gray tile gaps
 *  until the next manual pan/zoom.
 *
 *  It also keeps the zoom-out floor at "the whole city fits", which depends
 *  on the container's size, and frames the city on the first real
 *  measurement — the size at mount can be a layout pass too early. */
function MapResizeSync() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    let frame: number | null = null;
    let framed = false;
    const sync = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        map.invalidateSize({ animate: false });
        if (container.clientWidth === 0 || container.clientHeight === 0) return;
        map.setMinZoom(
          map.getBoundsZoom(CITY_EXTENT, false, point(CITY_PADDING))
        );
        if (!framed) {
          framed = true;
          map.fitBounds(CITY_EXTENT, { padding: CITY_PADDING, animate: false });
        }
      });
    };
    const observer = new ResizeObserver(sync);
    observer.observe(container);
    window.addEventListener("orientationchange", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", sync);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [map]);
  return null;
}

/** Flies the camera to the selected barangay; back to the whole city when the
 *  filter is cleared. Unlike dismissing a card on the DOTS Locator, clearing
 *  a filter here *means* "show me everything again", so the zoom-out is the
 *  answer to the action rather than a side effect of it. */
function FocusController({ target }: { target: BarangayPoint | null }) {
  const map = useMap();
  const hadTarget = useRef(false);
  useEffect(() => {
    if (target) {
      hadTarget.current = true;
      map.flyTo([target.lat, target.lon], FOCUS_ZOOM, FLY);
    } else if (hadTarget.current) {
      hadTarget.current = false;
      map.flyToBounds(CITY_EXTENT, { ...FLY, padding: CITY_PADDING });
    }
  }, [target, map]);
  return null;
}

/** While a barangay is open, a double-click / double-tap anywhere on the map
 *  closes it — the same as the ✕ in the search box — instead of zooming in. */
function DoubleClickExit({ active, onExit }: { active: boolean; onExit: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    map.doubleClickZoom.disable();
    const exit = () => onExit();
    map.on("dblclick", exit);
    return () => {
      map.off("dblclick", exit);
      map.doubleClickZoom.enable();
    };
  }, [active, map, onExit]);
  return null;
}

export function PublicCaseMap({
  className = "",
  mapClassName = "",
}: {
  /** Applied to the outer card. */
  className?: string;
  /** Height of the map region. From lg it also sets the panel's height,
   *  since the two sit in one row; below lg the panel takes its own height
   *  underneath the map. */
  mapClassName?: string;
}) {
  // Per-(year, barangay) totals, fetched once; the year toggle just regroups
  // them, so switching years needs no further request.
  const { rows: yearly, status } = usePublicYearlyCounts();
  const [year, setYear] = useState<"all" | number>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BarangayPoint | null>(null);
  const [coarse] = useState(isCoarsePointer);

  /** Years that hold cases, newest first. */
  const years = useMemo(
    () => [...new Set(yearly.map((y) => y.year))].sort((a, b) => b - a),
    [yearly]
  );

  const points = useMemo<BarangayPoint[]>(() => {
    const byPsgc = new Map<number, number>();
    for (const y of yearly) {
      if (year !== "all" && y.year !== year) continue;
      byPsgc.set(y.psgc, (byPsgc.get(y.psgc) ?? 0) + y.count);
    }
    return barangays
      .map((b) => ({
        psgc: b.psgc,
        name: b.name,
        lat: b.lat,
        lon: b.lon,
        count: byPsgc.get(b.psgc) ?? 0,
      }))
      .filter((b) => b.count > 0);
  }, [yearly, year]);

  // Keep an open barangay in step with the year: same place, that year's count.
  useEffect(() => {
    setSelected((s) => (s ? points.find((p) => p.psgc === s.psgc) ?? null : s));
  }, [points]);

  const maxCount = useMemo(
    () => points.reduce((m, p) => Math.max(m, p.count), 0),
    [points]
  );
  const totalCases = useMemo(
    () => points.reduce((s, p) => s + p.count, 0),
    [points]
  );
  const topBarangays = useMemo(
    () => [...points].sort((a, b) => b.count - a.count).slice(0, 5),
    [points]
  );

  // First-visit walkthrough. Opens by itself once, as soon as the totals are
  // in (the tour quotes the top barangay). The visit counts as seen the moment
  // it opens, so a returning visitor isn't walked through it again — the
  // "how to read this map" button still reopens it on demand.
  const cardRef = useRef<HTMLDivElement>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  useEffect(() => {
    if (status !== "ready" || hasSeenMapTour()) return;
    markSeen();
    setTourOpen(true);
  }, [status]);
  function openTour() {
    setTourStep(0);
    setTourOpen(true);
  }
  // On the "what red means" step the camera visits the top barangay; it
  // flies back to the city when the step or the tour ends.
  const tourOn = (s: number) => tourOpen && tourStep === s;
  const tourFocus = tourOn(MAP_TOUR_STEP.high) ? topBarangays[0] ?? null : null;

  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!normalizedQuery) return [];
    return points
      .filter((p) => p.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [points, normalizedQuery]);

  /** With a selection or live query, non-matching markers dim instead of
   *  vanishing so the city-wide picture stays readable. */
  function isMatch(p: BarangayPoint): boolean {
    if (selected) return p.psgc === selected.psgc;
    if (normalizedQuery) return p.name.toLowerCase().includes(normalizedQuery);
    return true;
  }
  const filtering = Boolean(selected || normalizedQuery);

  function pick(p: BarangayPoint) {
    setSelected(p);
    setQuery(p.name);
  }

  function clearFilter() {
    setSelected(null);
    setQuery("");
  }

  // Suggestions show while typing and give way once one is picked. They're
  // part of the panel's flow rather than a dropdown laid over it, so there is
  // no open/closed state to manage and nothing to dismiss.
  const showSuggestions = !selected && suggestions.length > 0;
  const noMatches =
    status === "ready" && !selected && normalizedQuery !== "" && suggestions.length === 0;

  // Until the first totals arrive, keep showing the same frameless spinner
  // the page shows while this chunk loads, rather than an empty bordered card
  // with placeholder bars. A return visit has cached totals and skips this.
  if (status === "loading") {
    return (
      <div className={"grid place-items-center " + mapClassName}>
        <LoadingSpinner tone="dark" label="Loading map…" />
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={
        // `isolate` traps the map's internal z-indexes (Leaflet panes go up
        // to 1000) inside this element so nothing paints above the site's
        // sticky header (z-40).
        "relative isolate z-0 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-brand-950 shadow-lift lg:grid lg:grid-cols-[minmax(0,1fr)_300px] " +
        className
      }
    >
      {/* ── Map ──────────────────────────────────────────────────────── */}
      <div
        data-tour="map"
        className={
          "relative min-h-0 min-w-0 " +
          mapClassName +
          // On the wrapper, not MapContainer: react-leaflet only reads the
          // map's className once, at creation.
          (tourOn(MAP_TOUR_STEP.welcome) ? " tour-breathe" : "")
        }
      >
        {!tourOpen && (
          <button
            type="button"
            onClick={openTour}
            className="absolute left-3 top-3 z-[1100] inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-brand-950/85 px-3.5 text-xs font-semibold text-slate-200 shadow-soft backdrop-blur transition-colors hover:bg-brand-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60"
          >
            <CircleHelp className="h-4 w-4 text-accent-400" />
            How to read this map
          </button>
        )}
        <MapContainer
          bounds={CITY_EXTENT}
          boundsOptions={{ padding: CITY_PADDING }}
          maxBounds={DAVAO_BOUNDS}
          maxBoundsViscosity={1}
          zoomControl={false}
          scrollWheelZoom={false}
          // On a phone the map is most of the first screen. With one-finger
          // drag on, Leaflet claims every swipe that starts on it
          // (`touch-action: none`) and the page can't be scrolled past it.
          // Off, the container falls back to `touch-action: pan-x pan-y`:
          // one finger scrolls the page, and a two-finger pinch still zooms
          // and pans the map.
          dragging={!coarse}
          zoomSnap={0.25}
          zoomDelta={0.5}
          wheelPxPerZoomLevel={90}
          attributionControl={false}
          className="pcm-map h-full w-full"
          style={{ background: "#061020" }}
        >
          <OpenFreeMapLayer styleName="dark" />
          <ZoomControl position="bottomright" />
          <MapResizeSync />
          <FocusController target={selected ?? tourFocus} />
          <CtrlScrollZoom />
          <DoubleClickExit active={filtering} onExit={clearFilter} />

          {points.map((p) => {
            const match = isMatch(p);
            const dim = filtering && !match;
            const fill = fillFor(p.count, maxCount);
            const r = radiusFor(p.count, maxCount);
            return (
              <Fragment key={p.psgc}>
                {/* Soft halo behind the bubble — blurred via CSS so the edge
                    melts into the map instead of cutting off sharply. */}
                <CircleMarker
                  center={[p.lat, p.lon]}
                  radius={r + 7}
                  interactive={false}
                  pathOptions={{
                    className: "pcm-glow",
                    stroke: false,
                    fillColor: fill,
                    fillOpacity: dim ? 0.04 : 0.3,
                  }}
                />
                <CircleMarker
                  center={[p.lat, p.lon]}
                  radius={r}
                  pathOptions={{
                    className: "pcm-core",
                    color: match && filtering ? "#f8fafc" : fill,
                    opacity: dim ? 0.2 : 0.8,
                    weight: match && filtering ? 1.5 : 1,
                    fillColor: fill,
                    fillOpacity: dim ? 0.08 : match && filtering ? 0.7 : 0.5,
                  }}
                  eventHandlers={{
                    click: () => pick(p),
                    // Double-click / double-tap on a bubble steps back out to
                    // the whole city. Stopped here so Leaflet's own
                    // double-click zoom doesn't push further in instead.
                    dblclick: (e) => {
                      DomEvent.stop(e);
                      clearFilter();
                    },
                  }}
                >
                  {/* A CircleMarker's tooltip anchors at the centre, not the
                      top edge, so a fixed offset let big bubbles poke through
                      the card. Clear the radius plus the r+7 halo instead. */}
                  <Tooltip
                    direction="top"
                    offset={[0, -(r + 10)]}
                    opacity={1}
                    className="pcm-tooltip"
                  >
                    {/* Animation lives on this inner card — Leaflet positions
                        the tooltip root with an inline transform, so animating
                        the root would fight it. */}
                    <div className="pcm-tooltip-inner text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ background: fill }}
                        />
                        <span className="text-xs font-semibold text-white">
                          {p.name}
                        </span>
                      </div>
                      <div className="mt-1 font-display text-3xl font-extrabold tabular-nums leading-none tracking-tight text-white">
                        {p.count.toLocaleString()}
                      </div>
                      <div className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-400">
                        case{p.count === 1 ? "" : "s"}
                      </div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              </Fragment>
            );
          })}

          {/* Tour, "what red means": a beacon over the top barangay while the
              camera visits it. */}
          {tourFocus && (
            <CircleMarker
              key={`beacon-${tourFocus.psgc}`}
              center={[tourFocus.lat, tourFocus.lon]}
              radius={radiusFor(tourFocus.count, maxCount) + 10}
              interactive={false}
              pathOptions={{
                className: "tour-beacon",
                color: "#f87171",
                weight: 2.5,
                fill: false,
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* ── Panel ────────────────────────────────────────────────────────
          Solid, not glass: it sits beside the map rather than over it, so
          there is nothing behind it to see through. `data-lenis-prevent`
          lets it scroll on its own from lg, where it's height-capped to the
          map's row — the site-wide smooth scroller otherwise swallows the
          wheel before it gets here. */}
      <aside
        data-tour="panel"
        data-lenis-prevent
        className="flex min-h-0 flex-col border-t border-white/10 bg-brand-950 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-t-0"
      >
        {/* Search */}
        <div className="border-b border-white/10 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              placeholder="Filter by barangay (e.g. Talomo)"
              aria-label="Filter the map by barangay"
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-9 text-sm text-white transition-colors duration-150 placeholder:text-slate-500 focus:border-accent-400/60 focus:bg-white/[0.07] focus:outline-none"
            />
            {filtering && (
              <button
                type="button"
                onClick={clearFilter}
                aria-label="Clear filter"
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {showSuggestions && (
            <ul className="mt-2 space-y-0.5">
              {suggestions.map((s) => (
                <li key={s.psgc}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-300 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-accent-400" />
                    <span className="truncate">{s.name}</span>
                    <span className="ml-auto font-semibold tabular-nums text-white">
                      {s.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {noMatches && (
            <p className="mt-2 px-2 text-xs text-slate-500">
              No barangay with recorded cases matches “{query.trim()}”.
            </p>
          )}

          {/* Selected barangay */}
          {selected && (
            <div className="mt-2 flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                  <MapPin className="h-4 w-4 shrink-0 text-accent-400" />
                  <span className="truncate">{selected.name}</span>
                </div>
                <div className="mt-1 font-display text-2xl font-extrabold tracking-tight text-white">
                  {selected.count.toLocaleString()}
                  <span className="ml-1.5 font-sans text-xs font-normal text-slate-400">
                    case{selected.count === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ background: fillFor(selected.count, maxCount) }}
              />
            </div>
          )}
        </div>

        {/* Citywide total */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-accent-400">
            <Activity className="h-4 w-4" />
          </span>
          {status === "ready" ? (
            <div>
              <div className="font-display text-xl font-extrabold leading-none tracking-tight text-white">
                {totalCases.toLocaleString()}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                cases · {points.length} barangays ·{" "}
                {year === "all" ? "all years" : year}
              </div>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-slate-400">
              Live case data is unavailable right now.{" "}
              <Link
                to="/dots-locator"
                className="font-semibold text-accent-400 transition-colors hover:text-accent-300"
              >
                Find care near you
              </Link>
            </p>
          )}
        </div>

        {/* Year filter — All years plus each year that has data */}
        {status === "ready" && years.length > 0 && (
          <div
            role="group"
            aria-label="Show cases from"
            className="flex flex-wrap gap-1 border-b border-white/10 px-4 py-3"
          >
            {(["all", ...years] as ("all" | number)[]).map((y) => {
              const on = y === year;
              return (
                <button
                  key={String(y)}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setYear(y)}
                  className={
                    "rounded-lg px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60 " +
                    (on
                      ? "bg-accent-500 text-brand-950"
                      : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white")
                  }
                >
                  {y === "all" ? "All years" : y}
                </button>
              );
            })}
          </div>
        )}

        {/* Most affected — tap a row to focus it */}
        {status !== "error" && (
          <div data-tour="top" className="flex-1 px-2 py-3">
            <div className="flex items-center gap-1.5 px-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <MapPin className="h-3.5 w-3.5 text-accent-400" />
              Most affected
            </div>
            <ul className="mt-2 space-y-0.5">
              {topBarangays.map((b) => {
                    const active = selected?.psgc === b.psgc;
                    return (
                      <li key={b.psgc}>
                        <button
                          type="button"
                          onClick={() => (active ? clearFilter() : pick(b))}
                          aria-pressed={active}
                          className={
                            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 " +
                            (active
                              ? "bg-white/10"
                              : tourFocus?.psgc === b.psgc
                                ? "bg-red-500/10 ring-1 ring-inset ring-red-400/40"
                                : "hover:bg-white/5")
                          }
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: fillFor(b.count, maxCount) }}
                          />
                          <span className="truncate text-slate-300">{b.name}</span>
                          <span className="ml-auto font-semibold tabular-nums text-white">
                            {b.count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
            </ul>
          </div>
        )}

        {/* Legend */}
        <div data-tour="legend" className="mt-auto border-t border-white/10 px-4 py-3">
          <div className="font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            Case density
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            {LEGEND_COLORS.map((color, i) => (
              <span
                key={color}
                className={
                  "h-2 flex-1 first:rounded-l-full last:rounded-r-full" +
                  (tourOn(MAP_TOUR_STEP.legend) ? " tour-legend-bar" : "")
                }
                // `color` feeds the sweep's drop-shadow via currentColor.
                style={{ background: color, color, animationDelay: `${i * 140}ms` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </aside>

      {tourOpen && (
        <MapTour
          containerRef={cardRef}
          step={tourStep}
          onStep={setTourStep}
          onClose={() => setTourOpen(false)}
          top={topBarangays[0] ?? null}
          legendColors={LEGEND_COLORS}
        />
      )}
    </div>
  );
}

export default PublicCaseMap;
