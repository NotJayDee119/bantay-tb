import { useEffect, useMemo, useState, useRef } from "react";
import { GeoJSON, Pane } from "react-leaflet";
import L from "leaflet";
import type { BarangayStat } from "../lib/hotspotUtils";

interface BarangayBoundariesProps {
  barangayStats: BarangayStat[];
  maxCount: number;
  fillFn: (count: number, max: number) => string;
}

type GeoJSONData = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { psgc: number; ADM4_EN: string }
>;

let cachedGeoJSON: GeoJSONData | null = null;

export function BarangayBoundaries({
  barangayStats,
  maxCount,
  fillFn,
}: BarangayBoundariesProps) {
  const [geojson, setGeojson] = useState<GeoJSONData | null>(cachedGeoJSON);
  const geoRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (cachedGeoJSON) {
      setGeojson(cachedGeoJSON);
      return;
    }
    fetch("/data/davao-city-barangays.geojson")
      .then((r) => r.json())
      .then((data: GeoJSONData) => {
        cachedGeoJSON = data;
        setGeojson(data);
      })
      .catch(() => {});
  }, []);

  const statsByPsgc = useMemo(() => {
    const m = new Map<number, BarangayStat>();
    for (const s of barangayStats) m.set(s.psgc, s);
    return m;
  }, [barangayStats]);

  useEffect(() => {
    const layer = geoRef.current;
    if (!layer) return;
    layer.eachLayer((l) => {
      const feat = (l as L.GeoJSON & { feature: GeoJSON.Feature }).feature;
      if (!feat?.properties) return;
      const psgc = feat.properties.psgc as number;
      const stat = statsByPsgc.get(psgc);
      const count = stat?.caseCount ?? 0;
      (l as L.Path).setStyle({
        fillColor: count > 0 ? fillFn(count, maxCount) : "#e2e8f0",
        fillOpacity: count > 0 ? 0.5 : 0.15,
        color: "#475569",
        weight: 1,
      });
    });
  }, [statsByPsgc, maxCount, fillFn, geojson]);

  if (!geojson) return null;

  const onEachFeature = (
    feature: GeoJSON.Feature<GeoJSON.Geometry, { psgc: number; ADM4_EN: string }>,
    layer: L.Layer,
  ) => {
    const psgc = feature.properties.psgc;
    const stat = statsByPsgc.get(psgc);
    const name = stat?.name ?? feature.properties.ADM4_EN;
    const count = stat?.caseCount ?? 0;
    const recent = stat?.recentCases ?? 0;

    layer.bindPopup(
      `<div style="min-width:180px;font-size:13px">` +
        `<div style="font-weight:600;color:#0f172a">${name}</div>` +
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px;font-size:12px">` +
        `<div><div style="color:#64748b">Total cases</div><div style="font-size:16px;font-weight:600">${count}</div></div>` +
        `<div><div style="color:#64748b">Last 30 days</div><div style="font-size:16px;font-weight:600">${recent}</div></div>` +
        `</div>` +
        `<div style="margin-top:6px;font-size:10px;color:#94a3b8">PSGC ${psgc}</div>` +
        `</div>`,
    );

    const path = layer as L.Path;
    layer.on("mouseover", () => {
      path.setStyle({ fillOpacity: 0.8, weight: 2 });
    });
    layer.on("mouseout", () => {
      path.setStyle({
        fillOpacity: count > 0 ? 0.5 : 0.15,
        weight: 1,
      });
    });
  };

  const style = (
    feature: GeoJSON.Feature<GeoJSON.Geometry, { psgc: number }> | undefined,
  ): L.PathOptions => {
    if (!feature) return {};
    const stat = statsByPsgc.get(feature.properties.psgc);
    const count = stat?.caseCount ?? 0;
    return {
      fillColor: count > 0 ? fillFn(count, maxCount) : "#e2e8f0",
      fillOpacity: count > 0 ? 0.5 : 0.15,
      color: "#475569",
      weight: 1,
    };
  };

  return (
    <Pane name="barangay-boundaries" style={{ zIndex: 405 }}>
      <GeoJSON
        key={`bgy-boundaries-${barangayStats.length}`}
        ref={(r: L.GeoJSON | null) => { geoRef.current = r; }}
        data={geojson}
        style={style as L.StyleFunction}
        onEachFeature={onEachFeature as L.GeoJSONOptions["onEachFeature"]}
      />
    </Pane>
  );
}
