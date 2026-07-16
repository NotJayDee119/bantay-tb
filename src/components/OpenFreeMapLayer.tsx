import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "@maplibre/maplibre-gl-leaflet";
import { OFM_STYLES, type OfmStyleName } from "../lib/openFreeMap";

/**
 * Base map layer backed by OpenFreeMap vector tiles, bridged into the
 * existing Leaflet map via @maplibre/maplibre-gl-leaflet so every other
 * Leaflet layer (GeoJSON boundaries, heatmap, markers) keeps working
 * unchanged. Renders nothing itself — it drives the map imperatively.
 *
 * Attribution is intentionally left to the plugin itself: it already adds
 * the correct OpenFreeMap/OSM credit to the map's attribution control once
 * the style finishes loading. Adding it manually here duplicated it.
 */
export function OpenFreeMapLayer({
  styleName = "positron",
}: {
  styleName?: OfmStyleName;
}) {
  const map = useMap();

  useEffect(() => {
    const layer = L.maplibreGL({ style: OFM_STYLES[styleName] }).addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, styleName]);

  return null;
}
