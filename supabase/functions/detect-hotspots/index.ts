// BANTAY-TB hotspot detection Edge Function — Moran's I + Getis-Ord Gi*.
//
// A hotspot is a BARANGAY whose TB burden is statistically high together with
// its neighbours' — not simply the barangay with the most cases, and not a
// batch of newly recorded cases. Each run:
//
//   1. Counts cases per barangay of RESIDENCE over the configured window
//      (all 182 barangays; zero is an observation, not missing data).
//   2. Uses cases per 100,000 when every barangay has a population, otherwise
//      the case count, and records which.
//   3. Global Moran's I (row-standardised queen weights, 999 permutations).
//   4. Local Gi* per barangay (binary queen weights including self).
//   5. Saves the run to hotspot_runs + hotspot_results, syncs the current
//      `hotspots` list to the 95%/99% hotspots (sync_hotspots(), atomic and
//      serialised), and alerts staff about each barangay that has NEWLY become
//      a hotspot — one that was not already on the list.
//
// Triggered once per case save / import batch / page refresh — never per row.

import { corsHeaders } from "../_shared/cors.ts";
import {
  dbFromEnv,
  dbInsert,
  dbRpc,
  dbSelect,
  dbSelectAll,
} from "../_shared/db.ts";
import { analyzeSpatial, isHotspotClass } from "../_shared/spatial.ts";

interface Body {
  trigger?: string;
  window_days?: number;
  permutations?: number;
}

interface GiSettings {
  window_days: number;
  permutations: number;
}

const SETTINGS_DEFAULTS: GiSettings = { window_days: 365, permutations: 999 };

interface BarangayRow {
  psgc: number;
  centroid_lat: number;
  centroid_lon: number;
  area_km2: number | null;
  population: number | null;
}

interface CaseRow {
  id: string;
  barangay_psgc: number;
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

  const started = Date.now();

  // Resolve settings: explicit body overrides > app_settings.hotspot_gi > defaults.
  let stored: GiSettings = SETTINGS_DEFAULTS;
  try {
    const rows = await dbSelect<{ value: Partial<GiSettings> }>(
      cfg,
      "app_settings",
      "select=value&key=eq.hotspot_gi&limit=1"
    );
    if (rows[0]?.value) stored = { ...SETTINGS_DEFAULTS, ...rows[0].value };
  } catch (_err) {
    // Settings are optional; fall back to defaults.
  }
  const windowDays = body.window_days ?? stored.window_days;
  const permutations = body.permutations ?? stored.permutations;

  const windowEnd = new Date();
  const since = new Date(windowEnd);
  since.setDate(since.getDate() - windowDays);

