import { useSyncExternalStore } from "react";
import type { CaseAttribution } from "../lib/hotspotUtils";

/**
 * The counting axis, shared across every page that ranks barangays.
 *
 * "Which barangay is this case counted under" has two defensible answers — the
 * one that registered it, or the one the patient lives in (see CaseAttribution
 * in hotspotUtils.ts). The GIS map lets a user pick. The problem was that the
 * Dashboard did not: it always counted by residence, so the same barangay could
 * top the map and sit mid-table on the Dashboard, with no visible reason for
 * the disagreement. Two numbers that both claim to be "cases in Agdao" and
 * differ is worse than either alone — it makes a user distrust both.
 *
 * So the axis is one setting, not per-page state. Toggling it on the map moves
 * the Dashboard with it.
 *
 * Kept in localStorage rather than a URL param or context: it is a durable
 * preference about how this user reads the data, it must survive a route change
 * and a refresh, and both pages sit under the same AppLayout anyway.
 */

const KEY = "bantay-case-attribution";

// The map's original default, kept: a case is counted where it was registered
// unless the user says otherwise.
const DEFAULT: CaseAttribution = "facility";

function read(): CaseAttribution {
  try {
    return localStorage.getItem(KEY) === "residence" ? "residence" : DEFAULT;
  } catch {
    // Private browsing / storage disabled — the default still works.
    return DEFAULT;
  }
}

let current: CaseAttribution = read();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

// Another tab switching the axis should move this one too, so the same account
// never reads two different rankings side by side.
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

function getSnapshot(): CaseAttribution {
  return current;
}

export function setCaseAttribution(next: CaseAttribution): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Not persisting is survivable; the in-memory value still syncs the tab.
  }
  emit();
}

/** `[attribution, setAttribution]`, shared by every page that ranks barangays. */
export function useCaseAttribution(): [
  CaseAttribution,
  (next: CaseAttribution) => void,
] {
  const value = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT);
  return [value, setCaseAttribution];
}
