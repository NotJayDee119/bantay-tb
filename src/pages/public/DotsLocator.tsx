import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { OpenFreeMapLayer } from "../../components/OpenFreeMapLayer";
import {
  Phone,
  MapPin,
  Clock,
  Search,
  Navigation,
  Stethoscope,
  ExternalLink,
  Loader2,
  Route as RouteIcon,
  ArrowRight,
  X,
} from "lucide-react";
import { Badge, Button, Input, Skeleton } from "../../components/ui";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import { readPublicCache, writePublicCache } from "../../lib/publicCache";
import { haversineKm } from "../../lib/utils";
import barangays from "../../data/barangays.json";

interface DotsCenter {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lon: number;
  phone: string | null;
  hours: string | null;
  services: string[] | null;
}

interface RouteInfo {
  centerId: string;
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
}

const DAVAO_CENTER: [number, number] = [7.0731, 125.6128];

// Unselected pins are accent green; the picked one switches to the "vigil"
// amber signal. A hue jump — not another shade of green — is what makes the
// selection unmistakable at a glance, and amber stays clear of the sky-blue
// already used by the user dot and the route line.
const SELECTED_FILL = "#f59e0b"; // vigil-500
const SELECTED_STROKE = "#b45309";

// Close enough to read the surrounding blocks, but treated as a *floor*, not
// a target: picking a center never zooms the map back out from wherever the
// user had already worked their way in to. See FlyToCenter.
const MIN_SELECTED_ZOOM = 15;

// One shared duration and easing for every camera move on this page. Routing
// all of them through the same curve is what stops the map reading as several
// different animations fighting over the viewport.
const FLY = { duration: 0.7, easeLinearity: 0.22 } as const;

const userIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#0ea5e9;border:3px solid white;box-shadow:0 0 0 2px #0284c7;"></div>`,
  iconSize: [18, 18],
});

/** Builds the Google Maps directions hand-off.
 *
 *  `origin` matters more than it looks. Without it Google starts the route
 *  from its *own* idea of where you are, which on desktop and on a phone with
 *  Wi-Fi scanning off is an IP/network estimate — frequently the wrong
 *  barangay, sometimes the wrong city. This page already holds a real GPS fix
 *  by the time the button is reachable, so we hand that exact coordinate over
 *  and the two apps agree on the starting point.
 *
 *  It's passed only when we actually have a fix: an absent `origin` lets
 *  Google use live positioning, which is the right fallback and much better
 *  than seeding it with Davao's city centre or a searched barangay.
 *
 *  `travelmode=driving` matches the OSRM profile behind the distance and
 *  drive-time shown beside this button, so the figures don't contradict what
 *  Maps opens with. */
