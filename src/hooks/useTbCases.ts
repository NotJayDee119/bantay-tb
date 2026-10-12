import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { fetchAll } from "../lib/fetchAll";
import { useAreaScope } from "./useAreaScope";
import type { FacilityRow, HotspotCaseRow } from "../lib/hotspotUtils";

/**
 * The TB case register, loaded once and shared.
 *
 * The Dashboard, the GIS map and Reports & Charts all need every TB case (7,000+ rows). Each
 * used to download the whole register on its own, on every visit, and the
 * Dashboard again every 60 seconds and once per realtime event — a bulk
 * import of 1,000 rows fired 1,000 full reloads. Now:
 *
 * - one cached copy serves both pages, so moving between them is instant;
 * - realtime changes are batched into a single refresh a moment later;
 * - the fallback poll is every 5 minutes and pauses while the tab is hidden.
 *
 * Scoping is left to RLS, which returns the union of "lives in my barangay"
 * and "registered at a facility in my barangay". A local barangay filter
 * would drop the facility half and put these totals out of step with the
 * case register. The scope is still part of the cache key: a change of
 * assigned area means the same query returns different rows.
 */

export interface TbCaseRow extends HotspotCaseRow {
  id: string;
  treatment_outcome: string | null;
  age: number | null;
  sex: "male" | "female" | "other" | "unknown" | null;
}

// Union of what the Dashboard, the home screens, the map and Reports &
// Charts read — one download serves all four.
const COLUMNS =
  "id, barangay_psgc, facility_id, address, residence_lat, residence_lon, reported_at, created_at, tb_classification, treatment_outcome, age, sex, jitter_lat, jitter_lon";

const FIVE_MIN = 5 * 60_000;

export function useTbCases(enabled = true) {
  const scope = useAreaScope();
  const qc = useQueryClient();
  const key = ["tb-cases", scope.scoped, scope.psgc] as const;

  const query = useQuery({
    queryKey: key,
    enabled,
    staleTime: FIVE_MIN,
    refetchInterval: FIVE_MIN,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await fetchAll<TbCaseRow>(
        (from, to) =>
          supabase
            .from("cases")
            .select(COLUMNS)
            .eq("disease", "tb")
            .order("id")
            .range(from, to) as unknown as PromiseLike<{
            data: TbCaseRow[] | null;
            error: { message: string } | null;
          }>
      );
      if (error) throw new Error(error);
      return data;
    },
  });

  // Realtime: collapse a burst of row changes (an import, a batch edit) into
  // one refresh 1.5s after the last event.
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`tb-cases-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        () => {
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            void qc.invalidateQueries({ queryKey: ["tb-cases"] });
          }, 1500);
        }
      )
      .subscribe();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);

  return query;
}

/** DOTS centers — small and rarely changed, so cached for a long time. */
export function useDotsCenters(enabled = true) {
  return useQuery({
    queryKey: ["dots-centers"],
    enabled,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dots_centers")
        .select("id, name, lat, lon, barangay_psgc");
      if (error) throw error;
      return (data ?? []) as FacilityRow[];
    },
  });
}
