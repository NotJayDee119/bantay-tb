import { describe, expect, it } from "vitest";
import {
  analyzeSpatial,
  classifyGi,
  fdrSignificant,
  giStar,
  moransI,
  mulberry32,
  neighbourIndex,
  twoSidedP,
} from "../lib/spatialStats";
import { hotspotRowToCluster, neighboursWithCases } from "../lib/hotspotUtils";
import barangays from "../data/barangays.json";
import neighbours from "../data/barangayNeighbors.json";

const NB = neighbours as Record<string, number[]>;
const PSGCS = (barangays as { psgc: number }[]).map((b) => b.psgc);

/** 5×5 rook-free queen lattice — the textbook toy map. */
function lattice(side: number): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < side; r++)
    for (let c = 0; c < side; c++) {
      const ns: number[] = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr,
            cc = c + dc;
          if (rr >= 0 && rr < side && cc >= 0 && cc < side) ns.push(rr * side + cc);
        }
      out.push(ns);
    }
  return out;
}

describe("spatial weights", () => {
  it("covers all 182 barangays, symmetric, with no islands", () => {
    expect(Object.keys(NB)).toHaveLength(182);
    for (const [p, ns] of Object.entries(NB)) {
      expect(ns.length).toBeGreaterThan(0);
      for (const q of ns) expect(NB[String(q)]).toContain(Number(p));
    }
  });

  it("indexes neighbours in the order given and drops unknown PSGCs", () => {
    const idx = neighbourIndex([1, 2, 3], { "1": [2, 99], "2": [1, 3], "3": [2] });
    expect(idx).toEqual([[1], [0, 2], [1]]);
  });
});

describe("Gi* classification", () => {
  it("uses the ±1.96 / ±2.58 thresholds", () => {
    expect(classifyGi(2.58)).toBe("hotspot_99");
    expect(classifyGi(1.96)).toBe("hotspot_95");
    expect(classifyGi(1.95)).toBe("not_significant");
    expect(classifyGi(-1.96)).toBe("coldspot_95");
    expect(classifyGi(-3)).toBe("coldspot_99");
  });

  it("gives p ≈ 0.05 at z = 1.96", () => {
    expect(twoSidedP(1.96)).toBeCloseTo(0.05, 3);
    expect(twoSidedP(0)).toBeCloseTo(1, 6);
  });

  it("returns z = 0 everywhere for a constant map", () => {
    const g = giStar([5, 5, 5, 5], [[1], [0, 2], [1, 3], [2]]);
    expect(g.every((r) => r.z === 0 && r.cls === "not_significant")).toBe(true);
  });

  it("matches a hand-computed Gi* on a 4-unit chain", () => {
    // x = [10, 0, 0, 0], chain 0–1–2–3. Unit 0: Wᵢ = 2, Σ = 10,
    // X̄ = 2.5, S = √(100/4 − 6.25) = √18.75,
    // z = (10 − 5) / (√18.75 · √((4·2 − 4)/3)).
    const [g0] = giStar([10, 0, 0, 0], [[1], [0, 2], [1, 3], [2]]);
    const expected = 5 / (Math.sqrt(18.75) * Math.sqrt(4 / 3));
    expect(g0.z).toBeCloseTo(expected, 12);
  });
});

describe("Moran's I", () => {
  const W = lattice(5);

  it("E[I] = −1/(n−1)", () => {
    const m = moransI(
      Array.from({ length: 25 }, (_, i) => i % 3),
      W,
      { permutations: 99 }
    );
    expect(m.expected).toBeCloseTo(-1 / 24, 12);
  });

  it("detects a clustered pattern and not a checkerboard", () => {
    const clustered = Array.from({ length: 25 }, (_, i) => (i % 5 < 2 ? 10 : 0));
    const m = moransI(clustered, W);
    expect(m.I).toBeGreaterThan(0.3);
    expect(m.pSim).toBeLessThan(0.05);

    const checker = Array.from({ length: 25 }, (_, i) =>
      (Math.floor(i / 5) + (i % 5)) % 2 ? 10 : 0
    );
    expect(moransI(checker, W).I).toBeLessThan(0);
  });

  it("is reproducible for a given seed", () => {
    const x = Array.from({ length: 25 }, (_, i) => (i * 7) % 11);
    expect(moransI(x, W, { seed: 1 }).pSim).toBe(moransI(x, W, { seed: 1 }).pSim);
  });
});

