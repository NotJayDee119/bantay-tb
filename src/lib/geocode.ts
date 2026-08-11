// Street-address geocoding via OSM Nominatim, boxed to Davao City so a
// bare street name can't resolve to some other Philippine city. Nominatim's
// public instance is fine at form-entry volume (single lookups, user
// initiated); do not call it in a loop.

export interface GeocodeHit {
  lat: number;
  lon: number;
  /** Nominatim's resolved display name — echo it so the encoder can sanity-check the match. */
  label: string;
}

// left,top,right,bottom — mirrors the map's DAVAO_BOUNDS extent.
const DAVAO_VIEWBOX = "125.05,7.72,125.83,6.82";

export async function geocodeInDavao(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeHit | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
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
    const hit = rows?.[0];
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, label: hit.display_name };
  } catch {
    // Offline, blocked, or aborted — the caller falls back to barangay-level.
    return null;
  }
}
