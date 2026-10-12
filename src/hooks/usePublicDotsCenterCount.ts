import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { readPublicCache, writePublicCache } from "../lib/publicCache";
import type { LoadStatus } from "./usePublicYearlyCounts";

const COUNT_KEY = "dots-center-count:v1";
// The DOTS Locator keeps the whole directory under this key; its length is a
// good first answer if the count itself has never been stored.
const DIRECTORY_KEY = "dots-centers:v1";

function readCached(): number | undefined {
  const count = readPublicCache<number>(COUNT_KEY);
  if (typeof count === "number") return count;
  const directory = readPublicCache<unknown[]>(DIRECTORY_KEY);
  return Array.isArray(directory) ? directory.length : undefined;
}

async function fetchCount(): Promise<number> {
  // `dots_centers` is anon-readable; head:true asks for the count alone.
  const { count, error } = await supabase
    .from("dots_centers")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  const n = count ?? 0;
  writePublicCache(COUNT_KEY, n);
  return n;
}

/** How many DOTS centers the public directory lists, live from the database. */
export function usePublicDotsCenterCount(): {
  count: number | null;
  status: LoadStatus;
} {
  const query = useQuery({
    queryKey: ["public-dots-center-count"],
    queryFn: fetchCount,
    initialData: readCached,
    // Timestamp 0 = "as old as can be", so a stored count is always refreshed.
    initialDataUpdatedAt: 0,
    staleTime: 30 * 60_000,
  });

  const count = query.data ?? null;
  const status: LoadStatus =
    count !== null ? "ready" : query.isError ? "error" : "loading";
  return { count, status };
}
