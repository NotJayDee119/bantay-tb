// Hotspot analytics built on top of the existing DBSCAN clustering helper
// (`src/lib/dbscan.ts`). A hotspot is an AREA with a high concentration of TB
// cases; a cluster here is the geometry of one such area, never "the new
// cases". Given a stream of TB case rows from `public.cases`, computes
// barangay-level counts, recent-activity tallies, and DBSCAN-derived spatial
// clusters. Each case is positioned at the
// centroid of its barangay (looked up via `src/data/barangays.json`) so we
// do not need per-case jittered coordinates for the high-level admin map.

import type { TBClassification } from "./database.types";
import { dbscan, type DbscanPoint } from "./dbscan";
import { haversineKm } from "./utils";
import barangaysData from "../data/barangays.json";

export interface HotspotCaseRow {
  /** Barangay of the patient's residence — not the facility's barangay. */
  barangay_psgc: number;
  reported_at: string | null;
  created_at: string | null;
  tb_classification: TBClassification | null;
  // Optional per-case jittered coordinates (preferred when available so DBSCAN
  // produces precise clusters instead of stacking every case at the
  // barangay centroid).
  jitter_lat?: number | null;
  jitter_lon?: number | null;
  /** DOTS facility this case is registered/notified at. */
  facility_id?: string | null;
  /** Patient's street address (staff-only PII). */
  address?: string | null;
  /** Geocoded household coordinates — real, unlike the jittered pair. */
  residence_lat?: number | null;
  residence_lon?: number | null;
}

interface BarangayMeta {
  psgc: number;
  name: string;
  lat: number;
  lon: number;
}

/**
 * Which barangay a case is counted under.
 *
 *   "facility"  — the barangay of the DOTS facility that registered the case.
 *                 A Mintal resident who registers at a Talomo DOTS centre is
 *                 counted in Talomo, because Talomo holds the TB register
 *                 entry and reports the notification. Cases with no registering
 *                 facility fall back to residence: they are real cases and must
 *                 not vanish from the map.
 *   "residence" — the barangay the patient lives in. Where transmission
 *                 actually happens, and therefore what contact tracing and
 *                 hotspot detection key on.
 *
 * Both are correct answers to different questions, so a barangay carries both
 * numbers and the map says which one it is showing.
 */
export type CaseAttribution = "facility" | "residence";

export interface BarangayStat {
  psgc: number;
  name: string;
  lat: number;
  lon: number;
  /** Count on the active attribution axis — what the map draws. */
  caseCount: number;
  /** Cases whose patients LIVE here, whatever facility registered them. */
  residentCases: number;
  /** Cases REGISTERED at a facility here, wherever the patients live. */
  registeredCases: number;
  recentCases: number;
}

export type HotspotSeverity = "watch" | "moderate" | "high" | "urgent" | "low" | "medium";

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
  /** Axis `barangayStats` / `topBarangays` were counted on. */
  attribution: CaseAttribution;
  barangayStats: BarangayStat[];
  topBarangays: BarangayStat[];
  /** Always residence-based — see the note at the DBSCAN input below. */
  clusters: HotspotCluster[];
  classificationBreakdown: Record<string, number>;
}

const RECENT_WINDOW_DAYS = 30;
// DBSCAN parameters: ~1.5 km neighbourhood and 3+ cases to form a hotspot.
// These values are chosen so that adjacent dense barangays merge into a
// single cluster while isolated cases stay as noise.
const DBSCAN_EPS_KM = 5;
const DBSCAN_MIN_PTS = 2;

const BARANGAY_INDEX: Map<number, BarangayMeta> = new Map(
  (barangaysData as BarangayMeta[]).map((b) => [
    b.psgc,
    { psgc: b.psgc, name: b.name, lat: b.lat, lon: b.lon },
  ])
);

function severityFor(caseCount: number): HotspotSeverity {
  if (caseCount >= 50) return "urgent";
  if (caseCount >= 20) return "high";
  if (caseCount >= 10) return "moderate";
  return "watch";
}

