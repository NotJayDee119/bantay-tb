import { useEffect, useMemo, useRef, useState } from "react";
import Lenis from "lenis";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
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
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Route as RouteIcon,
  ArrowRight,
  X,
} from "lucide-react";
import { Badge, Button, Input } from "../../components/ui";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
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

const userIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#0ea5e9;border:3px solid white;box-shadow:0 0 0 2px #0284c7;"></div>`,
  iconSize: [18, 18],
});

function directionsUrl(c: { lat: number; lon: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}`;
}

/** Flies the map to the user's GPS position once it resolves. */
function FlyToPosition({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    map.flyTo(position, 14, { duration: 0.8 });
  }, [position, map]);
  return null;
}

/** Zooms/pans the map to keep an entire drawn route in view — animated so
 *  the transition glides rather than snapping. */
function FitRoute({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length < 2) return;
    map.flyToBounds(L.latLngBounds(coords), {
      padding: [64, 64],
      duration: 0.8,
    });
  }, [coords, map]);
  return null;
}

export function DotsLocator() {
  const [centers, setCenters] = useState<DotsCenter[]>([]);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The page itself is a fixed-height, non-scrolling map, so the site-wide
  // <ReactLenis root> in PublicLayout has nothing to smooth here. The nearby-
  // centers list is the only scroll surface — give it its own nested Lenis
  // instance so the wheel/trackpad glides with the same easing as the rest of
  // the site instead of stepping. `wrapper` is the overflow container, `content`
  // its inner <ul>; Lenis watches the content's size on its own as items load.
  useEffect(() => {
    const wrapper = listRef.current;
    const content = wrapper?.firstElementChild as HTMLElement | null;
    if (!wrapper || !content) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      wrapper,
      content,
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    supabase
      .from("dots_centers")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else {
          setCenters((data ?? []) as DotsCenter[]);
        }
        setLoading(false);
      });
  }, []);

  function locateMe() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      () => {
        setError(
          "GPS unavailable. Type your barangay name above to centre the map."
        );
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  }

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

  async function guideRoute(c: DotsCenter) {
    setSelectedId(c.id);
    setRoute(null);
    setRouteError(null);
    setRouteLoading(true);
    try {
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${pos![1]},${pos![0]};${c.lon},${c.lat}` +
        `?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
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
      setRouteError(
        "Couldn't calculate a route right now — try “Open in Maps” instead."
      );
    } finally {
      setRouteLoading(false);
    }
  }

  /** Marker/list click: route immediately if we already have GPS, otherwise
   *  just select the center and wait — the effect below picks it up the
   *  moment location is granted. */
  function handleCenterClick(c: DotsCenter) {
    if (pos) {
      guideRoute(c);
    } else {
      setSelectedId(c.id);
      setRoute(null);
      setRouteError(null);
    }
  }

  // Once the user grants location after already picking a center, guide
  // them there automatically instead of making them click it again.
  useEffect(() => {
    if (!pos || !selectedId || route || routeLoading) return;
    const c = sorted.find((x) => x.id === selectedId);
    if (c) guideRoute(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, selectedId]);

  function clearRoute() {
    setSelectedId(null);
    setRoute(null);
    setRouteError(null);
  }

  const selectedCenter = sorted.find((c) => c.id === selectedId) ?? null;
  const showLocationPrompt = selectedCenter && !pos;
  const showRouteCard = selectedCenter && pos && (route || routeLoading || routeError);

  return (
    <div className="relative h-[calc(100dvh_-_65px)] w-full overflow-hidden bg-slate-100">
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
        className="h-full w-full"
      >
        <OpenFreeMapLayer styleName="positron" />
        <ZoomControl position="bottomright" />
        <FlyToPosition position={pos} />
        {route && <FitRoute coords={route.coords} />}

        {pos && (
          <Marker position={pos} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {route && (
          <Polyline
            positions={route.coords}
            pathOptions={{ color: "#0ea5e9", weight: 5, opacity: 0.85 }}
          />
        )}

        {sorted.map((c) => (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lon]}
            radius={selectedId === c.id ? 13 : 9}
            pathOptions={{
              color: selectedId === c.id ? "#047857" : "#ffffff",
              fillColor: selectedId === c.id ? "#10b981" : "#059669",
              fillOpacity: 0.95,
              weight: selectedId === c.id ? 3 : 2,
            }}
            eventHandlers={{ click: () => handleCenterClick(c) }}
          >
            <Popup>
              <div className="space-y-1">
                <div className="font-semibold">{c.name}</div>
                {c.address && (
                  <div className="text-xs text-slate-600">{c.address}</div>
                )}
                {c.phone && (
                  <div className="text-xs">
                    <Phone className="mr-1 inline h-3 w-3" /> {c.phone}
                  </div>
                )}
                {c.hours && (
                  <div className="text-xs">
                    <Clock className="mr-1 inline h-3 w-3" /> {c.hours}
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* ─── Floating search + list panel ──────────────────────────── */}
      <div className="absolute left-3 right-3 top-3 z-[500] flex max-h-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-lift backdrop-blur-xl sm:left-4 sm:right-auto sm:top-4 sm:w-[380px]">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          className="flex flex-none items-center gap-3 px-4 py-3.5 text-left"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-950 text-white shadow-soft">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-700">
              For patients &amp; families
            </div>
            <h1 className="font-display text-lg font-extrabold tracking-tight text-slate-900">
              DOTS Center Locator
            </h1>
          </div>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 sm:hidden">
            {panelOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </button>

        {/* Below sm, visibility follows panelOpen; at sm and up this stays
            visible regardless of that state, so the toggle can never leave
            desktop users unable to reach the search/list content. */}
        <div
          className={cn(
            "min-h-0 flex-col overflow-hidden sm:flex",
            panelOpen ? "flex" : "hidden"
          )}
        >
            <div className="flex-none space-y-2.5 border-y border-slate-200 bg-slate-50/70 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by barangay (e.g. Talomo, Buhangin)"
                  className="rounded-full pl-10"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={locateMe}
                variant="accent"
                className="w-full justify-center gap-2"
              >
                <Navigation className="h-4 w-4" /> Use my location
              </Button>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-accent-500" />
                Sorting from{" "}
                <span className="font-semibold text-slate-700">{referenceLabel}</span>
              </p>
              {error && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
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

            <div ref={listRef} className="flex-1 overflow-y-auto">
            <ul className="space-y-1.5 p-2">
              {loading && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">
                  Fetching DOTS centers…
                </li>
              )}
              {!loading && sorted.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">
                  No DOTS centers in the database yet.
                </li>
              )}
              {sorted.map((c) => {
                const isSelected = selectedId === c.id;
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "group cursor-pointer rounded-xl border p-3 transition-all duration-200",
                      isSelected
                        ? "border-accent-300 bg-accent-50/70 shadow-soft"
                        : "border-transparent hover:border-slate-200 hover:bg-slate-50 hover:shadow-soft"
                    )}
                    onClick={() => handleCenterClick(c)}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
                          isSelected
                            ? "bg-accent-600 text-white"
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
                  </li>
                );
              })}
            </ul>
            </div>
        </div>
      </div>

      {/* ─── Location prompt — center picked, no GPS yet ───────────── */}
      {showLocationPrompt && selectedCenter && (
        <div className="dl-card-in absolute inset-x-3 bottom-3 z-[500] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[380px]">
          <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-lift backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                <Stethoscope className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {selectedCenter.name}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Turn on your location and I&rsquo;ll draw the route here.
                </p>
              </div>
              <button
                type="button"
                onClick={clearRoute}
                aria-label="Clear selection"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Button
              onClick={locateMe}
              variant="accent"
              className="mt-3 w-full justify-center gap-2"
            >
              <Navigation className="h-4 w-4" /> Use my location
            </Button>
          </div>
        </div>
      )}

      {/* ─── Route summary card — GPS known, route requested ───────── */}
      {showRouteCard && selectedCenter && (
        <div className="dl-card-in absolute inset-x-3 bottom-3 z-[500] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[380px]">
          <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-lift backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-600 text-white shadow-soft">
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
                onClick={clearRoute}
                aria-label="Clear route"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {routeLoading && (
              <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-600" />
                Calculating route&hellip;
              </div>
            )}

            {routeError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                {routeError}
              </div>
            )}

            {route && !routeLoading && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    <RouteIcon className="h-3 w-3 text-accent-600" /> Distance
                  </div>
                  <div className="font-display text-lg font-extrabold tracking-tight text-slate-900">
                    {route.distanceKm.toFixed(1)}
                    <span className="ml-0.5 text-xs font-medium text-slate-400">km</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    <Clock className="h-3 w-3 text-accent-600" /> Drive time
                  </div>
                  <div className="font-display text-lg font-extrabold tracking-tight text-slate-900">
                    ~{Math.round(route.durationMin)}
                    <span className="ml-0.5 text-xs font-medium text-slate-400">min</span>
                  </div>
                </div>
              </div>
            )}

            <a
              href={directionsUrl(selectedCenter)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block"
            >
              <Button variant="accent" className="w-full justify-center gap-2">
                Open in Maps for navigation
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
