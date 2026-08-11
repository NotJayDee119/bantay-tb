import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  computeCasePins,
  computeFacilityFlows,
  computeHotspotInsights,
  type CasePin,
  type FacilityFlowStat,
  type FacilityRow,
  type HotspotInsights,
  type HotspotCaseRow,
} from "../../lib/hotspotUtils";
import { AdminHotspotMap } from "../../components/AdminHotspotMap";
import { useAreaScope } from "../../hooks/useAreaScope";
import { useCaseAttribution } from "../../hooks/useCaseAttribution";
import barangays from "../../data/barangays.json";

interface GISMapTabProps {
  focusBarangay?: string | null;
}

export function GISMapTab({ focusBarangay = null }: GISMapTabProps) {
  const scope = useAreaScope();

  // For health_worker / barangay_admin this is the only area they can read,
  // so it doubles as the map's focus.
  const assignedPsgc = scope.psgc;

  // A health centre sees the union of "lives in my barangay" and "registered
  // at my facility", so its map can legitimately show markers in other
  // barangays — the home addresses of cases its own clinic notified. Said
  // plainly here, because unexplained it reads as a leak. A barangay dashboard
  // has no such union: every marker it sees is one of its own residents.
  const scopeNote = useMemo(() => {
    if (!scope.scoped) return null;
    if (!scope.clinicScoped) {
      return scope.name
        ? `Showing cases living in ${scope.name}. Residents of other barangays are handled by their own barangay.`
        : "No area assigned yet, so no cases are shown.";
    }
    if (!scope.name && !scope.facilityId) {
      return "No area or facility assigned yet, so no cases are shown.";
    }
    if (!scope.name) {
      return "Showing cases registered at your DOTS facility. Markers are where those patients actually live.";
    }
    if (!scope.facilityId) {
      return `Showing cases living in ${scope.name}. No DOTS facility is assigned to your account yet, so your facility's own register is not included.`;
    }
    return `Showing cases living in ${scope.name} plus cases registered at your own DOTS facility. Markers outside ${scope.name} are where those registered cases actually live.`;
  }, [scope.scoped, scope.clinicScoped, scope.name, scope.facilityId]);

  const resolvedFocus = useMemo(() => {
    if (focusBarangay) return focusBarangay;
    if (!assignedPsgc) return null;
    return barangays.find((b) => b.psgc === assignedPsgc)?.name ?? null;
  }, [focusBarangay, assignedPsgc]);
  const [caseRows, setCaseRows] = useState<HotspotCaseRow[] | null>(null);
  const [facilityRows, setFacilityRows] = useState<FacilityRow[]>([]);
  const [facilityFlows, setFacilityFlows] = useState<FacilityFlowStat[]>([]);
  const [casePins, setCasePins] = useState<CasePin[]>([]);
  const [heatPoints, setHeatPoints] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Which barangay a case is counted under. Defaults to the registering
  // facility: a Mintal resident who registers at Talomo DOTS is Talomo's
  // register entry and Talomo's notification, so that is where the case is
  // recorded. Where the patient came from is never lost — every barangay
  // carries both numbers, and the drill-down traces each case home.
  //
  // Shared with the Dashboard rather than local to this page, so its barangay
  // ranking can't quietly disagree with the map's.
  const [attribution, setAttribution] = useCaseAttribution();

  // Recomputed on toggle rather than refetched: the axis is a way of counting
  // the same rows, not a different query.
  const hotspotInsights = useMemo<HotspotInsights | null>(
    () =>
      caseRows
        ? computeHotspotInsights(caseRows, {
            attribution,
            facilities: facilityRows,
          })
        : null,
    [caseRows, facilityRows, attribution]
  );

  useEffect(() => {
    let cancelled = false;
    async function fetchMapData() {
      setLoading(true);
      setError(null);
      // No barangay filter here on purpose. Area staff are scoped by RLS to
      // the union of "lives in my barangay" and "registered at a facility in
      // my barangay" (20261007000000). Re-applying an
      // `eq("barangay_psgc", …)` filter here would drop the second half —
      // which is exactly the bug where a Mintal worker saw an empty register
      // beside a facility marker claiming five cases.
      const query = supabase
        .from("cases")
        .select(
          "barangay_psgc, facility_id, address, residence_lat, residence_lon, reported_at, created_at, tb_classification, jitter_lat, jitter_lon"
        )
        .eq("disease", "tb");
      const [{ data: allCases, error }, { data: centers }] = await Promise.all([
        query,
        supabase.from("dots_centers").select("id, name, lat, lon, barangay_psgc"),
      ]);

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

      const rows = allCases as HotspotCaseRow[];
      const centerRows = (centers ?? []) as FacilityRow[];
      const flows = computeFacilityFlows(rows, centerRows);
      // Both drill-down directions read from this one per-case list, so a
      // barangay total and a facility total can never disagree.
      const pins = computeCasePins(rows, centerRows);

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
        setCaseRows(rows);
        setFacilityRows(centerRows);
        setFacilityFlows(flows);
        setCasePins(pins);
        setHeatPoints(pts);
        setLoading(false);
      }
    }
    fetchMapData();
    return () => {
      cancelled = true;
    };
  }, [scope.scoped, scope.psgc]);

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
        facilityFlows={facilityFlows}
        casePins={casePins}
        focusBarangay={resolvedFocus}
        highlightPsgc={assignedPsgc}
        heatPoints={heatPoints}
        scopeNote={scopeNote}
        attribution={attribution}
        onAttributionChange={setAttribution}
      />
    </div>
  );
}

export default GISMapTab;
