import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import {
  Phone,
  MapPin,
  Clock,
  Search,
  Navigation,
  Stethoscope,
  ChevronRight,
  Heart,
} from "lucide-react";
import { motion } from "motion/react";
import { Badge, Button, Input, MotionCard } from "../../components/ui";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabase";
import { haversineKm } from "../../lib/utils";
import barangays from "../../data/barangays.json";
import heroImage from "../../assets/davao_city_midnight_blue_20260528_090346.png";

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

const DAVAO_CENTER: [number, number] = [7.0731, 125.6128];

const userIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#0ea5e9;border:3px solid white;box-shadow:0 0 0 2px #0284c7;"></div>`,
  iconSize: [18, 18],
});

export function DotsLocator() {
  const [centers, setCenters] = useState<DotsCenter[]>([]);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  return (
    <>
      {/* ─── Hero Header with Search ───────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-900/75 to-brand-900/85" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
              <Heart className="h-4 w-4" />
              For patients &amp; families
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              DOTS Center Locator
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-200">
              Find the nearest TB-DOTS treatment facility across Davao City. Free
              diagnostics and medication for tuberculosis. No login required.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
            className="mt-8 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                onClick={locateMe}
                className="shrink-0 sm:w-auto"
              >
                <Navigation className="h-4 w-4" /> Use my location
              </Button>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by barangay (e.g. Talomo, Buhangin, Agdao)"
                  className="border-white/20 bg-white/90 pl-9 shadow-none placeholder:text-slate-400"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-white/70">
              <MapPin className="h-3.5 w-3.5 text-white/50" />
              Sorting from{" "}
              <span className="font-medium text-white">{referenceLabel}</span>
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── Map + List ────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {error && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <MotionCard className="overflow-hidden p-0 ring-1 ring-slate-200">
            <MapContainer
              center={referencePoint}
              zoom={12}
              style={{ height: 520, width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                subdomains={["a", "b", "c", "d"]}
                maxZoom={19}
              />
              {pos && (
                <Marker position={pos} icon={userIcon}>
                  <Popup>You are here</Popup>
                </Marker>
              )}
              {sorted.map((c) => (
                <CircleMarker
                  key={c.id}
                  center={[c.lat, c.lon]}
                  radius={selectedId === c.id ? 12 : 9}
                  pathOptions={{
                    color: selectedId === c.id ? "#0369a1" : "#0284c7",
                    fillColor: selectedId === c.id ? "#0ea5e9" : "#38bdf8",
                    fillOpacity: 0.9,
                    weight: selectedId === c.id ? 3 : 2,
                  }}
                  eventHandlers={{ click: () => setSelectedId(c.id) }}
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
          </MotionCard>

          <MotionCard delay={0.1} className="flex flex-col overflow-hidden p-0 lg:h-[520px]">
            <div className="flex-none border-b border-slate-200 bg-brand-50/60 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  {loading
                    ? "Loading centers..."
                    : `${sorted.length} ${sorted.length === 1 ? "center" : "centers"} nearby`}
                </div>
                <Badge tone="info">Sorted by distance</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Scroll the list to see every facility, or click a pin on the
                map.
              </p>
            </div>

            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {loading && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">
                  Fetching DOTS centers...
                </li>
              )}
              {!loading && sorted.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-slate-500">
                  No DOTS centers in the database yet.
                </li>
              )}
              {sorted.map((c) => {
                const isSelected = selectedId === c.id;
                const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}`;
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "cursor-pointer px-4 py-3 transition",
                      isSelected
                        ? "border-l-2 border-brand-600 bg-brand-50/70 pl-[14px]"
                        : "hover:bg-slate-50"
                    )}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 flex-none text-brand-600" />
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {c.name}
                          </div>
                        </div>
                        {c.address && (
                          <div className="mt-0.5 line-clamp-2 pl-6 text-xs text-slate-600">
                            {c.address}
                          </div>
                        )}
                      </div>
                      <Badge tone="default" className="shrink-0">
                        {c.distance.toFixed(1)} km
                      </Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs text-slate-500">
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
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-800"
                      >
                        Directions <ChevronRight className="h-3 w-3" />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </MotionCard>
        </div>
      </div>
    </>
  );
}
