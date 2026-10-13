// Spatial statistics for BANTAY-TB hotspot detection.
//
//   Global Moran's I  — is TB clustered across Davao City at all? One number
//                       for the whole city, tested by 999 random permutations.
//   Local Getis-Ord Gi* — where are the clusters? One z-score per barangay,
//                       classified as hotspot / coldspot / not significant.
//
// Run in that order: Moran's I confirms clustering exists, Gi* locates it.
//
// Pure TypeScript with no Deno or browser APIs, so the detect-hotspots Edge
// Function, the client maps and the unit tests all run the same arithmetic.
// Formulas follow Getis & Ord (1992), Ord & Getis (1995) and Cliff & Ord
// (1981), and match PySAL esda:
//
//   Moran(x, w_rowstd, permutations=999)      -> I, EI, z_norm, p_sim
//   G_Local(x, w_binary, transform="B", star=True) -> Zs
//
// Spatial weights are queen contiguity (shared border or corner), built from the
// barangay polygons by scripts/build-barangay-neighbors.ts.

/** Gi* class by z-score: ±1.96 is 95% confidence, ±2.58 is 99%. */
export type GiClass =
  | "hotspot_99"
  | "hotspot_95"
  | "not_significant"
  | "coldspot_95"
  | "coldspot_99";

export const Z_95 = 1.96;
export const Z_99 = 2.58;

/** What Gi* was computed on. Rates need every barangay's population. */
export type GiMetric = "rate_per_100k" | "case_count";

export function classifyGi(z: number): GiClass {
  if (z >= Z_99) return "hotspot_99";
  if (z >= Z_95) return "hotspot_95";
  if (z <= -Z_99) return "coldspot_99";
  if (z <= -Z_95) return "coldspot_95";
  return "not_significant";
}

export function isHotspotClass(c: GiClass | string | null | undefined): boolean {
  return c === "hotspot_95" || c === "hotspot_99";
}

// ── Normal distribution ──────────────────────────────────────────────────

/** erf via Abramowitz & Stegun 7.1.26 — absolute error below 1.5e-7. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Two-sided p-value for a standard-normal z. */
export function twoSidedP(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
}

// ── Seeded RNG ───────────────────────────────────────────────────────────
// Permutation tests are seeded so a run can be reproduced exactly when the
// numbers are checked against PySAL or reported in the manuscript.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Weights ──────────────────────────────────────────────────────────────

/**
 * Neighbour index lists for `psgcs`, in the same order, from a
 * `{ psgc: neighbourPsgc[] }` map. Neighbours outside `psgcs` are dropped.
 */
export function neighbourIndex(
  psgcs: number[],
  neighbours: Record<string, number[]>
): number[][] {
  const pos = new Map(psgcs.map((p, i) => [p, i]));
  return psgcs.map((p) =>
    (neighbours[String(p)] ?? [])
      .map((q) => pos.get(q))
      .filter((j): j is number => j !== undefined && j !== pos.get(p))
  );
}

// ── Global Moran's I ─────────────────────────────────────────────────────

export interface MoranResult {
  /** Observed Moran's I. */
  I: number;
  /** Expected value under spatial randomness, −1/(n−1). */
  expected: number;
  /** Variance under the normality assumption. */
  variance: number;
  /** (I − E[I]) / √Var under normality. */
  z: number;
  /** Two-sided analytical p-value from z. */
  pNorm: number;
  /** Pseudo p-value from the permutation test, (larger + 1)/(perms + 1). */
  pSim: number;
  permutations: number;
  n: number;
}

/** Moran's I with ROW-STANDARDISED weights for a given value vector. */
function moranStatistic(x: number[], nbrs: number[][]): number {
  const n = x.length;
  let mean = 0;
  for (const v of x) mean += v;
  mean /= n;
  let num = 0;
  let den = 0;
  let s0 = 0;
  for (let i = 0; i < n; i++) {
    const zi = x[i] - mean;
    den += zi * zi;
    const k = nbrs[i].length;
    if (k === 0) continue;
    s0 += 1;
    let lag = 0;
    for (const j of nbrs[i]) lag += x[j] - mean;
    num += (zi * lag) / k;
  }
  if (den === 0 || s0 === 0) return 0;
  return (n / s0) * (num / den);
}

