import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import { Activity, Loader2, MapPin, Search, X } from "lucide-react";
import { OpenFreeMapLayer } from "./OpenFreeMapLayer";
import { supabase } from "../lib/supabase";
import barangays from "../data/barangays.json";

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
 */

const DAVAO_CENTER: [number, number] = [7.0731, 125.6128];
const DAVAO_ZOOM = 11;
const FOCUS_ZOOM = 13.5;

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

/** Google-Maps-style wheel behavior: plain scroll keeps scrolling the page
 *  (with a brief hint), Ctrl+scroll zooms the map. */
function CtrlScrollZoom({ onPlainWheel }: { onPlainWheel: () => void }) {
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
      if (e.ctrlKey) {
        // Stop the browser's page-zoom; Leaflet's (now enabled) handler zooms.
        e.preventDefault();
      } else {
        onPlainWheel();
      }
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
  }, [map, onPlainWheel]);

  return null;
}

/** Keeps Leaflet's internal size in sync with its container. Leaflet only
 *  measures its container once on init — it never notices the hero card
 *  being resized by a breakpoint change, a GSAP entrance tween, or the
 *  browser's own resize/orientation events, which otherwise leaves stale
 *  gray tile gaps until the next manual pan/zoom. */
function MapResizeSync() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    let frame: number | null = null;
    const sync = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        map.invalidateSize({ animate: false });
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

/** Flies the camera to the selected barangay; resets when cleared. */
function FocusController({ target }: { target: BarangayPoint | null }) {
  const map = useMap();
  const hadTarget = useRef(false);
  useEffect(() => {
    if (target) {
      hadTarget.current = true;
      map.flyTo([target.lat, target.lon], FOCUS_ZOOM, { duration: 0.9 });
    } else if (hadTarget.current) {
      hadTarget.current = false;
      map.flyTo(DAVAO_CENTER, DAVAO_ZOOM, { duration: 0.9 });
    }
  }, [target, map]);
  return null;
}

