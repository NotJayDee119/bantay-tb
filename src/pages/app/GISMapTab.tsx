import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  computeHotspotInsights,
  type HotspotInsights,
  type HotspotCaseRow,
} from "../../lib/hotspotUtils";
import { AdminHotspotMap } from "../../components/AdminHotspotMap";

interface GISMapTabProps {
  focusBarangay?: string | null;
}

export function GISMapTab({ focusBarangay = null }: GISMapTabProps) {
  const [hotspotInsights, setHotspotInsights] =
    useState<HotspotInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchMapData() {
      setLoading(true);
      const { data: allCases, error } = await supabase
        .from("cases")
        .select(
          "barangay_psgc, reported_at, created_at, tb_classification, jitter_lat, jitter_lon"
        )
        .eq("disease", "tb");

      if (error || !allCases) {
         
        console.error("Error fetching data:", error);
        if (!cancelled) setLoading(false);
        return;
      }

      const insights = computeHotspotInsights(allCases as HotspotCaseRow[]);
      if (!cancelled) {
        setHotspotInsights(insights);
        setLoading(false);
      }
    }
    fetchMapData();
    return () => {
      cancelled = true;
    };
  }, []);

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
        focusBarangay={focusBarangay}
      />
    </div>
  );
}

export default GISMapTab;
