// Hotspot analytics built on top of the existing DBSCAN clustering helper
// (`src/lib/dbscan.ts`). Given a stream of TB case rows from
// `public.cases`, computes barangay-level counts, recent-activity tallies,
// and DBSCAN-derived spatial clusters. Each case is positioned at the
// centroid of its barangay (looked up via `src/data/barangays.json`) so we
// do not need per-case jittered coordinates for the high-level admin map.

import type { TBClassification } from "./database.types";
import { dbscan, type DbscanPoint } from "./dbscan";
import { haversineKm } from "./utils";
import barangaysData from "../data/barangays.json";

export interface HotspotCaseRow {
  barangay_psgc: number;
  reported_at: string | null;
  created_at: string | null;
  tb_classification: TBClassification | null;
  // Optional per-case jittered coordinates (preferred when available so DBSCAN
  // produces precise clusters instead of stacking every case at the
  // barangay centroid).
  jitter_lat?: number | null;
  jitter_lon?: number | null;
}

interface BarangayMeta {
  psgc: number;
  name: string;
  lat: number;
  lon: number;
}

export interface BarangayStat {
  psgc: number;
  name: string;
  lat: number;
  lon: number;
  caseCount: number;
  recentCases: number;
}

export type HotspotSeverity = "low" | "medium" | "high";

export interface HotspotCluster {
  id: number;
  caseCount: number;
  severity: HotspotSeverity;
  centroid: { lat: number; lon: number };
  radiusKm: number;
  barangays: { psgc: number; name: string; count: number }[];
}

export interface HotspotInsights {
  totalCases: number;
  recentCases: number;
  recentWindowDays: number;
  barangayStats: BarangayStat[];
  topBarangays: BarangayStat[];
  clusters: HotspotCluster[];
  classificationBreakdown: Record<string, number>;
}

const RECENT_WINDOW_DAYS = 30;
// DBSCAN parameters: ~1.5 km neighbourhood and 3+ cases to form a hotspot.
// These values are chosen so that adjacent dense barangays merge into a
// single cluster while isolated cases stay as noise.
const DBSCAN_EPS_KM = 1.5;
const DBSCAN_MIN_PTS = 3;

const BARANGAY_INDEX: Map<number, BarangayMeta> = new Map(
  (barangaysData as BarangayMeta[]).map((b) => [
    b.psgc,
    { psgc: b.psgc, name: b.name, lat: b.lat, lon: b.lon },
  ])
);

function severityFor(caseCount: number): HotspotSeverity {
  if (caseCount >= 25) return "high";
  if (caseCount >= 15) return "medium";
  return "low";
}

function caseDate(row: HotspotCaseRow): number {
  const raw = row.reported_at ?? row.created_at;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function computeHotspotInsights(
  cases: HotspotCaseRow[]
): HotspotInsights {
  const totalCases = cases.length;
  const recentCutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const counts = new Map<number, number>();
  const recentCounts = new Map<number, number>();
  const classificationBreakdown: Record<string, number> = {};
  let recentCases = 0;

  for (const c of cases) {
    counts.set(c.barangay_psgc, (counts.get(c.barangay_psgc) ?? 0) + 1);
    const t = caseDate(c);
    if (t >= recentCutoff) {
      recentCounts.set(
        c.barangay_psgc,
        (recentCounts.get(c.barangay_psgc) ?? 0) + 1
      );
      recentCases += 1;
    }
    const key = c.tb_classification ?? "unknown";
    classificationBreakdown[key] = (classificationBreakdown[key] ?? 0) + 1;
  }

  const barangayStats: BarangayStat[] = [];
  for (const [psgc, caseCount] of counts) {
    const meta = BARANGAY_INDEX.get(psgc);
    if (!meta) continue;
    barangayStats.push({
      psgc,
      name: meta.name,
      lat: meta.lat,
      lon: meta.lon,
      caseCount,
      recentCases: recentCounts.get(psgc) ?? 0,
    });
  }
  barangayStats.sort((a, b) => b.caseCount - a.caseCount);
  const topBarangays = barangayStats.slice(0, 10);

  // Build DBSCAN input. Prefer per-case jittered coordinates for precise
  // clustering; fall back to the barangay centroid when jitter coords are
  // not present. Cases with no resolvable position are dropped from
  // clustering but still counted in the summary.
  const points: DbscanPoint[] = [];
  const pointBgy: number[] = [];
  for (let i = 0; i < cases.length; i += 1) {
    const row = cases[i];
    const meta = BARANGAY_INDEX.get(row.barangay_psgc);
    const lat =
      typeof row.jitter_lat === "number" && Number.isFinite(row.jitter_lat)
        ? row.jitter_lat
        : meta?.lat;
    const lon =
      typeof row.jitter_lon === "number" && Number.isFinite(row.jitter_lon)
        ? row.jitter_lon
        : meta?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    points.push({ id: String(i), lat, lon });
    pointBgy.push(row.barangay_psgc);
  }

  const rawClusters = dbscan(points, DBSCAN_EPS_KM, DBSCAN_MIN_PTS);
  const idToIndex = new Map<string, number>();
  points.forEach((p, idx) => idToIndex.set(p.id, idx));

  const clusters: HotspotCluster[] = rawClusters.map((cl) => {
    const bgyCounts = new Map<number, number>();
    let maxRadius = 0;
    for (const p of cl.points) {
      const idx = idToIndex.get(p.id);
      if (idx === undefined) continue;
      const psgc = pointBgy[idx];
      bgyCounts.set(psgc, (bgyCounts.get(psgc) ?? 0) + 1);
      const d = haversineKm(
        [p.lon, p.lat],
        [cl.centroid.lon, cl.centroid.lat]
      );
      if (d > maxRadius) maxRadius = d;
    }
    const radiusKm = Math.max(0.3, maxRadius);
    const barangays = [...bgyCounts.entries()]
      .map(([psgc, count]) => ({
        psgc,
        name: BARANGAY_INDEX.get(psgc)?.name ?? `PSGC ${psgc}`,
        count,
      }))
      .sort((a, b) => b.count - a.count);
    return {
      id: cl.id,
      caseCount: cl.points.length,
      severity: severityFor(cl.points.length),
      centroid: cl.centroid,
      radiusKm,
      barangays,
    };
  });

  return {
    totalCases,
    recentCases,
    recentWindowDays: RECENT_WINDOW_DAYS,
    barangayStats,
    topBarangays,
    clusters,
    classificationBreakdown,
  };
}
