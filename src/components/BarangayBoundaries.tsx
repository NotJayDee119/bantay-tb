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

    const microLabel =
      "font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8";
    layer.bindPopup(
      `<div style="min-width:190px;font-size:13px">` +
        `<div style="font-weight:600;color:#f8fafc">${name}</div>` +
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">` +
        `<div><div style="${microLabel}">Total cases</div><div style="font-family:'Archivo',sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#fff">${count}</div></div>` +
        `<div><div style="${microLabel}">Last 30 days</div><div style="font-family:'Archivo',sans-serif;font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#fff">${recent}</div></div>` +
        `</div>` +
        `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);${microLabel};color:#64748b">PSGC ${psgc}</div>` +
        `</div>`,
      { className: "ghm-popup" },
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
