import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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

  // Full-bleed frame — AppLayout gives this route the whole content area;
  // `isolate` traps Leaflet's internal z-indexes inside the view.
  const frame = "relative isolate h-full overflow-hidden bg-brand-950";

  if (error) {
    return (
      <div className={"flex items-center justify-center bg-vigil-grid " + frame}>
        <div className="max-w-md px-6 text-center">
          <p className="font-display text-base font-bold tracking-tight text-white">
            Map data unavailable
          </p>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={"flex items-center justify-center bg-vigil-grid " + frame}>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-accent-400" />
          Loading surveillance map…
        </div>
      </div>
    );
  }

  return (
    <div className={frame}>
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
