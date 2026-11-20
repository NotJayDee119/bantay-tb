// Traffic-light status per barangay, read straight off the Gi* z-score that
// the detect-hotspots run stores for EVERY barangay (hotspot_results).
//
//   RED    z ≥ 1.96          hotspot at 95% confidence — the same rule that
//                             puts a barangay on the hotspot list
//   YELLOW 1.645 ≤ z < 1.96  watch — elevated at 90% confidence, one step
//                             short of a hotspot
//   GREEN  z < 1.645         no hotspot signal (includes low-TB areas)
//
// The colour is a statistical rule, not a raw case count: Gi* compares a
// barangay plus its neighbours with the citywide expectation. The case counts
// each colour actually covers in the latest run are reported next to the rule
// (caseRanges) so a reader can still answer "how many cases is red?".

import { Z_95 } from "./spatialStats";

export type TrafficLight = "red" | "yellow" | "green";

/** One-sided 90% confidence — the "watch" threshold. */
export const Z_WATCH = 1.645;

export const TRAFFIC_ORDER: TrafficLight[] = ["red", "yellow", "green"];

export const TRAFFIC: Record<
  TrafficLight,
  { color: string; label: string; short: string; rule: string; action: string }
> = {
  red: {
    color: "#dc2626",
    label: "Red · Hotspot",
    short: "Hotspot",
    rule: `Gi* z ≥ ${Z_95} (95% confidence)`,
    action: "Act now: active case finding, contact tracing and a barangay advisory.",
  },
  yellow: {
    color: "#f59e0b",
    label: "Yellow · Watch",
    short: "Watch",
    rule: `Gi* z ${Z_WATCH}–${(Z_95 - 0.01).toFixed(2)} (90% confidence)`,
    action: "Monitor monthly and prepare a screening schedule before it turns red.",
  },
  green: {
    color: "#16a34a",
    label: "Green · Normal",
    short: "Normal",
    rule: `Gi* z below ${Z_WATCH}`,
    action: "Routine surveillance.",
  },
};

export function trafficLightFor(z: number | null | undefined): TrafficLight {
  if (z === null || z === undefined || !Number.isFinite(z)) return "green";
  if (z >= Z_95) return "red";
  if (z >= Z_WATCH) return "yellow";
  return "green";
}

export interface TrafficRange {
  /** Barangays with this colour in the run. */
  barangays: number;
  /** Fewest and most cases among them. */
  min: number;
  max: number;
}

/** Case-count range each colour covers in a run. Null for an unused colour. */
export function caseRanges(
  rows: Iterable<{ case_count: number; gi_z: number | null }>
): Record<TrafficLight, TrafficRange | null> {
  const out: Record<TrafficLight, TrafficRange | null> = {
    red: null,
    yellow: null,
    green: null,
  };
  for (const r of rows) {
    const t = trafficLightFor(r.gi_z);
    const cur = out[t];
    if (!cur) out[t] = { barangays: 1, min: r.case_count, max: r.case_count };
    else {
      cur.barangays += 1;
      cur.min = Math.min(cur.min, r.case_count);
      cur.max = Math.max(cur.max, r.case_count);
    }
  }
  return out;
}

export function formatRange(r: TrafficRange | null): string {
  if (!r) return "none this run";
  const cases = r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
  return `${cases} case${r.max === 1 ? "" : "s"} · ${r.barangays} barangay${r.barangays === 1 ? "" : "s"}`;
}
