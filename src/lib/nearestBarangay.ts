// Turn a GPS fix into a barangay.
//
// `barangays.json` carries centroids and areas, not boundary polygons, so the
// honest resolution is "which centroid is nearest" plus a confidence check —
// not a point-in-polygon test we have no polygons for. A fix that lands between
// two small barangays can pick the wrong one, and the UI is expected to show
// the answer and let the user correct it rather than assert it silently.

import barangays from "../data/barangays.json";
import { haversineKm } from "./utils";

interface BarangayPoint {
  psgc: number;
  name: string;
  lat: number;
  lon: number;
  area_km2?: number | null;
}

const POINTS = barangays as BarangayPoint[];

// Same extent as the map's DAVAO_BOUNDS and the geocoder's viewbox. A fix
// outside it is someone testing from another city — better to say so than to
// hand them the nearest Davao barangay 400 km away.
const BOUNDS = { west: 125.05, south: 6.82, east: 125.83, north: 7.72 };

/** Smallest radius we will ever accept, so tiny urban barangays stay reachable. */
const MIN_RADIUS_KM = 1.5;

export interface ResolvedArea {
  psgc: number;
  name: string;
  /** Distance from the fix to that barangay's centroid. */
  distanceKm: number;
  /**
   * True when the fix sits within a plausible distance of the centroid, given
   * the barangay's own area. False means "this is the closest one, but don't
   * state it as fact" — the caller should offer a correction.
   */
  confident: boolean;
}

export function isInDavao(lat: number, lon: number): boolean {
  return (
    lat >= BOUNDS.south &&
    lat <= BOUNDS.north &&
    lon >= BOUNDS.west &&
    lon <= BOUNDS.east
  );
}

/**
 * Radius of a circle with the same area as the barangay — the distance from
 * its centre you would still expect to be inside it if it were round. Real
 * barangays aren't round, hence the 1.5 slack factor.
 */
function plausibleRadiusKm(areaKm2: number | null | undefined): number {
  if (!areaKm2 || areaKm2 <= 0) return MIN_RADIUS_KM;
  return Math.max(MIN_RADIUS_KM, Math.sqrt(areaKm2 / Math.PI) * 1.5);
}

/** Nearest barangay to a GPS fix, or null when the fix is outside Davao City. */
export function resolveBarangay(lat: number, lon: number): ResolvedArea | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isInDavao(lat, lon)) return null;

  let best: BarangayPoint | null = null;
  let bestKm = Infinity;
  for (const b of POINTS) {
    // haversineKm takes [lon, lat] pairs.
    const d = haversineKm([lon, lat], [b.lon, b.lat]);
    if (d < bestKm) {
      bestKm = d;
      best = b;
    }
  }
  if (!best) return null;

  return {
    psgc: best.psgc,
    name: best.name,
    distanceKm: bestKm,
    confident: bestKm <= plausibleRadiusKm(best.area_km2),
  };
}
