// Map-tour state that the map reads too. Kept out of MapTour.tsx so that file
// exports only components and fast refresh can hot-swap it.

const SEEN_KEY = "bantay.mapTourSeen";

export function hasSeenMapTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private browsing / storage disabled — the tour just shows again.
  }
}

/** Step indices the map reacts to with its own effect. */
export const MAP_TOUR_STEP = { welcome: 0, legend: 2, high: 3 } as const;
