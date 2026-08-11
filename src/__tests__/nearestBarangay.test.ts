import { describe, it, expect } from "vitest";
import { resolveBarangay, isInDavao } from "../lib/nearestBarangay";
import barangays from "../data/barangays.json";

const POINTS = barangays as {
  psgc: number;
  name: string;
  lat: number;
  lon: number;
  area_km2?: number | null;
}[];

const byName = (name: string) => {
  const b = POINTS.find((p) => p.name === name);
  if (!b) throw new Error(`fixture barangay "${name}" not in barangays.json`);
  return b;
};

describe("isInDavao", () => {
  it("accepts a fix inside the city", () => {
    expect(isInDavao(7.0707, 125.6087)).toBe(true);
  });

  it("rejects Manila and Cebu", () => {
    expect(isInDavao(14.5995, 120.9842)).toBe(false);
    expect(isInDavao(10.3157, 123.8854)).toBe(false);
  });
});

describe("resolveBarangay", () => {
  it("returns the barangay you are standing in the middle of", () => {
    // Every centroid must resolve to its own barangay — if this breaks, the
    // whole "my area" feature is pointing users at their neighbours.
    for (const b of POINTS) {
      const hit = resolveBarangay(b.lat, b.lon);
      expect(hit?.psgc, `centroid of ${b.name} resolved elsewhere`).toBe(b.psgc);
      expect(hit?.distanceKm).toBeLessThan(0.001);
      expect(hit?.confident).toBe(true);
    }
  });

  it("names the barangay it matched", () => {
    const mintal = byName("Mintal");
    expect(resolveBarangay(mintal.lat, mintal.lon)?.name).toBe("Mintal");
  });

  it("returns null outside Davao City rather than the nearest Davao barangay", () => {
    // Manila. A silent "nearest match" here would tell a user in another city
    // that they're in a Davao barangay.
    expect(resolveBarangay(14.5995, 120.9842)).toBeNull();
  });

  it("rejects non-finite coordinates", () => {
    expect(resolveBarangay(Number.NaN, 125.6)).toBeNull();
    expect(resolveBarangay(7.07, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("flags a fix that is far from any centroid as not confident", () => {
    // Offshore in the Davao Gulf: still inside the bounding box, but well away
    // from every centroid. The caller must be told the match is a guess.
    const hit = resolveBarangay(6.9, 125.75);
    expect(hit).not.toBeNull();
    expect(hit?.confident).toBe(false);
    expect(hit?.distanceKm).toBeGreaterThan(2);
  });

  it("still resolves confidently a short walk from a centroid", () => {
    const b = byName("Mintal");
    // ~300 m north — inside any real barangay.
    const hit = resolveBarangay(b.lat + 0.0027, b.lon);
    expect(hit?.psgc).toBe(b.psgc);
    expect(hit?.confident).toBe(true);
  });
});
