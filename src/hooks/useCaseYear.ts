import { useSyncExternalStore } from "react";

/**
 * The reporting year, shared across the Dashboard and Reports & Charts.
 *
 * Staff compare years ("how did 2024 go vs 2025?"), so picking a year on one
 * page should not be undone by moving to the next. Same storage pattern as
 * useCaseAttribution: one durable setting in localStorage, synced across tabs.
 *
 * `"all"` means every case on record, with no date restriction.
 */
export type CaseYear = "all" | number;

const KEY = "bantay-case-year";
const DEFAULT: CaseYear = "all";

function read(): CaseYear {
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw == null ? NaN : Number(raw);
    return Number.isInteger(n) && n > 1900 ? n : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let current: CaseYear = read();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    const next = read();
    if (next === current) return;
    current = next;
    emit();
  });
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setCaseYear(next: CaseYear): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(KEY, String(next));
  } catch {
    // Not persisting is survivable; the in-memory value still syncs the tab.
  }
  emit();
}

/** `[year, setYear]`, shared by every page with a year filter. */
export function useCaseYear(): [CaseYear, (next: CaseYear) => void] {
  const value = useSyncExternalStore(subscribe, () => current, () => DEFAULT);
  return [value, setCaseYear];
}

/**
 * ISO bounds for a year filter, or null for "all". Upper bound is exclusive.
 * Local midnight, not UTC: the Dashboard buckets cases by local year, and a
 * case reported at 00:30 on 1 January (PHT) must land in the same year on
 * every page.
 */
export function yearRange(year: CaseYear): { from: string; to: string } | null {
  if (year === "all") return null;
  return {
    from: new Date(year, 0, 1).toISOString(),
    to: new Date(year + 1, 0, 1).toISOString(),
  };
}

/**
 * Years to offer, newest first — only years that actually hold cases, so a
 * dataset covering 2024–2025 doesn't offer an empty 2026.
 */
export function yearOptions(
  earliest: number | null,
  latest: number | null,
  selected: CaseYear
): number[] {
  const now = new Date().getFullYear();
  const end = latest ?? now;
  const start = Math.min(earliest ?? end, end);
  const years: number[] = [];
  for (let y = end; y >= start; y--) years.push(y);
  // Keep a remembered selection visible even if the data no longer reaches it.
  if (selected !== "all" && !years.includes(selected)) years.push(selected);
  return years.sort((a, b) => b - a);
}

/** "in 2025" / "on record" — for sentences like "118 TB cases in 2025". */
export function yearPhrase(year: CaseYear): string {
  return year === "all" ? "on record" : `in ${year}`;
}
