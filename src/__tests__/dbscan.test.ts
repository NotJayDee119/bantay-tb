import { describe, it, expect } from "vitest";
import { dbscan } from "../lib/dbscan";

describe("dbscan", () => {
  it("clusters dense points and ignores noise", () => {
    // Two clusters of 6 points each within ~0.5 km, plus 3 noise points >5 km away.
    const cluster1 = Array.from({ length: 6 }, (_, i) => ({
      id: `a${i}`,
      lat: 7.07 + i * 0.001,
      lon: 125.61 + i * 0.001,
    }));
    const cluster2 = Array.from({ length: 6 }, (_, i) => ({
      id: `b${i}`,
      lat: 7.13 + i * 0.001,
      lon: 125.63 + i * 0.001,
    }));
    const noise = [
      { id: "n1", lat: 7.4, lon: 125.4 },
      { id: "n2", lat: 6.9, lon: 125.8 },
      { id: "n3", lat: 7.5, lon: 125.5 },
    ];
    const clusters = dbscan([...cluster1, ...cluster2, ...noise], 1.0, 4);
    expect(clusters.length).toBe(2);
    const sizes = clusters.map((c) => c.points.length).sort((a, b) => a - b);
    expect(sizes).toEqual([6, 6]);
  });

  it("returns no clusters when minPts is not satisfied", () => {
    const points = [
      { id: "1", lat: 7.0, lon: 125.6 },
      { id: "2", lat: 7.001, lon: 125.601 },
    ];
    expect(dbscan(points, 1, 5)).toEqual([]);
  });
});
