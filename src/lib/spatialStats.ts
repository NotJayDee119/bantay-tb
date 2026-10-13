// Re-export of the Moran's I / Getis-Ord Gi* implementation the
// detect-hotspots Edge Function runs, so the client maps, the server job and
// the tests all compute hotspots with the same arithmetic.
export * from "../../supabase/functions/_shared/spatial.ts";