function directionsUrl(
  c: { lat: number; lon: number },
  origin: [number, number] | null
) {
  const params = new URLSearchParams({
    api: "1",
    destination: `${c.lat},${c.lon}`,
    travelmode: "driving",
  });
  if (origin) params.set("origin", `${origin[0]},${origin[1]}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Flies the map to the user's GPS position once it resolves. */
function FlyToPosition({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    map.flyTo(position, 14, FLY);
  }, [position, map]);
  return null;
}

/** Centres the map on the picked center.
 *
 *  Two restraints keep this from feeling like the map yanking itself around:
 *  it never zooms *out* (the requested level is a floor over the user's
 *  current one), and it stands down entirely while a route owns the camera —
 *  FitRoute's framing of both endpoints is the more useful view, and two fly
 *  animations racing each other just reads as jitter. */
function FlyToCenter({ center }: { center: { lat: number; lon: number } | null }) {
  const map = useMap();
  const lat = center?.lat;
  const lon = center?.lon;
  useEffect(() => {
    if (lat == null || lon == null) return;
    map.flyTo([lat, lon], Math.max(map.getZoom(), MIN_SELECTED_ZOOM), FLY);
  }, [lat, lon, map]);
  return null;
}

/** Zooms/pans the map to keep an entire drawn route in view — animated so
 *  the transition glides rather than snapping. */
function FitRoute({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    map.flyToBounds(L.latLngBounds(coords), { padding: [56, 56], ...FLY });
  }, [coords, map]);
  return null;
}

/** Keeps Leaflet's internal size in step with its container.
 *
 *  The map is a grid cell now rather than a fixed backdrop, so it resizes
 *  whenever the sidebar reflows or the layout crosses the lg breakpoint.
 *  Without this, Leaflet keeps rendering at the old dimensions and the tiles
 *  tear or grey out down one edge until the next interaction. */
function KeepMapSized() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        map.invalidateSize({ animate: false })
      );
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

// The center directory is public (anon-readable), so the last copy is kept to
// put the list on screen at once on a return visit.
const CENTERS_CACHE_KEY = "dots-centers:v1";

export function DotsLocator() {
  const [cachedCenters] = useState(() =>
    readPublicCache<DotsCenter[]>(CENTERS_CACHE_KEY)
  );
  const [centers, setCenters] = useState<DotsCenter[]>(cachedCenters ?? []);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cachedCenters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Bumped on every route request and on every clear. A response whose ticket
  // no longer matches has been superseded — by a different center, or by the
  // user dismissing the one it belongs to — and must not touch state, or it
  // paints a route for a center that is no longer selected.
  const routeTicket = useRef(0);
  // Watchdog that releases the "Use my location" button if the browser never
  // calls either geolocation callback. See locateMe().
  const locateTimer = useRef<number | null>(null);
  // The last center routing was *attempted* for. The auto-route effect below
  // reads it so that a failed attempt stays failed: without it, a routing
  // error leaves the effect's own preconditions satisfied again and it
  // re-fires itself in a loop against the OSRM server.
  const routedFor = useRef<string | null>(null);

  useEffect(() => {
    supabase
      .from("dots_centers")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          // A failed refresh keeps the stored list rather than replacing a
          // working page with an error.
          if (!cachedCenters) setError(error.message);
        } else {
          const rows = (data ?? []) as DotsCenter[];
          setCenters(rows);
          writePublicCache(CENTERS_CACHE_KEY, rows);
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once at mount
  }, []);

  const locateMe = useCallback(() => {
    if (locating) return;
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setError(null);
    setLocating(true);

    // A GPS fix can take a while, and the permission prompt's own wait isn't
    // counted against the timeout below — so the button could otherwise sit
    // spinning with no end in sight. Worse, a *dismissed* prompt (neither
    // allowed nor blocked) leaves some browsers calling neither callback,
    // which would strand the button disabled until a reload.
    //
    // The watchdog only releases the button and explains the stall; it
    // deliberately doesn't cancel anything, so a fix that shows up late is
    // still honoured below.
    if (locateTimer.current !== null) window.clearTimeout(locateTimer.current);
    locateTimer.current = window.setTimeout(() => {
      locateTimer.current = null;
      setLocating(false);
      setError(
        "Still waiting on your location — check the location permission for this site, or type your barangay name above."
      );
    }, 20000);

    const settle = () => {
      if (locateTimer.current !== null) {
        window.clearTimeout(locateTimer.current);
        locateTimer.current = null;
      }
      setLocating(false);
    };

    navigator.geolocation.getCurrentPosition(
      (p) => {
        settle();
        setError(null);
        setPos([p.coords.latitude, p.coords.longitude]);
      },
      (err) => {
        settle();
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was declined. Type your barangay name above to centre the map."
            : "GPS unavailable. Type your barangay name above to centre the map."
        );
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  }, [locating]);

  // The watchdog outlives a fast navigation away from the page otherwise.
  useEffect(
    () => () => {
      if (locateTimer.current !== null) window.clearTimeout(locateTimer.current);
    },
    []
  );

  const matchedBarangay = useMemo(() => {
    if (!query) return null;
    const q = query.toLowerCase();
    return barangays.find((b) => b.name.toLowerCase().includes(q)) ?? null;
  }, [query]);

  const referencePoint = useMemo<[number, number]>(
    () =>
      pos
        ? pos
        : matchedBarangay
          ? [matchedBarangay.lat, matchedBarangay.lon]
          : DAVAO_CENTER,
    [pos, matchedBarangay]
  );

  const sorted = useMemo(() => {
    return [...centers]
      .map((c) => ({
        ...c,
        distance: haversineKm(
          [referencePoint[1], referencePoint[0]],
          [c.lon, c.lat]
        ),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [centers, referencePoint]);

  const referenceLabel = pos
    ? "your GPS location"
    : matchedBarangay
      ? `Barangay ${matchedBarangay.name}`
      : "Davao City center";

  // Keeping the label on the button while it spins (rather than collapsing to
  // a bare spinner) holds its width steady and says what is being waited on.
  const locateLabel = locating
    ? "Finding your location…"
    : pos
      ? "Update my location"
      : "Use my location";

  const guideRoute = useCallback(async (c: DotsCenter, from: [number, number]) => {
    const ticket = ++routeTicket.current;
    routedFor.current = c.id;
    setSelectedId(c.id);
    setRoute(null);
    setRouteError(null);
    setRouteLoading(true);
    try {
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${from[1]},${from[0]};${c.lon},${c.lat}` +
        `?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (routeTicket.current !== ticket) return;
      const first = data?.routes?.[0];
      if (data?.code !== "Ok" || !first) {
        throw new Error("No route found");
      }
      const coords: [number, number][] = first.geometry.coordinates.map(
        ([lon, lat]: [number, number]) => [lat, lon]
      );
      setRoute({
        centerId: c.id,
        coords,
        distanceKm: first.distance / 1000,
        durationMin: first.duration / 60,
      });
    } catch {
      if (routeTicket.current !== ticket) return;
      setRouteError(
        "Couldn't calculate a route right now — try “Open in Maps” instead."
      );
    } finally {
      if (routeTicket.current === ticket) setRouteLoading(false);
    }
  }, []);

  /** Marker/list click: route immediately if we already have GPS, otherwise
   *  just select the center and wait — the effect below picks it up the
   *  moment location is granted. */
  function handleCenterClick(c: DotsCenter) {
    if (pos) {
      guideRoute(c, pos);
    } else {
      setSelectedId(c.id);
    }
  }

  // Once the user grants location after already picking a center, guide
  // them there automatically instead of making them click it again. Fires at
  // most once per center — a retry after a failure is the user's call, made by
  // clicking the row again.
  useEffect(() => {
    if (!pos || !selectedId || routedFor.current === selectedId) return;
    const c = centers.find((x) => x.id === selectedId);
    if (c) guideRoute(c, pos);
  }, [pos, selectedId, centers, guideRoute]);

  // Picking a pin on the map highlights a row that may be far down the list —
  // bring it into view so the map and the panel always agree on screen.
  // `nearest` leaves an already-visible row exactly where it is, so clicking
  // in the list itself doesn't cause a pointless jump.
  useEffect(() => {
    if (!selectedId) return;
    listRef.current
      ?.querySelector(`[data-center-id="${selectedId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  /** Drops the selection, which collapses the detail dock and clears the drawn
   *  route. The camera deliberately stays put: snapping back to a remembered
   *  overview moved the map out from under whoever was still reading it. */
  const clearSelection = useCallback(() => {
    routeTicket.current++;
    setSelectedId(null);
  }, []);

  // Route state is derived from the selection, so tearing it down lives here
  // rather than in each of the several places that can clear a selection.
  useEffect(() => {
    if (selectedId) return;
    routeTicket.current++;
    routedFor.current = null;
    setRoute(null);
    setRouteError(null);
    setRouteLoading(false);
  }, [selectedId]);

  // Esc is the reflex for "get this off my screen", and it's the only way to
  // drop a selection without aiming at the small X.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, clearSelection]);

  const selectedCenter = sorted.find((c) => c.id === selectedId) ?? null;

  // Zoom to the picked center unless a route is on its way — then FitRoute
  // frames the whole trip instead. Covers "no GPS" and "routing failed" alike.
  const zoomTarget = route || routeLoading ? null : selectedCenter;

  return (
    /* Two real columns, not a map with panels floating on top of it. The
       sidebar owns its own width, so nothing it contains ever covers the map,
       and the map is never read through a translucent sheet. Below lg the same
       two regions stack rather than overlap: map on top, sidebar beneath. */
    <div className="grid h-[calc(100dvh_-_65px)] w-full grid-rows-[42dvh_1fr] overflow-hidden bg-slate-100 lg:grid-cols-[400px_1fr] lg:grid-rows-1">
      {/* ─── Sidebar ───────────────────────────────────────────────── */}
      <aside className="order-2 flex min-h-0 min-w-0 flex-col border-slate-200 bg-white lg:order-1 lg:border-r">
        <header className="flex flex-none items-center gap-3 border-b border-slate-200 px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-950 text-white shadow-soft">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-700">
              For patients &amp; families
            </div>
            <h1 className="font-display text-lg font-extrabold tracking-tight text-slate-900">
              DOTS Center Locator
            </h1>
          </div>
        </header>

        <div className="flex-none space-y-2.5 border-b border-slate-200 bg-slate-50/70 px-4 py-3.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by barangay (e.g. Talomo, Buhangin)"
              className="rounded-full pl-10 pr-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            onClick={locateMe}
            variant="accent"
            loading={locating}
            aria-busy={locating}
            className="w-full justify-center gap-2"
          >
            {/* The Button renders its own spinner in place of this icon
                while loading, so they never stack up. */}
            {!locating && <Navigation className="h-4 w-4" />}
            {locateLabel}
          </Button>
          <p
            className="flex items-center gap-1.5 text-xs text-slate-500"
            aria-live="polite"
          >
            <MapPin
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-accent-500",
                locating && "animate-pulse"
              )}
            />
            {locating ? (
              "Waiting for a GPS fix…"
            ) : (
              <>
                Sorting from{" "}
                <span className="font-semibold text-slate-700">
                  {referenceLabel}
                </span>
              </>
            )}
          </p>
          {error && (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-none items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            {!loading && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-950 px-1.5 font-mono text-[10px] text-white">
                {sorted.length}
              </span>
            )}
            {loading
              ? "Loading centers…"
              : `${sorted.length === 1 ? "center" : "centers"} nearby`}
          </div>
          <Badge tone="accent">Tap a pin to route</Badge>
        </div>

        {/* `data-lenis-prevent` is what makes this list scrollable at all:
            the site-wide <ReactLenis root> in PublicLayout swallows wheel
            and touch events document-wide, and this page's map doesn't
            scroll, so without the opt-out the input goes nowhere. The
            attribute tells the root instance to leave this subtree to the
            browser's own scrolling. `overscroll-contain` then stops the
            scroll from chaining out to the page at either end. */}
        <div
          ref={listRef}
          data-lenis-prevent
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <ul className="space-y-1 p-2">
            {/* Rows shaped like the real ones, so the list settles into place
                instead of swapping a line of text for a full column. */}
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex items-start gap-2.5 p-3">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3 rounded" />
                    <Skeleton className="h-3 w-full rounded" />
                  </div>
                </li>
              ))}
            {!loading && sorted.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                No DOTS centers in the database yet.
              </li>
            )}
            {!loading &&
              sorted.map((c) => {
                const isSelected = selectedId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      data-center-id={c.id}
                      aria-pressed={isSelected}
                      onClick={() => handleCenterClick(c)}
                      className={cn(
                        "group block w-full rounded-xl border p-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
                        isSelected
                          ? "border-vigil-300 bg-vigil-300/10"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
                            isSelected
                              ? "bg-vigil-500 text-white"
                              : "bg-brand-50 text-brand-700 group-hover:bg-brand-950 group-hover:text-white"
                          )}
                        >
                          <Stethoscope className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {c.name}
                            </div>
                            <Badge tone="default" className="shrink-0">
                              {c.distance.toFixed(1)} km
                            </Badge>
                          </div>
                          {c.address && (
                            <div className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                              {c.address}
                            </div>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            {c.phone && (
                              <a
                                href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`}
                                className="inline-flex items-center gap-1 hover:text-brand-700"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="h-3 w-3" /> {c.phone}
                              </a>
                            )}
                            {c.hours && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {c.hours}
                              </span>
                            )}
                            <span className="ml-auto inline-flex items-center gap-1 font-semibold text-accent-700">
                              <RouteIcon className="h-3 w-3" /> Route
                              <ArrowRight className="h-3 w-3 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>

        {/* ─── Detail dock — the one place a selection ever reports to ──
            It lives inside the sidebar column rather than floating over the
            map, so it covers nothing, needs no backdrop blur, and can never
            end up stacked under a map popup repeating the same facts. */}
        {selectedCenter && (
          <section
            className="dl-dock-in flex-none border-t border-slate-200 bg-white p-4"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-vigil-500 text-white shadow-soft">
                <Stethoscope className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {selectedCenter.name}
                </div>
                {selectedCenter.address && (
                  <div className="truncate text-xs text-slate-500">
                    {selectedCenter.address}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Clear selection"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!pos && (
              <>
                <p className="mt-2.5 text-xs text-slate-600">
                  {locating
                    ? "Finding you — the route draws itself the moment your location lands."
                    : "Turn on your location and I’ll draw the route here."}
                </p>
                <Button
                  onClick={locateMe}
                  variant="accent"
                  loading={locating}
                  aria-busy={locating}
                  className="mt-3 w-full justify-center gap-2"
                >
                  {!locating && <Navigation className="h-4 w-4" />}
                  {locateLabel}
                </Button>
              </>
            )}

            {pos && routeLoading && (
              <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-600" />
                Calculating route&hellip;
              </div>
            )}

            {pos && routeError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                {routeError}
              </div>
            )}

            {pos && route && !routeLoading && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    <RouteIcon className="h-3 w-3 text-accent-600" /> Distance
                  </div>
                  <div className="font-display text-lg font-extrabold tracking-tight text-slate-900">
                    {route.distanceKm.toFixed(1)}
                    <span className="ml-0.5 text-xs font-medium text-slate-400">
                      km
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    <Clock className="h-3 w-3 text-accent-600" /> Drive time
                  </div>
                  <div className="font-display text-lg font-extrabold tracking-tight text-slate-900">
                    ~{Math.round(route.durationMin)}
                    <span className="ml-0.5 text-xs font-medium text-slate-400">
                      min
                    </span>
                  </div>
                </div>
              </div>
            )}

            <a
              href={directionsUrl(selectedCenter, pos)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block"
            >
              <Button variant="secondary" className="w-full justify-center gap-2">
                Open in Maps for navigation
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </section>
        )}
      </aside>

      {/* ─── Map ───────────────────────────────────────────────────── */}
      <div className="relative order-1 min-h-0 min-w-0 lg:order-2">
        <MapContainer
          center={referencePoint}
          zoom={12}
          zoomControl={false}
          // Continuous fractional zoom — with GL-rendered vector tiles the map
          // can rest at any zoom level, so the wheel/trackpad glides instead of
          // snapping to steps. Buttons still jump a clean half-level.
          zoomSnap={0}
          zoomDelta={0.5}
          wheelPxPerZoomLevel={120}
          wheelDebounceTime={30}
          className="dl-map h-full w-full"
        >
          <OpenFreeMapLayer styleName="positron" />
          <ZoomControl position="bottomright" />
          <KeepMapSized />
          <FlyToPosition position={pos} />
          <FlyToCenter center={zoomTarget} />
          {route && <FitRoute coords={route.coords} />}

          {pos && (
            <Marker position={pos} icon={userIcon}>
              <Tooltip direction="top" offset={[0, -12]}>
                You are here
              </Tooltip>
            </Marker>
          )}

          {route && (
            <Polyline
              positions={route.coords}
              pathOptions={{ color: "#0ea5e9", weight: 5, opacity: 0.85 }}
            />
          )}

          {/* Soft halo under the picked center — rendered before the pins so it
              sits beneath them and reads as a glow, not a second marker. */}
          {selectedCenter && (
            <CircleMarker
              center={[selectedCenter.lat, selectedCenter.lon]}
              radius={22}
              interactive={false}
              pathOptions={{
                color: SELECTED_FILL,
                fillColor: SELECTED_FILL,
                fillOpacity: 0.18,
                opacity: 0.35,
                weight: 1,
              }}
            />
          )}

          {sorted.map((c) => {
            const isSelected = selectedId === c.id;
            // Once a center is picked the others step back so the amber pin is
            // the only one competing for attention — but they stay legible
            // enough to pick the next one straight off the map.
            const dimmed = Boolean(selectedId) && !isSelected;
            return (
              <CircleMarker
                key={c.id}
                center={[c.lat, c.lon]}
                radius={isSelected ? 13 : 9}
                pathOptions={{
                  color: isSelected ? SELECTED_STROKE : "#ffffff",
                  fillColor: isSelected ? SELECTED_FILL : "#059669",
                  fillOpacity: dimmed ? 0.6 : 0.95,
                  opacity: dimmed ? 0.7 : 1,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{ click: () => handleCenterClick(c) }}
              >
                {/* A hover tooltip, not a click popup. The full record is
                    already on screen in the sidebar dock the moment a pin is
                    clicked; a popup would repeat it over the map, cover the
                    pin it describes, and then need dismissing on its own. */}
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <span className="font-semibold">{c.name}</span>
                  <span className="ml-1.5 text-slate-500">
                    {c.distance.toFixed(1)} km
                  </span>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
