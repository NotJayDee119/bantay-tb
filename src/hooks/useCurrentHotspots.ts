import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import {
  hotspotRowToCluster,
  type CurrentHotspotRow,
  type HotspotCluster,
} from "../lib/hotspotUtils";

/**
 * The current Gi* hotspots — the ONE list every page shows.
 *
 * Hotspots are computed by the detect-hotspots Edge Function over every case
 * in the city. Pages used to recompute them in the browser from whatever cases
 * they had loaded (all dates, and for a barangay account only its own
 * barangay), so the Dashboard, the GIS map and the Hotspots page could show
 * different hotspots. Now they all read the stored result:
 *
 *   clusters    — rows of `hotspots` (RLS: citywide staff see all; area staff
 *                 see the hotspots in their own barangay).
 *   caseCounts  — cases per barangay in the latest run (hotspot_results),
 *                 used to explain which neighbours put a barangay on the list.
 *   run         — the latest run (window, Moran's I), for "as of" labels.
 */

export interface LatestRun {
  id: string;
  run_at: string;
  window_start: string;
  window_end: string;
  metric: "rate_per_100k" | "case_count";
  moran_i: number;
  moran_z: number;
  moran_p_sim: number;
}

export interface CurrentHotspots {
  clusters: HotspotCluster[];
  caseCounts: Map<number, number>;
  run: LatestRun | null;
}

const EMPTY: CurrentHotspots = { clusters: [], caseCounts: new Map(), run: null };

export function useCurrentHotspots(enabled = true) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["current-hotspots"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<CurrentHotspots> => {
      const [hotspotsRes, runRes] = await Promise.all([
        supabase
          .from("hotspots")
          .select(
            "id, barangay_psgc, case_count, severity, gi_z, gi_p, gi_class, centroid_lat, centroid_lon, radius_km"
          )
          .eq("disease", "tb")
          .not("gi_class", "is", null),
        supabase
          .from("hotspot_runs")
          .select(
            "id, run_at, window_start, window_end, metric, moran_i, moran_z, moran_p_sim"
          )
          .order("run_at", { ascending: false })
          .limit(1),
      ]);
      if (hotspotsRes.error) throw hotspotsRes.error;
      const run = (runRes.data?.[0] ?? null) as LatestRun | null;

      const caseCounts = new Map<number, number>();
      if (run) {
        const { data } = await supabase
          .from("hotspot_results")
          .select("barangay_psgc, case_count")
          .eq("run_id", run.id);
        for (const r of data ?? []) {
          caseCounts.set(Number(r.barangay_psgc), r.case_count);
        }
      }

      const clusters = ((hotspotsRes.data ?? []) as CurrentHotspotRow[])
        .map(hotspotRowToCluster)
        .sort((a, b) => b.giZ - a.giZ)
        .map((c, i) => ({ ...c, id: i + 1 }));

      return { clusters, caseCounts, run };
    },
  });

  // A finished run rewrites `hotspots`; refresh once it settles.
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`current-hotspots-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hotspots" },
        () => {
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            void qc.invalidateQueries({ queryKey: ["current-hotspots"] });
          }, 800);
        }
      )
      .subscribe();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);

  return { ...query, hotspots: query.data ?? EMPTY };
}