export function moransI(
  x: number[],
  nbrs: number[][],
  options: { permutations?: number; seed?: number } = {}
): MoranResult {
  const n = x.length;
  const permutations = options.permutations ?? 999;
  const I = moranStatistic(x, nbrs);
  const expected = -1 / (n - 1);

  // Analytical variance under normality, row-standardised weights.
  const w = new Map<string, number>();
  const rowSum = new Array<number>(n).fill(0);
  const colSum = new Array<number>(n).fill(0);
  let s0 = 0;
  for (let i = 0; i < n; i++) {
    const k = nbrs[i].length;
    for (const j of nbrs[i]) {
      const wij = 1 / k;
      w.set(`${i},${j}`, wij);
      rowSum[i] += wij;
      colSum[j] += wij;
      s0 += wij;
    }
  }
  let s1 = 0;
  for (const [key, wij] of w) {
    const [i, j] = key.split(",");
    const wji = w.get(`${j},${i}`) ?? 0;
    s1 += (wij + wji) ** 2;
  }
  s1 /= 2;
  let s2 = 0;
  for (let i = 0; i < n; i++) s2 += (rowSum[i] + colSum[i]) ** 2;
  const variance =
    (n * n * s1 - n * s2 + 3 * s0 * s0) / ((n * n - 1) * s0 * s0) - expected * expected;
  const z = variance > 0 ? (I - expected) / Math.sqrt(variance) : 0;

  // Permutation test: shuffle the values across barangays, keep the map.
  const rng = mulberry32(options.seed ?? 20261013);
  const perm = x.slice();
  let larger = 0;
  for (let p = 0; p < permutations; p++) {
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = perm[i];
      perm[i] = perm[j];
      perm[j] = t;
    }
    if (moranStatistic(perm, nbrs) >= I) larger += 1;
  }
  // Fold to the nearer tail, as PySAL does.
  if (permutations - larger < larger) larger = permutations - larger;
  const pSim = permutations > 0 ? (larger + 1) / (permutations + 1) : 1;

  return { I, expected, variance, z, pNorm: twoSidedP(z), pSim, permutations, n };
}

// ── Local Getis-Ord Gi* ──────────────────────────────────────────────────

export interface GiResult {
  z: number;
  p: number;
  cls: GiClass;
}

/**
 * Gi* z-score per unit with BINARY weights that include the unit itself (the
 * "star"):
 *
 *   Gi* = (Σⱼ wᵢⱼ xⱼ − X̄ Wᵢ) / ( S √[(n Σⱼ wᵢⱼ² − Wᵢ²) / (n − 1)] )
 *
 * where Wᵢ = Σⱼ wᵢⱼ, X̄ the mean and S = √(Σx²/n − X̄²). A barangay is a
 * hotspot when it AND its neighbours are high together — not simply when it
 * has the most cases.
 */
export function giStar(x: number[], nbrs: number[][]): GiResult[] {
  const n = x.length;
  let sum = 0;
  let sumSq = 0;
  for (const v of x) {
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / n;
  const s = Math.sqrt(Math.max(0, sumSq / n - mean * mean));

  return x.map((xi, i) => {
    const wi = nbrs[i].length + 1; // binary, self included → Σw² = Wᵢ
    let local = xi;
    for (const j of nbrs[i]) local += x[j];
    const denom = s * Math.sqrt((n * wi - wi * wi) / (n - 1));
    const z = denom > 0 ? (local - mean * wi) / denom : 0;
    return { z, p: twoSidedP(z), cls: classifyGi(z) };
  });
}

/**
 * Benjamini-Hochberg false-discovery-rate flags for `pValues` at level `q`.
 * Optional extra rigour for 182 simultaneous Gi* tests; the class itself stays
 * on the plain z thresholds so it matches the published classification table.
 */
export function fdrSignificant(pValues: number[], q = 0.05): boolean[] {
  const m = pValues.length;
  const order = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  let cutoff = -1;
  order.forEach(({ p }, rank) => {
    if (p <= ((rank + 1) / m) * q) cutoff = rank;
  });
  const out = new Array<boolean>(m).fill(false);
  for (let r = 0; r <= cutoff; r++) out[order[r].i] = true;
  return out;
}

// ── One full analysis ────────────────────────────────────────────────────

export interface SpatialUnitInput {
  psgc: number;
  cases: number;
  /** Census population; null/0 when unknown. */
  population: number | null;
}

export interface SpatialUnitResult extends SpatialUnitInput {
  /** The value Gi* was computed on — a rate or a count, per `metric`. */
  value: number;
  giZ: number;
  giP: number;
  giClass: GiClass;
  fdrSignificant: boolean;
}

export interface SpatialAnalysis {
  metric: GiMetric;
  moran: MoranResult;
  units: SpatialUnitResult[];
}

/**
 * Moran's I then Gi* over every barangay — including those with zero cases,
 * which are real observations, not missing data.
 *
 * Input is cases per 100,000 when EVERY barangay has a population; otherwise
 * raw case counts, and `metric` says so. Mixing rates and counts in one vector
 * would be meaningless, so it is all or nothing.
 */
export function analyzeSpatial(
  units: SpatialUnitInput[],
  neighbours: Record<string, number[]>,
  options: { permutations?: number; seed?: number } = {}
): SpatialAnalysis {
  const metric: GiMetric = units.every((u) => (u.population ?? 0) > 0)
    ? "rate_per_100k"
    : "case_count";
  const values = units.map((u) =>
    metric === "rate_per_100k" ? (u.cases / (u.population as number)) * 100_000 : u.cases
  );
  const nbrs = neighbourIndex(
    units.map((u) => u.psgc),
    neighbours
  );
  const moran = moransI(values, nbrs, options);
  const gi = giStar(values, nbrs);
  const fdr = fdrSignificant(gi.map((g) => g.p));
  return {
    metric,
    moran,
    units: units.map((u, i) => ({
      ...u,
      value: values[i],
      giZ: gi[i].z,
      giP: gi[i].p,
      giClass: gi[i].cls,
      fdrSignificant: fdr[i],
    })),
  };
}
