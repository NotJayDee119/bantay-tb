import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

interface HeatmapLayerProps {
  points: [number, number][];
}

export function HeatmapLayer({ points }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heat = (L as any).heatLayer(points, {
      radius: 28,
      blur: 20,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.2: "#93c5fd", // sky-300
        0.4: "#3b82f6", // blue-500
        0.6: "#f59e0b", // amber-500
        0.8: "#ef4444", // red-500
        1.0: "#7f1d1d", // red-900
      },
    });

    heat.addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}
