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
        .select("barangay_psgc, reported_at, created_at, tb_classification")
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
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f7b5c]"></div>
          <p className="mt-4 text-gray-600">Loading map data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white overflow-hidden" style={{ height: "100vh" }}>
      <div style={{ height: "100%" }}>
        <AdminHotspotMap
          hotspotInsights={hotspotInsights}
          focusBarangay={focusBarangay}
        />
      </div>
    </div>
  );
}

export default GISMapTab;
