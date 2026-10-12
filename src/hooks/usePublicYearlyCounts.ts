import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { readPublicCache, writePublicCache } from "../lib/publicCache";

export interface YearlyCount {
  year: number;
  psgc: number;
  count: number;
}

export type LoadStatus = "loading" | "ready" | "error";

const CACHE_KEY = "yearly-counts:v1";

function readCached(): YearlyCount[] | undefined {
  const rows = readPublicCache<YearlyCount[]>(CACHE_KEY);
  return Array.isArray(rows) ? rows : undefined;
}

async function fetchYearlyCounts(): Promise<YearlyCount[]> {
  const { data, error } = await supabase.rpc("barangay_case_counts_yearly", {
    p_disease: "tb",
  });
  if (error) throw error;
  const rows = (
    (data ?? []) as { year: number; barangay_psgc: number; case_count: number }[]
  ).map((d) => ({
    year: Number(d.year),
    psgc: Number(d.barangay_psgc),
    count: Number(d.case_count),
  }));
  writePublicCache(CACHE_KEY, rows);
  return rows;
}

/**
 * Per-(year, barangay) TB case totals for the public pages. The landing map,
 * the landing headline figure and the About page all read this one query, so
 * they can never disagree — and the shared query cache means one request
 * serves all of them.
 *
 * Comes from `barangay_case_counts_yearly`, a SECURITY DEFINER aggregate the
 * anonymous key may call: grouped totals only, no patient rows. The last good
 * copy is kept in localStorage and shown at once on a return visit; it is
 * marked stale so a fresh copy is fetched behind it, and a failed refresh
 * leaves it on screen rather than replacing it with an error.
 */
export function usePublicYearlyCounts(): {
  rows: YearlyCount[];
  status: LoadStatus;
} {
  const query = useQuery({
    queryKey: ["public-yearly-counts"],
    queryFn: fetchYearlyCounts,
    initialData: readCached,
    // Timestamp 0 = "as old as can be", so the stored copy is always refreshed.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
  });

  const rows = query.data ?? [];
  const status: LoadStatus = query.data
    ? "ready"
    : query.isError
      ? "error"
      : "loading";
  return { rows, status };
}

/** The newest year holding cases, and that year's citywide total. */
export function latestYearTotal(
  rows: YearlyCount[]
): { year: number; total: number } | null {
  if (rows.length === 0) return null;
  const year = Math.max(...rows.map((r) => r.year));
  const total = rows.reduce((sum, r) => (r.year === year ? sum + r.count : sum), 0);
  return { year, total };
}
