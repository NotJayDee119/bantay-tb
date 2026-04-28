import { haversineKm } from "./utils";

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

/**
 * DBSCAN clustering on geographic points.
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
  const labels = new Array<number>(points.length).fill(0); // 0 = unvisited, -1 = noise, >0 cluster id
  let cid = 0;

  const neighbours = (i: number): number[] => {
    const res: number[] = [];
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      if (
        haversineKm(
          [points[i].lon, points[i].lat],
          [points[j].lon, points[j].lat]
        ) <= epsKm
      ) {
        res.push(j);
      }
    }
    return res;
  };

  for (let i = 0; i < points.length; i++) {
    if (labels[i] !== 0) continue;
    const ns = neighbours(i);
    if (ns.length + 1 < minPts) {
      labels[i] = -1;
      continue;
    }
    cid += 1;
    labels[i] = cid;
    const queue = [...ns];
    while (queue.length) {
      const k = queue.shift()!;
      if (labels[k] === -1) labels[k] = cid;
      if (labels[k] !== 0) continue;
      labels[k] = cid;
      const kn = neighbours(k);
      if (kn.length + 1 >= minPts) queue.push(...kn);
    }
  }

  const clustersMap = new Map<number, DbscanPoint[]>();
  for (let i = 0; i < points.length; i++) {
    const l = labels[i];
    if (l <= 0) continue;
    if (!clustersMap.has(l)) clustersMap.set(l, []);
    clustersMap.get(l)!.push(points[i]);
  }

  const out: DbscanCluster[] = [];
  for (const [id, pts] of clustersMap) {
    const cLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const cLon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
    out.push({ id, points: pts, centroid: { lat: cLat, lon: cLon } });
  }
  out.sort((a, b) => b.points.length - a.points.length);
  return out;
}
