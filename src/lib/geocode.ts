// Street-address geocoding via OSM Nominatim, boxed to Davao City so a
// bare street name can't resolve to some other Philippine city. Nominatim's
// public instance is fine at form-entry volume (single lookups, user
// initiated); do not call it in a loop over many records.
//
// Nominatim matches free text strictly: every word must be found. Addresses
// as encoders write them rarely survive that. House numbers, "Blk 5 Lot 2" and
// "Purok 5" are not in OSM, and register barangay names ("Barangay 24-C
// (Pob.)", "Matina Crossing 74-A") are spelled differently from OSM's. So
// geocodeNearBarangay() tries progressively looser queries and keeps only a
// match close to the selected barangay. That check is what makes dropping the
// barangay from the query safe.

export interface GeocodeHit {
  lat: number;
  lon: number;
  /** Nominatim's resolved display name — echo it so the encoder can sanity-check the match. */
  label: string;
}

export interface BarangayAnchor {
  name: string;
  lat: number;
  lon: number;
  area_km2?: number;
}

// left,top,right,bottom — mirrors the map's DAVAO_BOUNDS extent.
const DAVAO_VIEWBOX = "125.05,7.72,125.83,6.82";
const CITY = "Davao City, Philippines";

/** Used when a barangay's area is unknown. */
export const DEFAULT_MAX_KM = 5;
/** Floor for small barangays. A long street geocodes to its midpoint, which
 *  can sit a block or two outside a Poblacion barangay it runs through. */
const MIN_MAX_KM = 2;

/** How far from the barangay's centre a match may land: twice the radius of
 *  a circle with the barangay's area. Poblacion barangays get the 2 km floor;
 *  upland ones in Paquibato and Marilog get ten kilometres or more. */
export function maxKmFor(b: { area_km2?: number }): number {
  if (!b.area_km2 || !(b.area_km2 > 0)) return DEFAULT_MAX_KM;
  return Math.max(MIN_MAX_KM, 2 * Math.sqrt(b.area_km2 / Math.PI));
}

/** Most queries one lookup sends. With the gap below, a lookup that finds
 *  nothing takes about four seconds. */
const MAX_QUERIES = 4;
/** Nominatim's usage policy: at most one request per second. */
const REQUEST_GAP_MS = 1100;

/** "Barangay 24-C (Pob.)" → "Barangay 24-C"; "Fatima (Benowang)" → "Fatima". */
export function cleanBarangayName(name: string): string {
  return name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

// Unit, lot and purok numbers that OSM never has.
const UNIT_PART =
  /\b(?:blk|block|lot|ph|phase|unit|bldg|building|purok|prk|zone|no)\.?\s*#?\s*\d+[a-z]?\b/gi;

/** The address without house, unit, lot and purok numbers:
 *  "123 Mabini St., Purok 5" → "Mabini St.". */
export function cleanStreetAddress(address: string): string {
  return address
    .replace(UNIT_PART, " ")
    .replace(/#\s*\d+[a-z-]*/gi, " ")
    .split(",")
    .map((part) =>
      part
        // A house number at the start of a part: "123 Mabini", "12-B Rizal".
        .replace(/^\s*\d+[a-z]?(?:-\d*[a-z]?)?\b/i, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((part) => /\p{L}{3,}/u.test(part))
    .join(", ");
}

// OSM tends to name the place without these: "Ecoland", not "Ecoland
// Subdivision".
const GENERIC_WORDS =
  /\b(?:subdivision|subd|village|vill|homes|compound|cmpd|estates?|heights|residences?)\b\.?/gi;

function withoutGenericWords(part: string): string {
  return part.replace(GENERIC_WORDS, " ").replace(/\s+/g, " ").trim();
}

// Words that say what kind of place it is, not which one.
const NOT_A_NAME = new Set([
  "street", "st", "avenue", "ave", "road", "rd", "drive", "dr", "lane", "ln",
  "boulevard", "blvd", "highway", "hwy", "extension", "ext", "corner", "cor",
  "purok", "prk", "sitio", "zone", "near", "beside", "along", "front", "back",
  "behind", "the", "and", "san", "sta", "sto",
]);

/** The words in an address that name a place: "123 Mabini St., Purok 5" →
 *  ["mabini"]. A match whose label has none of them is some other place that
 *  only matched the barangay or district name. */
export function placeWords(address: string): string[] {
  const words = withoutGenericWords(cleanStreetAddress(address))
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((w) => w.length >= 3 && !NOT_A_NAME.has(w));
  return [...new Set(words)];
}

/** Queries to try, strictest first. */
export function addressQueries(address: string, barangayName: string): string[] {
  const full = address.trim();
  const clean = cleanStreetAddress(full);
  const bgy = cleanBarangayName(barangayName);
  const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  const bare = parts
    .map(withoutGenericWords)
    .filter((p) => /\p{L}{3,}/u.test(p))
    .join(", ");
  const candidates = [
    full && `${full}, ${bgy}, ${CITY}`,
    clean && `${clean}, ${bgy}, ${CITY}`,
    clean && `${clean}, ${CITY}`,
    bare && `${bare}, ${CITY}`,
    // One part on its own: the street, or a subdivision or landmark.
    ...parts.map((p) => `${p}, ${CITY}`),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of candidates) {
    if (!q) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out.slice(0, MAX_QUERIES);
}

/** Great-circle distance in kilometres. */
export function kmBetween(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** The hit nearest the barangay, if any is close enough to be the place. */
export function nearestHit(
  hits: GeocodeHit[],
  anchor: { lat: number; lon: number },
  maxKm = DEFAULT_MAX_KM
): GeocodeHit | null {
  let best: GeocodeHit | null = null;
  let bestKm = Infinity;
  for (const h of hits) {
    const km = kmBetween(h, anchor);
    if (km <= maxKm && km < bestKm) {
      best = h;
      bestKm = km;
    }
  }
  return best;
}

/** One Nominatim search. null means the service could not be reached (so
 *  further queries are pointless); [] means it answered with no match. */
async function search(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeHit[] | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "ph");
  url.searchParams.set("viewbox", DAVAO_VIEWBOX);
  url.searchParams.set("bounded", "1");
  url.searchParams.set("q", query);
  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
    }[];
    return (rows ?? [])
      .map((r) => ({
        lat: Number(r.lat),
        lon: Number(r.lon),
        label: r.display_name,
      }))
      .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
  } catch {
    // Offline, blocked, or aborted — the caller falls back to barangay-level.
    return null;
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

/** Pin a street address inside the given barangay, or null when no query
 *  finds a place within maxKmFor(barangay) of its centre. */
export async function geocodeNearBarangay(
  address: string,
  barangay: BarangayAnchor,
  signal?: AbortSignal
): Promise<GeocodeHit | null> {
  // Nothing but numbers and purok labels: there is nothing to find that
  // would be more exact than the barangay itself.
  const words = placeWords(address);
  if (words.length === 0) return null;
  const named = (h: GeocodeHit) => {
    const label = h.label.toLowerCase();
    return words.some((w) => label.includes(w));
  };

  const queries = addressQueries(address, barangay.name);
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await wait(REQUEST_GAP_MS, signal);
    if (signal?.aborted) return null;
    const hits = await search(queries[i], signal);
    if (hits === null) return null;
    const hit = nearestHit(hits.filter(named), barangay, maxKmFor(barangay));
    if (hit) return hit;
  }
  return null;
}
