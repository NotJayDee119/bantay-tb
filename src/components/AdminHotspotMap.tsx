import { useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  Circle,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import type {
  BarangayStat,
  HotspotCluster,
  HotspotInsights,
  HotspotSeverity,
} from "../lib/hotspotUtils";

interface AdminHotspotMapProps {
  hotspotInsights: HotspotInsights | null;
  focusBarangay?: string | null;
}

const DAVAO_CENTER: [number, number] = [7.0731, 125.6128];
const DAVAO_ZOOM = 11;
const FOCUS_ZOOM = 14;

const SEVERITY_COLOR: Record<HotspotSeverity, string> = {
  low: "#fbbf24",
  medium: "#f97316",
  high: "#dc2626",
};

const SEVERITY_LABEL: Record<HotspotSeverity, string> = {
  low: "Low density",
  medium: "Medium density",
  high: "High density",
};

function barangayColor(count: number, max: number): string {
  if (max <= 0 || count <= 0) return "#94a3b8";
  const ratio = count / max;
  if (ratio < 0.2) return "#bae6fd";
  if (ratio < 0.4) return "#7dd3fc";
  if (ratio < 0.6) return "#38bdf8";
  if (ratio < 0.8) return "#f97316";
  return "#dc2626";
}

function barangayRadius(count: number, max: number): number {
  if (max <= 0) return 6;
  const ratio = Math.sqrt(count / max);
  return 6 + ratio * 16;
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
}: AdminHotspotMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);

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

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={DAVAO_CENTER}
        zoom={DAVAO_ZOOM}
        style={{ height: "100%", width: "100%" }}
        ref={(m: LeafletMap | null) => {
          mapRef.current = m;
        }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {clusters.map((cluster) => (
          <Circle
            key={`cluster-${cluster.id}`}
            center={[cluster.centroid.lat, cluster.centroid.lon]}
            radius={cluster.radiusKm * 1000}
            pathOptions={{
              color: SEVERITY_COLOR[cluster.severity],
              fillColor: SEVERITY_COLOR[cluster.severity],
              fillOpacity: 0.18,
              weight: 1.5,
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-slate-900">
                  Hotspot cluster #{cluster.id}
                </div>
                <div className="mt-1 text-slate-700">
                  {cluster.caseCount} case(s) ·{" "}
                  {SEVERITY_LABEL[cluster.severity]}
                </div>
                <div className="mt-1 text-slate-500">
                  Radius ~{cluster.radiusKm.toFixed(2)} km
                </div>
                {cluster.barangays.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs text-slate-600">
                    {cluster.barangays.slice(0, 5).map((b) => (
                      <li key={b.psgc}>
                        {b.name} — {b.count}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Popup>
          </Circle>
        ))}

        {barangayStats.map((stat) => (
          <CircleMarker
            key={`bgy-${stat.psgc}`}
            center={[stat.lat, stat.lon]}
            radius={barangayRadius(stat.caseCount, maxCount)}
            pathOptions={{
              color: "#0f172a",
              weight: 0.7,
              fillColor: barangayColor(stat.caseCount, maxCount),
              fillOpacity: 0.75,
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-slate-900">{stat.name}</div>
                <div className="mt-1 text-slate-700">
                  {stat.caseCount} case(s)
                </div>
                <div className="text-slate-500">
                  {stat.recentCases} in the last 30 days
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        <FocusController target={focusTarget} />
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-3 py-2 text-xs shadow">
        <div className="font-semibold text-slate-700">Hotspot density</div>
        <div className="mt-1 flex items-center gap-2">
          {(Object.keys(SEVERITY_COLOR) as HotspotSeverity[]).map((sev) => (
            <span key={sev} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: SEVERITY_COLOR[sev] }}
              />
              {SEVERITY_LABEL[sev]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminHotspotMap;