function caseDate(row: HotspotCaseRow): number {
  const raw = row.reported_at ?? row.created_at;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * The barangay a case is counted under on the given axis. Exported so the map
 * can filter its drill-down by the same rule the totals were built with — a
 * circle whose count and whose case list disagree is worse than either alone.
 */
export function attributionPsgc(
  residencePsgc: number,
  facilityPsgc: number | null | undefined,
  attribution: CaseAttribution
): number {
  if (attribution === "residence") return residencePsgc;
  return facilityPsgc ?? residencePsgc;
}

export function computeHotspotInsights(
  cases: HotspotCaseRow[],
  options: {
    attribution?: CaseAttribution;
    /** Needed to resolve a case's registering facility to its barangay. */
    facilities?: FacilityRow[];
  } = {}
): HotspotInsights {
  const attribution = options.attribution ?? "residence";
  const facilityBarangay = new Map<string, number | null>(
    (options.facilities ?? []).map((f) => [f.id, f.barangay_psgc])
  );
  const totalCases = cases.length;
  const recentCutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const counts = new Map<number, number>();
  const residentCounts = new Map<number, number>();
  const registeredCounts = new Map<number, number>();
  const recentCounts = new Map<number, number>();
  const classificationBreakdown: Record<string, number> = {};
  let recentCases = 0;

  const bump = (m: Map<number, number>, psgc: number) =>
    m.set(psgc, (m.get(psgc) ?? 0) + 1);

  for (const c of cases) {
    const facilityPsgc = c.facility_id
      ? (facilityBarangay.get(c.facility_id) ?? null)
      : null;
    const psgc = attributionPsgc(c.barangay_psgc, facilityPsgc, attribution);
    bump(counts, psgc);

    // Both axes are always tallied, whichever one is being drawn: a barangay
    // needs to show "40 registered here, 12 of our residents" side by side or
    // the Mintal patient registered in Talomo silently disappears from Mintal.
    bump(residentCounts, c.barangay_psgc);
    if (facilityPsgc !== null) bump(registeredCounts, facilityPsgc);

    const t = caseDate(c);
    if (t >= recentCutoff) {
      bump(recentCounts, psgc);
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
      residentCases: residentCounts.get(psgc) ?? 0,
      registeredCases: registeredCounts.get(psgc) ?? 0,
      recentCases: recentCounts.get(psgc) ?? 0,
    });
  }
  barangayStats.sort((a, b) => b.caseCount - a.caseCount);
  const topBarangays = barangayStats.slice(0, 10);

  // Clusters are always built on RESIDENCE, whatever axis the barangay counts
  // are drawn on. A hotspot is an area where transmission is happening, and
  // transmission happens where people live — clustering on the registering
  // facility would pile every case onto a handful of clinic addresses and put
  // the hotspot on the health centre instead of the neighbourhood.
  //
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
    attribution,
    barangayStats,
    topBarangays,
    clusters,
    classificationBreakdown,
  };
}

// ── Facility → residence flows ─────────────────────────────────────────
// A case is registered at a DOTS facility, but the patient lives somewhere
// else; the two often differ (registered at Mintal, lives in Calinan).
// Grouping cases per registering facility and breaking each group down by
// residence barangay powers the map's "spread" view: click a facility and
// see where its cases actually come from.
//
// This is the surveillance axis, not a service one. The count on a facility
// is how many cases it notified, which is a reporting fact — where those
// people live is where transmission is happening.

export interface FacilityRow {
  id: string;
  name: string;
  lat: number;
  lon: number;
  barangay_psgc: number | null;
}

export interface FacilityFlowOrigin {
  psgc: number;
  name: string;
  lat: number;
  lon: number;
  count: number;
}

/** One patient's home location for the spread trace. */
export interface FacilityCasePoint {
  lat: number;
  lon: number;
  /** Street address when recorded — staff-only PII. */
  address: string | null;
  /** True when the point is the geocoded household; false when it falls
      back to the jittered point or the barangay centroid. */
  exact: boolean;
  barangayName: string | null;
}

export interface FacilityFlowStat {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Barangay the facility itself sits in (null if not recorded). */
  barangayPsgc: number | null;
  /** Cases registered at this facility (residence known or not). */
  caseCount: number;
  /** Cases whose residence differs from the facility's own barangay —
      patients registering outside, or lacking, a nearer facility. Null when
      the facility's own barangay is unrecorded, since "outside" is then
      undefined. */
  outsideCount: number | null;
  /** Residence barangays of this facility's patients, largest first. */
  origins: FacilityFlowOrigin[];
  /** One point per patient — household when geocoded, else jittered /
      centroid fallback. What the spread lines trace to. */
  points: FacilityCasePoint[];
}

type FlowCaseRow = Pick<
  HotspotCaseRow,
  | "barangay_psgc"
  | "facility_id"
  | "jitter_lat"
  | "jitter_lon"
  | "address"
  | "residence_lat"
  | "residence_lon"
>;

