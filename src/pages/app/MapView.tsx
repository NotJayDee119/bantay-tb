import { useEffect, useMemo, useState } from "react";
import {
  GeoJSON,
  LayersControl,
  MapContainer,
  TileLayer,
} from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { Card, PageHeader, Select, Spinner } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import barangays from "../../data/barangays.json";

type DiseaseFilter = "all" | "tb" | "pneumonia" | "covid19" | "asthma";

// Citywide barangay-level case counts come from the
// public.barangay_case_counts() SECURITY DEFINER function so all staff see
// the same aggregate map regardless of their own barangay assignment.
interface BarangayCount {
  barangay_psgc: number;
  case_count: number;
}

interface BarangayMeta {
  psgc: number;
  name: string;
  lat: number;
  lon: number;
}

const DAVAO_CENTER: [number, number] = [7.0731, 125.6128];

function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const layer = (L as unknown as { heatLayer: (p: [number, number, number][], o: object) => L.Layer }).heatLayer(points, {
      radius: 22,
      blur: 18,
      maxZoom: 15,
      gradient: {
        0.2: "#bae6fd",
        0.4: "#7dd3fc",
        0.6: "#38bdf8",
        0.8: "#f97316",
        1.0: "#dc2626",
      },
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [points, map]);
  return null;
}

import { useMap } from "react-leaflet";

export function MapView() {
  const [counts, setCounts] = useState<BarangayCount[]>([]);
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [disease, setDisease] = useState<DiseaseFilter>("all");
  const [days, setDays] = useState(180);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/davao-city-barangays.geojson")
      .then((r) => r.json())
      .then(setGeo);
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase
      .rpc("barangay_case_counts", {
        p_disease: disease === "all" ? null : disease,
        p_days: days,
      })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
        }
        setCounts((data ?? []) as BarangayCount[]);
        setLoading(false);
      });
  }, [disease, days]);

  const bgyCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of counts) m.set(r.barangay_psgc, r.case_count);
    return m;
  }, [counts]);

  const totalCases = useMemo(
    () => counts.reduce((s, r) => s + r.case_count, 0),
    [counts]
  );

  // Build heat points from each barangay's centroid weighted by case count.
  // We synthesize multiple stacked points per barangay so leaflet.heat builds
  // a smooth gradient that reflects the relative case density. This avoids
  // sending raw jittered patient coordinates to the client and keeps the
  // heatmap useful for citywide surveillance.
  const heatPoints = useMemo<[number, number, number][]>(() => {
    const byPsgc = new Map<number, BarangayMeta>();
    for (const b of barangays as BarangayMeta[]) byPsgc.set(b.psgc, b);
    const max = Math.max(1, ...counts.map((c) => c.case_count));
    const out: [number, number, number][] = [];
    for (const r of counts) {
      const meta = byPsgc.get(r.barangay_psgc);
      if (!meta) continue;
      const intensity = r.case_count / max;
      // Replicate the centroid so the heat blob "weight" tracks count.
      const reps = Math.min(20, Math.max(1, Math.round(r.case_count)));
      for (let i = 0; i < reps; i++) {
        out.push([meta.lat, meta.lon, intensity]);
      }
    }
    return out;
  }, [counts]);

  const maxCount = Math.max(1, ...bgyCounts.values());

  const choroplethStyle = (feature: GeoJSON.Feature | undefined) => {
    const psgc = (feature?.properties as { psgc: number } | undefined)?.psgc ?? 0;
    const count = bgyCounts.get(psgc) ?? 0;
    const ratio = count / maxCount;
    const fill =
      ratio === 0
        ? "#f1f5f9"
        : ratio < 0.25
          ? "#bae6fd"
          : ratio < 0.5
            ? "#38bdf8"
            : ratio < 0.75
              ? "#f97316"
              : "#dc2626";
    return {
      color: "#0f172a",
      weight: 0.7,
      fillColor: fill,
      fillOpacity: count === 0 ? 0.15 : 0.55,
    };
  };

  return (
    <>
      <PageHeader
        title="GIS Map"
        subtitle={`${totalCases.toLocaleString()} cases across ${barangays.length} Davao City barangays · last ${days} days · citywide aggregate`}
        actions={
          <>
            <Select
              value={disease}
              onChange={(e) => setDisease(e.target.value as DiseaseFilter)}
              className="w-44"
            >
              <option value="all">All diseases</option>
              <option value="tb">Tuberculosis</option>
              <option value="pneumonia">Pneumonia</option>
              <option value="covid19">COVID-19</option>
              <option value="asthma">Asthma</option>
            </Select>
            <Select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-40"
            >
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 6 months</option>
              <option value={365}>Last year</option>
              <option value={1825}>All time</option>
            </Select>
          </>
        }
      />

      <Card className="overflow-hidden p-0">
        {loading && (
          <div className="absolute z-[1000] m-3 flex items-center gap-2 rounded-md bg-white/90 px-3 py-1.5 text-xs shadow">
            <Spinner className="h-4 w-4" /> Loading…
          </div>
        )}
        <MapContainer center={DAVAO_CENTER} zoom={11} style={{ height: 620, width: "100%" }}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Carto Light">
              <TileLayer
                attribution='&copy; CartoDB'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
            </LayersControl.BaseLayer>
            {geo && (
              <LayersControl.Overlay checked name="Barangay choropleth">
                <GeoJSON
                  data={geo}
                  style={choroplethStyle}
                  onEachFeature={(feature, layer) => {
                    const p = feature.properties as { psgc: number; name: string };
                    const count = bgyCounts.get(p.psgc) ?? 0;
                    layer.bindTooltip(
                      `<strong>${p.name}</strong><br/>${count} case(s)`,
                      { sticky: true }
                    );
                  }}
                />
              </LayersControl.Overlay>
            )}
            <LayersControl.Overlay checked name="Heatmap (case density)">
              <HeatGroup points={heatPoints} />
            </LayersControl.Overlay>
          </LayersControl>
        </MapContainer>
      </Card>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="font-semibold text-slate-700">Density:</span>
        {[
          { c: "#f1f5f9", l: "0" },
          { c: "#bae6fd", l: "low" },
          { c: "#38bdf8", l: "moderate" },
          { c: "#f97316", l: "high" },
          { c: "#dc2626", l: "very high" },
        ].map((s) => (
          <span key={s.l} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-5 rounded-sm"
              style={{ background: s.c }}
            />
            {s.l}
          </span>
        ))}
      </div>
    </>
  );
}

function HeatGroup({ points }: { points: [number, number, number][] }) {
  return <HeatLayer points={points} />;
}
