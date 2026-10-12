import { useState } from "react";
import { isCoarsePointer } from "../lib/pointer";

// Lives apart from PublicCaseMap so the Landing caption can render without
// pulling in the map module — and with it Leaflet and MapLibre, over 1 MB.

/** The how-to-zoom line for under the map, worded for the device in hand. */
export function CaseMapHint({ className = "" }: { className?: string }) {
  const [coarse] = useState(isCoarsePointer);
  return (
    <span className={className}>
      {coarse
        ? "Pinch with two fingers to zoom and move the map"
        : "Hold Ctrl and scroll to zoom the map"}
    </span>
  );
}