function finite(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Household if geocoded, else the jittered point, else the barangay
    centroid. Null only when nothing at all is resolvable. */
function casePoint(c: FlowCaseRow): FacilityCasePoint | null {
  const meta = BARANGAY_INDEX.get(c.barangay_psgc);
  const barangayName = meta?.name ?? null;
  const address = c.address ?? null;
  if (finite(c.residence_lat) && finite(c.residence_lon)) {
    return {
      lat: c.residence_lat,
      lon: c.residence_lon,
      address,
      exact: true,
      barangayName,
    };
  }
  if (finite(c.jitter_lat) && finite(c.jitter_lon)) {
    return {
      lat: c.jitter_lat,
      lon: c.jitter_lon,
      address,
      exact: false,
      barangayName,
    };
  }
  if (meta) {
    return { lat: meta.lat, lon: meta.lon, address, exact: false, barangayName };
  }
  return null;
}

/**
 * One case as a single point carrying both ends of the surveillance link:
 * where the patient lives, and which facility registered them.
 *
 * The map drills down in two directions from the same list — click a barangay
 * to see its cases fan out to the facilities that registered them, or click a
 * facility to see its cases traced back to their homes. Deriving both from one
 * per-case array keeps the two views arithmetically identical; computing them
 * separately is how a barangay total and a facility total drift apart.
 */
export interface CasePin {
  /** Home location: geocoded household, else jittered point, else centroid. */
  lat: number;
  lon: number;
  address: string | null;
  /** True when lat/lon is the real household rather than a fallback. */
  exact: boolean;
  barangayPsgc: number;
  barangayName: string | null;
  /** Registering DOTS facility — null until the case enters the TB register. */
  facilityId: string | null;
  facilityName: string | null;
  facilityLat: number | null;
  facilityLon: number | null;
  /** Barangay the registering facility sits in — the "counted under" axis. */
  facilityBarangayPsgc: number | null;
}

export function computeCasePins(
  cases: FlowCaseRow[],
  facilities: FacilityRow[]
): CasePin[] {
  const byId = new Map(facilities.map((f) => [f.id, f]));
  const pins: CasePin[] = [];
  for (const c of cases) {
    const point = casePoint(c);
    if (!point) continue;
    const f = c.facility_id ? byId.get(c.facility_id) : undefined;
    pins.push({
      lat: point.lat,
      lon: point.lon,
      address: point.address,
      exact: point.exact,
      barangayPsgc: c.barangay_psgc,
      barangayName: point.barangayName,
      facilityId: f?.id ?? null,
      facilityName: f?.name ?? null,
      facilityLat: f?.lat ?? null,
      facilityLon: f?.lon ?? null,
      facilityBarangayPsgc: f?.barangay_psgc ?? null,
    });
  }
  return pins;
}

export function computeFacilityFlows(
  cases: FlowCaseRow[],
  facilities: FacilityRow[]
): FacilityFlowStat[] {
  const originCounts = new Map<string, Map<number, number>>();
  const casePoints = new Map<string, FacilityCasePoint[]>();
  for (const c of cases) {
    if (!c.facility_id) continue;
    let perFacility = originCounts.get(c.facility_id);
    if (!perFacility) {
      perFacility = new Map();
      originCounts.set(c.facility_id, perFacility);
    }
    perFacility.set(
      c.barangay_psgc,
      (perFacility.get(c.barangay_psgc) ?? 0) + 1
    );
    const point = casePoint(c);
    if (point) {
      const list = casePoints.get(c.facility_id);
      if (list) list.push(point);
      else casePoints.set(c.facility_id, [point]);
    }
  }

  const stats: FacilityFlowStat[] = facilities.map((f) => {
    const perFacility = originCounts.get(f.id);
    const origins: FacilityFlowOrigin[] = [];
    const ownBgyKnown = f.barangay_psgc !== null;
    let caseCount = 0;
    let outsideCount = 0;
    if (perFacility) {
      for (const [psgc, count] of perFacility) {
        caseCount += count;
        if (ownBgyKnown && psgc !== f.barangay_psgc) outsideCount += count;
        const meta = BARANGAY_INDEX.get(psgc);
        if (!meta) continue;
        origins.push({
          psgc,
          name: meta.name,
          lat: meta.lat,
          lon: meta.lon,
          count,
        });
      }
      origins.sort((a, b) => b.count - a.count);
    }
    return {
      id: f.id,
      name: f.name,
      lat: f.lat,
      lon: f.lon,
      barangayPsgc: f.barangay_psgc,
      caseCount,
      outsideCount: ownBgyKnown ? outsideCount : null,
      origins,
      points: casePoints.get(f.id) ?? [],
    };
  });

  // Busiest facilities first so list panels can slice the top directly.
  stats.sort((a, b) => b.caseCount - a.caseCount);
  return stats;
}
