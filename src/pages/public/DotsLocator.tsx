import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import { Phone, MapPin, Clock, Search } from "lucide-react";
import { Card, Input } from "../../components/ui";
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
        // Fallback: pick the centroid of the matched barangay (search box).
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
        distance: haversineKm([referencePoint[1], referencePoint[0]], [c.lon, c.lat]),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [centers, referencePoint]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">DOTS Center Locator</h1>
        <p className="mt-1 text-slate-600">
          Find the nearest TB-DOTS treatment facility. No login required.
        </p>
      </header>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          onClick={locateMe}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <MapPin className="h-4 w-4" /> Use my location
        </button>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by barangay (e.g. Talomo, Buhangin, Agdao)"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden p-0">
          <MapContainer
            center={referencePoint}
            zoom={12}
            style={{ height: 480, width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
            />
            {pos && (
              <Marker position={pos} icon={userIcon}>
                <Popup>You are here</Popup>
              </Marker>
            )}
            {centers.map((c) => (
              <CircleMarker
                key={c.id}
                center={[c.lat, c.lon]}
                radius={9}
                pathOptions={{ color: "#0284c7", fillColor: "#38bdf8", fillOpacity: 0.85 }}
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
        </Card>
        <Card className="overflow-y-auto p-0" >
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">
              {loading ? "Loading…" : `${sorted.length} centers, nearest first`}
            </div>
            <div className="text-xs text-slate-500">
              Distances measured from {pos ? "your GPS location" : matchedBarangay ? matchedBarangay.name : "Davao City center"}.
            </div>
          </div>
          <ul className="divide-y divide-slate-200">
            {sorted.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-xs font-semibold text-brand-600">
                    {c.distance.toFixed(1)} km
                  </div>
                </div>
                {c.address && (
                  <div className="text-xs text-slate-600">{c.address}</div>
                )}
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                  {c.phone && (
                    <span>
                      <Phone className="mr-1 inline h-3 w-3" />
                      {c.phone}
                    </span>
                  )}
                  {c.hours && (
                    <span>
                      <Clock className="mr-1 inline h-3 w-3" />
                      {c.hours}
                    </span>
                  )}
                </div>
              </li>
            ))}
            {!loading && sorted.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                No DOTS centers in the database yet.
              </li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