describe("planted hotspot detection on the real Davao City map", () => {
  // Plant a hotspot: one barangay and all its queen neighbours get a high
  // rate, the rest of the city a low random background.
  const centre = 112402116; // Talomo (Pob.)
  const planted = new Set([centre, ...NB[String(centre)]]);
  const rng = mulberry32(42);
  const units = PSGCS.map((psgc) => ({
    psgc,
    cases: planted.has(psgc) ? 40 + Math.floor(rng() * 10) : Math.floor(rng() * 6),
    population: null,
  }));
  const result = analyzeSpatial(units, NB);
  const hot = new Set(
    result.units.filter((u) => u.giClass.startsWith("hotspot")).map((u) => u.psgc)
  );

  it("flags significant positive spatial autocorrelation", () => {
    expect(result.moran.I).toBeGreaterThan(0);
    expect(result.moran.pSim).toBeLessThan(0.05);
  });

  it("detects the planted centre and keeps false positives near it", () => {
    expect(hot.has(centre)).toBe(true);
    const detectedPlanted = [...planted].filter((p) => hot.has(p)).length;
    expect(detectedPlanted / planted.size).toBeGreaterThanOrEqual(0.8);
    // Any extra hotspot must touch the planted area — Gi* smooths over
    // neighbours, so a barangay bordering the cluster can legitimately rise.
    for (const p of hot) {
      if (planted.has(p)) continue;
      expect(NB[String(p)].some((q) => planted.has(q))).toBe(true);
    }
  });

  it("uses counts until every barangay has a population, then rates", () => {
    expect(result.metric).toBe("case_count");
    const withPop = analyzeSpatial(
      units.map((u) => ({ ...u, population: 10_000 })),
      NB,
      { permutations: 9 }
    );
    expect(withPop.metric).toBe("rate_per_100k");
    expect(withPop.units[0].value).toBeCloseTo(units[0].cases * 10, 9);
  });
});

describe("FDR", () => {
  it("applies Benjamini-Hochberg", () => {
    expect(fdrSignificant([0.001, 0.01, 0.03, 0.5])).toEqual([true, true, true, false]);
    // Rank 4 of 5 needs p ≤ 4/5 · 0.05 = 0.04; 0.045 just misses at every rank.
    expect(fdrSignificant([0.045, 0.045, 0.045, 0.045, 0.9])).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("explaining a hotspot", () => {
  const TALOMO = 112402116;
  const BAGO_APLAYA = 112402176;

  it("names the high-burden neighbours behind a zero-case hotspot", () => {
    // The live case: Bago Aplaya has no resident cases but borders Talomo
    // (Pob.), so Gi* flags it. The explanation must point at Talomo.
    const counts = new Map([[TALOMO, 522]]);
    const reason = neighboursWithCases(BAGO_APLAYA, (p) => counts.get(p) ?? 0);
    expect(reason).toEqual([{ psgc: TALOMO, name: "Talomo (Pob.)", count: 522 }]);
  });

  it("lists only neighbours with cases, largest first", () => {
    const nbrs = NB[String(TALOMO)];
    const counts = new Map(nbrs.map((p, i) => [p, i % 2 ? 0 : (i + 1) * 10]));
    const reason = neighboursWithCases(TALOMO, (p) => counts.get(p) ?? 0);
    expect(reason.every((n) => n.count > 0)).toBe(true);
    expect(reason.map((n) => n.count)).toEqual(
      [...reason.map((n) => n.count)].sort((a, b) => b - a)
    );
    expect(reason.every((n) => nbrs.includes(n.psgc))).toBe(true);
  });

  it("maps a stored hotspot row to what the pages draw", () => {
    const c = hotspotRowToCluster({
      id: "x",
      barangay_psgc: BAGO_APLAYA,
      case_count: 0,
      severity: "high",
      gi_z: 2.4,
      gi_p: 0.016,
      gi_class: "hotspot_95",
      centroid_lat: 7.05,
      centroid_lon: 125.58,
      radius_km: 1.2,
    });
    expect(c.name).toBe("Bago Aplaya");
    expect(c.caseCount).toBe(0);
    expect(c.giClass).toBe("hotspot_95");
    expect(c.centroid).toEqual({ lat: 7.05, lon: 125.58 });
  });
});
