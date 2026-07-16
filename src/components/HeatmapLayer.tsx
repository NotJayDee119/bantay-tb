import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

interface HeatmapLayerProps {
  /** [lat, lon] or [lat, lon, intensity 0..1] — intensity defaults to 1. */
  points: ([number, number] | [number, number, number])[];
  radius?: number;
  blur?: number;
  /** Minimum opacity of the layer, so sparse areas stay visible. */
  minOpacity?: number;
  gradient?: Record<number, string>;
}

const DEFAULT_GRADIENT: Record<number, string> = {
  0.2: "#93c5fd", // sky-300
  0.4: "#3b82f6", // blue-500
  0.6: "#f59e0b", // amber-500
  0.8: "#ef4444", // red-500
  1.0: "#7f1d1d", // red-900
};

export function HeatmapLayer({
  points,
  radius = 28,
  blur = 20,
  minOpacity = 0.05,
  gradient = DEFAULT_GRADIENT,
}: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heat = (L as any).heatLayer(points, {
      radius,
      blur,
      minOpacity,
      maxZoom: 17,
      max: 1.0,
      gradient,
    });

    heat.addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points, radius, blur, minOpacity, gradient]);

  return null;
}
