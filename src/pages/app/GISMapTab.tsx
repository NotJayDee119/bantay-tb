import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  computeHotspotInsights,
  type HotspotInsights,
  type HotspotCaseRow,
} from "../../lib/hotspotUtils";
import { AdminHotspotMap } from "../../components/AdminHotspotMap";
import { useAuth } from "../../hooks/useAuth";
import barangays from "../../data/barangays.json";

interface GISMapTabProps {
  focusBarangay?: string | null;
}

export function GISMapTab({ focusBarangay = null }: GISMapTabProps) {
  const { profile } = useAuth();

  // For health_worker / barangay_admin, default focus to their assigned area.
  const assignedPsgc =
    (profile?.role === "health_worker" || profile?.role === "barangay_admin")
      ? (profile.barangay_psgc ?? null)
      : null;

  const resolvedFocus = useMemo(() => {
    if (focusBarangay) return focusBarangay;
    if (!assignedPsgc) return null;
    return barangays.find((b) => b.psgc === assignedPsgc)?.name ?? null;
  }, [focusBarangay, assignedPsgc]);
  const [hotspotInsights, setHotspotInsights] =
    useState<HotspotInsights | null>(null);
  const [heatPoints, setHeatPoints] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchMapData() {
      setLoading(true);
      setError(null);
      const { data: allCases, error } = await supabase
        .from("cases")
        .select(
          "barangay_psgc, reported_at, created_at, tb_classification, jitter_lat, jitter_lon"
        )
        .eq("disease", "tb");

      if (error || !allCases) {
        console.error("Error fetching data:", error);
        if (!cancelled) {
          setError(
            "Unable to load map data right now. Check your Supabase connection and row-level permissions."
          );
          setLoading(false);
        }
        return;
      }

      const insights = computeHotspotInsights(allCases as HotspotCaseRow[]);

      // Extract individual jitter coordinates for the heatmap layer.
      const pts: [number, number][] = (allCases as HotspotCaseRow[])
        .filter(
          (c) =>
            typeof c.jitter_lat === "number" &&
            typeof c.jitter_lon === "number" &&
            Number.isFinite(c.jitter_lat) &&
            Number.isFinite(c.jitter_lon)
        )
        .map((c) => [c.jitter_lat as number, c.jitter_lon as number]);

      if (!cancelled) {
        setHotspotInsights(insights);
        setHeatPoints(pts);
        setLoading(false);
      }
    }
    fetchMapData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="max-w-md px-6 text-center">
          <p className="text-base font-semibold text-slate-900">
            Map data unavailable
          </p>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-brand-600"></div>
          <p className="mt-4 text-sm text-slate-600">Loading map data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <AdminHotspotMap
        hotspotInsights={hotspotInsights}
        focusBarangay={resolvedFocus}
        highlightPsgc={assignedPsgc}
        heatPoints={heatPoints}
      />
    </div>
  );
}

export default GISMapTab;
