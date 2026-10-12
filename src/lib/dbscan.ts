export interface DbscanPoint {
  id: string;
  lat: number;
  lon: number;
}

export interface DbscanCluster {
  id: number; // -1 = noise
  points: DbscanPoint[];
  centroid: { lat: number; lon: number };
}

// Same spherical earth (R = 6371 km) as haversineKm, so a pair sits on the
// same side of eps here as everywhere else the app measures distance.
const KM_PER_DEG = (6371 * Math.PI) / 180;

/**
 * DBSCAN clustering on geographic points.
 *
 * Built to stay fast on the full city register (thousands of cases):
 *
 * - Points are projected once onto a flat km grid around their mean
 *   latitude, on the same sphere as haversineKm. At city scale the two agree
 *   to within centimetres, and a squared-distance check skips the trig.
 * - A uniform grid with eps-sized cells means a neighbour query only looks at
 *   the 3×3 cells around a point instead of every point in the city.
 * - Each point is labelled the moment it is queued, so it is queued and
 *   expanded at most once. The textbook version re-queues every neighbour of
 *   every core point, which on dense data grows the queue into the millions
 *   and froze the Dashboard and map for seconds.
 *
 * @param points  Points to cluster.
 * @param epsKm   Neighbourhood radius in kilometres.
 * @param minPts  Minimum points to form a dense region (incl. the core point).
 */
export function dbscan(
  points: DbscanPoint[],
  epsKm: number,
  minPts: number
): DbscanCluster[] {
  const n = points.length;
  if (n === 0 || epsKm <= 0) return [];

  // ── Project to km ────────────────────────────────────────────────────
  let latSum = 0;
  for (const p of points) latSum += p.lat;
  const kmPerDegLon = KM_PER_DEG * Math.cos(((latSum / n) * Math.PI) / 180);
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = points[i].lon * kmPerDegLon;
    ys[i] = points[i].lat * KM_PER_DEG;
  }

  // ── Grid index ───────────────────────────────────────────────────────
  const cellKey = (cx: number, cy: number) => cx * 1_000_003 + cy;
  const cx = new Int32Array(n);
  const cy = new Int32Array(n);
  const grid = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    cx[i] = Math.floor(xs[i] / epsKm);
    cy[i] = Math.floor(ys[i] / epsKm);
    const k = cellKey(cx[i], cy[i]);
    const bucket = grid.get(k);
    if (bucket) bucket.push(i);
    else grid.set(k, [i]);
  }

  const eps2 = epsKm * epsKm;
  const neighbours = (i: number, out: number[]) => {
    out.length = 0;
    const x = xs[i];
    const y = ys[i];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(cellKey(cx[i] + dx, cy[i] + dy));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j === i) continue;
          const ddx = xs[j] - x;
          const ddy = ys[j] - y;
          if (ddx * ddx + ddy * ddy <= eps2) out.push(j);
        }
      }
    }
    return out;
  };

  // ── Expand clusters ──────────────────────────────────────────────────
  // 0 = unvisited, -1 = noise, >0 = cluster id.
  const labels = new Int32Array(n);
  const queue = new Int32Array(n);
  const buf: number[] = [];
  let cid = 0;

  for (let i = 0; i < n; i++) {
    if (labels[i] !== 0) continue;
    if (neighbours(i, buf).length + 1 < minPts) {
      labels[i] = -1;
      continue;
    }
    cid += 1;
    labels[i] = cid;
    let head = 0;
    let tail = 0;
    for (const j of buf) {
      if (labels[j] === 0) queue[tail++] = j;
      // Noise reached from a core point becomes a border point.
      if (labels[j] <= 0) labels[j] = cid;
    }
    while (head < tail) {
      const k = queue[head++];
      if (neighbours(k, buf).length + 1 < minPts) continue; // border point
      for (const j of buf) {
        if (labels[j] === 0) queue[tail++] = j;
        if (labels[j] <= 0) labels[j] = cid;
      }
    }
  }

  // ── Collect ──────────────────────────────────────────────────────────
  const clustersMap = new Map<number, DbscanPoint[]>();
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l <= 0) continue;
    const list = clustersMap.get(l);
    if (list) list.push(points[i]);
    else clustersMap.set(l, [points[i]]);
  }

  const out: DbscanCluster[] = [];
  for (const [id, pts] of clustersMap) {
    let cLat = 0;
    let cLon = 0;
    for (const p of pts) {
      cLat += p.lat;
      cLon += p.lon;
    }
    out.push({
      id,
      points: pts,
      centroid: { lat: cLat / pts.length, lon: cLon / pts.length },
    });
  }
  out.sort((a, b) => b.points.length - a.points.length);
  return out;
}
