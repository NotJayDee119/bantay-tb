// BANTAY-TB hotspot detection Edge Function.
//
// Runs DBSCAN on TB cases reported in the configured window and writes one
// row to public.hotspots per detected cluster. Triggers a hotspot_alert for
// every TB Coordinator account when a HIGH severity cluster is created.
//
// Defaults: 90-day window, eps=1.2 km, minPts=8.

import { corsHeaders } from "../_shared/cors.ts";
import { dbFromEnv, dbInsert, dbSelect } from "../_shared/db.ts";

interface Body {
  trigger?: string;
  window_days?: number;
  eps_km?: number;
  min_pts?: number;
}

interface CaseRow {
  id: string;
  barangay_psgc: number;
  jitter_lat: number;
  jitter_lon: number;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface DbPoint {
  id: string;
  barangay_psgc: number;
  lat: number;
  lon: number;
}

function dbscan(points: DbPoint[], epsKm: number, minPts: number) {
  const labels = new Array<number>(points.length).fill(0);
  let cid = 0;
  const neighbours = (i: number) => {
    const r: number[] = [];
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      if (
        haversineKm(
          [points[i].lon, points[i].lat],
          [points[j].lon, points[j].lat]
        ) <= epsKm
      )
        r.push(j);
    }
    return r;
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
  const clusters = new Map<number, DbPoint[]>();
  for (let i = 0; i < points.length; i++) {
    const l = labels[i];
    if (l <= 0) continue;
    if (!clusters.has(l)) clusters.set(l, []);
    clusters.get(l)!.push(points[i]);
  }
  return [...clusters.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cfg = dbFromEnv();
  if (!cfg) {
    return json({ error: "Supabase env not configured" }, 500);
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  // Resolve thresholds: explicit body overrides > app_settings.dbscan > defaults.
  const defaults = { window_days: 90, eps_km: 1.2, min_pts: 8 };
  let stored: typeof defaults = defaults;
  try {
    const rows = await dbSelect<{ value: typeof defaults }>(
      cfg,
      "app_settings",
      "select=value&key=eq.dbscan&limit=1"
    );
    if (rows[0]?.value) stored = { ...defaults, ...rows[0].value };
  } catch (_err) {
    // table may not exist on older deployments; fall back to defaults silently.
  }
  const windowDays = body.window_days ?? stored.window_days;
  const epsKm = body.eps_km ?? stored.eps_km;
  const minPts = body.min_pts ?? stored.min_pts;

  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  let cases: CaseRow[];
  try {
    cases = await dbSelect<CaseRow>(
      cfg,
      "cases",
      `select=id,barangay_psgc,jitter_lat,jitter_lon&reported_at=gte.${since.toISOString()}&limit=20000`
    );
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  const points: DbPoint[] = cases.map((c: CaseRow) => ({
    id: c.id,
    barangay_psgc: c.barangay_psgc,
    lat: c.jitter_lat,
    lon: c.jitter_lon,
  }));

  const clusters = dbscan(points, epsKm, minPts);
  const inserts = clusters.map((pts) => {
    const counts = new Map<number, number>();
    for (const p of pts)
      counts.set(p.barangay_psgc, (counts.get(p.barangay_psgc) ?? 0) + 1);
    const topBgy = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const cLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const cLon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
    const radius_km = Math.max(
      0.3,
      ...pts.map((p) => haversineKm([cLon, cLat], [p.lon, p.lat]))
    );
    const density = pts.length / (Math.PI * radius_km * radius_km);
    const severity =
      pts.length >= 25 ? "high" : pts.length >= 15 ? "medium" : "low";
    return {
      barangay_psgc: topBgy ?? null,
      disease: "tb" as const,
      case_count: pts.length,
      density,
      severity,
      window_start: since.toISOString(),
      window_end: new Date().toISOString(),
      centroid_lat: cLat,
      centroid_lon: cLon,
      radius_km,
    };
  });

  if (inserts.length > 0) {
    let inserted: {
      id: string;
      severity: string;
      barangay_psgc: number | null;
    }[];
    try {
      inserted = await dbInsert<{
        id: string;
        severity: string;
        barangay_psgc: number | null;
      }>(
        cfg,
        "hotspots",
        inserts as unknown as {
          id: string;
          severity: string;
          barangay_psgc: number | null;
        }[]
      );
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }

    // Notify staff about HIGH severity clusters.
    const highHotspots = inserted.filter((h) => h.severity === "high");
    if (highHotspots.length > 0) {
      try {
        // Per the BANTAY-TB framework + community-scoped RLS:
        //   * tb_coordinator gets every high-severity alert (citywide).
        //   * barangay_admin / health_worker only get alerts for hotspots
        //     in *their own* barangay.
        const recipients = await dbSelect<{
          id: string;
          role: string;
          barangay_psgc: number | null;
        }>(
          cfg,
          "profiles",
          "select=id,role,barangay_psgc&role=in.(tb_coordinator,barangay_admin,health_worker)"
        );

        const alerts: { hotspot_id: string; recipient_id: string }[] = [];
        for (const h of highHotspots) {
          for (const r of recipients) {
            if (r.role === "tb_coordinator") {
              alerts.push({ hotspot_id: h.id, recipient_id: r.id });
              continue;
            }
            // BA / HW: only notify if hotspot is in their assigned barangay.
            if (
              r.barangay_psgc !== null &&
              h.barangay_psgc !== null &&
              r.barangay_psgc === h.barangay_psgc
            ) {
              alerts.push({ hotspot_id: h.id, recipient_id: r.id });
            }
          }
        }

        if (alerts.length > 0) {
          await dbInsert(cfg, "hotspot_alerts", alerts, { returning: false });
        }
      } catch (err) {
        // Best-effort fan-out; hotspots already inserted, don't fail the request.
        console.error("hotspot alert notification failed:", err);
      }
    }
  }

  return json({
    trigger: body.trigger ?? "manual",
    cases_considered: points.length,
    clusters_detected: inserts.length,
    inserted: inserts,
  });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