export function PublicCaseMap({ className = "" }: { className?: string }) {
  const [points, setPoints] = useState<BarangayPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BarangayPoint | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [zoomHint, setZoomHint] = useState(false);
  const zoomHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Plain (no-Ctrl) scroll over the map → flash the how-to-zoom hint. */
  const showZoomHint = useCallback(() => {
    setZoomHint(true);
    if (zoomHintTimer.current) clearTimeout(zoomHintTimer.current);
    zoomHintTimer.current = setTimeout(() => setZoomHint(false), 1500);
  }, []);

  useEffect(
    () => () => {
      if (zoomHintTimer.current) clearTimeout(zoomHintTimer.current);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc("barangay_case_counts", { p_disease: "tb", p_days: 365 })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setStatus("error");
          return;
        }
        const byPsgc = new Map<number, number>(
          (data as { barangay_psgc: number; case_count: number }[]).map((d) => [
            Number(d.barangay_psgc),
            Number(d.case_count),
          ])
        );
        const joined: BarangayPoint[] = barangays
          .map((b) => ({
            psgc: b.psgc,
            name: b.name,
            lat: b.lat,
            lon: b.lon,
            count: byPsgc.get(b.psgc) ?? 0,
          }))
          .filter((b) => b.count > 0);
        setPoints(joined);
        setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setSuggestionsOpen(false);
  }

  function clearFilter() {
    setSelected(null);
    setQuery("");
    setSuggestionsOpen(false);
  }

  return (
    <div
      className={
        // `isolate` traps the map's internal z-indexes (Leaflet panes go up
        // to 1000) inside this element so overlays never paint above the
        // site's sticky header (z-40).
        "relative isolate z-0 overflow-hidden rounded-2xl border border-white/10 bg-brand-950 shadow-lift " +
        className
      }
    >
      <MapContainer
        center={DAVAO_CENTER}
        zoom={DAVAO_ZOOM}
        zoomControl={false}
        scrollWheelZoom={false}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={90}
        attributionControl={false}
        className="h-full w-full"
        style={{ background: "#061020" }}
      >
        <OpenFreeMapLayer styleName="dark" />
        <ZoomControl position="bottomright" />
        <MapResizeSync />
        <FocusController target={selected} />
        <CtrlScrollZoom onPlainWheel={showZoomHint} />

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
                eventHandlers={{ click: () => pick(p) }}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -8]}
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
                    <div className="mt-1 font-display text-3xl font-extrabold leading-none tracking-tight text-white">
                      {p.count}
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
      </MapContainer>

      {/* ── Filter panel — search barangays, pick to fly there ─────── */}
      <div className="absolute left-3 top-3 z-[500] w-[calc(100%-1.5rem)] max-w-[20rem] sm:left-4 sm:top-4">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-brand-950/90 shadow-lift backdrop-blur">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                setSuggestionsOpen(true);
              }}
              onFocus={() => setSuggestionsOpen(true)}
              placeholder="Filter by barangay (e.g. Talomo)"
              className="w-full bg-transparent py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            {filtering && (
              <button
                type="button"
                onClick={clearFilter}
                aria-label="Clear filter"
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {suggestionsOpen && suggestions.length > 0 && !selected && (
            <ul className="max-h-52 overflow-y-auto border-t border-white/10">
              {suggestions.map((s) => (
                <li key={s.psgc}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
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
        </div>

        {/* Selected barangay detail card */}
        {selected && (
          <div className="mt-2 rounded-xl border border-white/10 bg-brand-950/90 p-3 shadow-lift backdrop-blur">
            <div className="flex items-start justify-between gap-2">
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
          </div>
        )}
      </div>

      {/* ── Citywide total — below the search panel on phones so the two
            never collide; top-right corner from sm up ────────────────── */}
      {status === "ready" && totalCases > 0 && (
        <div className="pointer-events-none absolute right-3 top-3 z-[500] hidden sm:right-4 sm:top-4 sm:block">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-brand-950/90 px-3 py-2 shadow-lift backdrop-blur">
            <Activity className="h-4 w-4 text-accent-400" />
            <div>
              <div className="font-display text-lg font-extrabold leading-none tracking-tight text-white">
                {totalCases.toLocaleString()}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                cases · {points.length} barangays
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Most affected — tap a row to focus it ───────────────────── */}
      {status === "ready" && topBarangays.length > 0 && (
        <div className="absolute bottom-3 right-3 z-[500] hidden w-48 rounded-xl border border-white/10 bg-brand-950/90 p-3 shadow-lift backdrop-blur md:block lg:bottom-4 lg:right-14">
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <MapPin className="h-3.5 w-3.5 text-accent-400" />
            Most affected
          </div>
          <ul className="mt-2 space-y-0.5">
            {topBarangays.map((b) => (
              <li key={b.psgc}>
                <button
                  type="button"
                  onClick={() => pick(b)}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs transition hover:bg-white/10"
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
            ))}
          </ul>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 z-[500] rounded-xl border border-white/10 bg-brand-950/90 px-3 py-2 shadow-lift backdrop-blur sm:bottom-4 sm:left-4">
        <div className="font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          Case density
        </div>
        <div className="mt-1 flex items-center gap-1">
          {LEGEND_COLORS.map((color) => (
            <span
              key={color}
              className="h-2 w-5 first:rounded-l-full last:rounded-r-full"
              style={{ background: color }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
          <span>Low</span>
          <span>High</span>
        </div>
        {/* Compact citywide total for phones — the top-right chip is hidden there */}
        {status === "ready" && totalCases > 0 && (
          <div className="mt-1.5 border-t border-white/10 pt-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-400 sm:hidden">
            <span className="font-sans text-xs font-bold normal-case tracking-normal text-white">
              {totalCases.toLocaleString()}
            </span>{" "}
            cases · {points.length} bgys
          </div>
        )}
      </div>

      {/* ── Ctrl+scroll hint — flashes on plain scroll, like Google Maps */}
      <div
        aria-hidden={!zoomHint}
        className={
          "pointer-events-none absolute inset-0 z-[600] grid place-items-center bg-brand-950/40 transition-opacity duration-300 " +
          (zoomHint ? "opacity-100" : "opacity-0")
        }
      >
        <p className="rounded-full border border-white/15 bg-brand-950/90 px-5 py-2.5 text-sm font-medium text-white shadow-lift backdrop-blur">
          Use <kbd className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-xs">Ctrl</kbd> + scroll to zoom the map
        </p>
      </div>

      {/* ── Loading / error overlays ────────────────────────────────── */}
      {status === "loading" && (
        <div className="absolute inset-0 z-[400] grid place-items-center bg-brand-950/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-accent-400" />
            Loading case map…
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-[400] grid place-items-center bg-brand-950/70 p-6 text-center backdrop-blur-sm">
          <p className="max-w-xs text-sm text-slate-300">
            Live case data is unavailable right now. Explore the{" "}
            <span className="font-semibold text-white">DOTS Locator</span> to find care near you.
          </p>
        </div>
      )}
    </div>
  );
}

export default PublicCaseMap;
