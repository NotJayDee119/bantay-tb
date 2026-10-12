/**
 * Categorical hues in fixed order — slot N always means the Nth category of a
 * chart, never cycled. Validated for adjacent-pair colour-blind separation;
 * anything past the last slot folds into "Other".
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
/** Unknown / unspecified / Other — neutral so it never competes for attention. */
export const NEUTRAL = "#94a3b8";

export interface Slice {
  label: string;
  value: number;
  /** Override the slot colour, e.g. to pin "unknown" to neutral. */
  color?: string;
}

/**
 * Builds slices in the fixed order of `palette`, so a category keeps its
 * colour and position however the counts shift between refreshes (colour
 * follows the entity, never its rank). Labels missing from the palette fold
 * into a neutral "other" slice at the end.
 */
export function toSlices(
  rows: { label: string; count: number }[],
  palette: Record<string, string>
): Slice[] {
  const counts = new Map(rows.map((r) => [r.label, r.count]));
  const slices: Slice[] = Object.entries(palette)
    .filter(([label]) => (counts.get(label) ?? 0) > 0)
    .map(([label, color]) => ({ label, value: counts.get(label)!, color }));
  const rest = rows
    .filter((r) => !(r.label in palette))
    .reduce((s, r) => s + r.count, 0);
  if (rest > 0) slices.push({ label: "other", value: rest, color: NEUTRAL });
  return slices;
}