  let barangays: BarangayRow[];
  let neighbourRows: { barangay_psgc: number; neighbor_psgc: number }[];
  let cases: CaseRow[];
  try {
    [barangays, neighbourRows, cases] = await Promise.all([
      dbSelectAll<BarangayRow>(
        cfg,
        "barangays",
        "select=psgc,centroid_lat,centroid_lon,area_km2,population&order=psgc"
      ),
      dbSelectAll<{ barangay_psgc: number; neighbor_psgc: number }>(
        cfg,
        "barangay_neighbors",
        "select=barangay_psgc,neighbor_psgc&order=barangay_psgc,neighbor_psgc"
      ),
      dbSelectAll<CaseRow>(
        cfg,
        "cases",
        `select=id,barangay_psgc&disease=eq.tb&reported_at=gte.${since.toISOString()}&order=id`
      ),
    ]);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  if (neighbourRows.length === 0) {
    return json(
      { error: "barangay_neighbors is empty — apply 20261023000001_barangay_neighbors_seed.sql" },
      500
    );
  }

  const neighbours: Record<string, number[]> = {};
  for (const r of neighbourRows) {
    (neighbours[String(r.barangay_psgc)] ??= []).push(Number(r.neighbor_psgc));
  }

  const casesByBgy = new Map<number, string[]>();
  for (const c of cases) {
    const list = casesByBgy.get(Number(c.barangay_psgc));
    if (list) list.push(c.id);
    else casesByBgy.set(Number(c.barangay_psgc), [c.id]);
  }

  const analysis = analyzeSpatial(
    barangays.map((b) => ({
      psgc: Number(b.psgc),
      cases: casesByBgy.get(Number(b.psgc))?.length ?? 0,
      population: b.population,
    })),
    neighbours,
    { permutations }
  );

  const hot = analysis.units.filter((u) => isHotspotClass(u.giClass));
  const cold = analysis.units.filter(
    (u) => u.giClass === "coldspot_95" || u.giClass === "coldspot_99"
  );

  let runId: string;
  try {
    const [run] = await dbInsert<{ id: string }>(cfg, "hotspot_runs", {
      trigger: body.trigger ?? "manual",
      window_start: since.toISOString(),
      window_end: windowEnd.toISOString(),
      metric: analysis.metric,
      n_units: analysis.units.length,
      cases_considered: cases.length,
      moran_i: analysis.moran.I,
      moran_expected: analysis.moran.expected,
      moran_z: analysis.moran.z,
      moran_p_norm: analysis.moran.pNorm,
      moran_p_sim: analysis.moran.pSim,
      permutations: analysis.moran.permutations,
      hotspot_count: hot.length,
      coldspot_count: cold.length,
      duration_ms: Date.now() - started,
    } as unknown as { id: string });
    runId = run.id;

    await dbInsert(
      cfg,
      "hotspot_results",
      analysis.units.map((u) => ({
        run_id: runId,
        barangay_psgc: u.psgc,
        case_count: u.cases,
        population: u.population,
        value: u.value,
        gi_z: u.giZ,
        gi_p: u.giP,
        gi_class: u.giClass,
        fdr_significant: u.fdrSignificant,
      })),
      { returning: false }
    );
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  const byPsgc = new Map(barangays.map((b) => [Number(b.psgc), b]));
  const inserts = hot.map((u) => {
    const b = byPsgc.get(u.psgc)!;
    const area = b.area_km2 && b.area_km2 > 0 ? b.area_km2 : null;
    return {
      barangay_psgc: u.psgc,
      // A Gi* hotspot is one barangay; alerts route to its own residents.
      barangay_psgcs: [u.psgc],
      case_ids: casesByBgy.get(u.psgc) ?? [],
      disease: "tb" as const,
      case_count: u.cases,
      density: area ? u.cases / area : 0,
      severity: u.giClass === "hotspot_99" ? "urgent" : "high",
      window_start: since.toISOString(),
      window_end: windowEnd.toISOString(),
      centroid_lat: b.centroid_lat,
      centroid_lon: b.centroid_lon,
      // Radius of a circle with the barangay's area — map display only.
      radius_km: area ? Math.sqrt(area / Math.PI) : 0.5,
      run_id: runId,
      gi_z: u.giZ,
      gi_p: u.giP,
      gi_class: u.giClass,
    };
  });

  // Sync the current list in one locked transaction: still-hot barangays are
  // updated in place so the alerts already raised for them survive, cooled
  // ones are removed, and only barangays not already listed come back as new.
  // Runs even with no hotspots so stale rows clear out.
  type Synced = {
    hotspot_id: string;
    psgc: number;
    psgcs: number[] | null;
    sev: string;
    is_new: boolean;
  };
  let synced: Synced[];
  try {
    synced = await dbRpc<Synced[]>(cfg, "sync_hotspots", { p_rows: inserts });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  const fresh = synced.filter((h) => h.is_new);
  let alertsSent = 0;
  if (fresh.length > 0) {
    try {
      // Per the BANTAY-TB framework + community-scoped RLS:
      //   * system_admin / tb_coordinator get every new hotspot (citywide).
      //   * barangay_admin / health_worker get one when the hotspot is their
      //     own barangay of residence.
      // Mirrors buildHotspotAlerts() in src/lib/hotspotAlerts.ts — this
      // function deploys with --no-remote and cannot import it, so the two
      // copies must be changed together.
      const recipients = await dbSelect<{
        id: string;
        role: string;
        barangay_psgc: number | null;
      }>(
        cfg,
        "profiles",
        "select=id,role,barangay_psgc&role=in.(tb_coordinator,barangay_admin,health_worker,system_admin)"
      );

      const alerts: { hotspot_id: string; recipient_id: string }[] = [];
      for (const h of fresh) {
        for (const r of recipients) {
          if (r.role === "tb_coordinator" || r.role === "system_admin") {
            alerts.push({ hotspot_id: h.hotspot_id, recipient_id: r.id });
            continue;
          }
          if (r.barangay_psgc === null) continue;
          const members = h.psgcs;
          const covers =
            members && members.length > 0
              ? members.map(Number).includes(Number(r.barangay_psgc))
              : Number(h.psgc) === Number(r.barangay_psgc);
          if (covers) alerts.push({ hotspot_id: h.hotspot_id, recipient_id: r.id });
        }
      }

      if (alerts.length > 0) {
        await dbInsert(cfg, "hotspot_alerts", alerts, { returning: false });
        alertsSent = alerts.length;
      }
    } catch (err) {
      // Best-effort fan-out; the run is already saved, don't fail the request.
      console.error("hotspot alert notification failed:", err);
    }
  }

  return json({
    trigger: body.trigger ?? "manual",
    run_id: runId,
    metric: analysis.metric,
    window_days: windowDays,
    cases_considered: cases.length,
    moran: analysis.moran,
    hotspots: hot.map((u) => ({ psgc: u.psgc, z: u.giZ, p: u.giP, class: u.giClass })),
    coldspots: cold.length,
    new_hotspots: fresh.length,
    alerts_sent: alertsSent,
    duration_ms: Date.now() - started,
  });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
