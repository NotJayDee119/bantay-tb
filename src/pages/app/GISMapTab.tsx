import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  computeCasePins,
  computeFacilityFlows,
  computeHotspotInsights,
  type CasePin,
  type FacilityFlowStat,
  type HotspotInsights,
} from "../../lib/hotspotUtils";
import { AdminHotspotMap } from "../../components/AdminHotspotMap";
import { useAreaScope } from "../../hooks/useAreaScope";
import { useCaseAttribution } from "../../hooks/useCaseAttribution";
import { useDotsCenters, useTbCases } from "../../hooks/useTbCases";
import { useCurrentHotspots } from "../../hooks/useCurrentHotspots";
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
  // Shared, cached copy of the register (same one the Dashboard reads), so
  // opening the map after the Dashboard doesn't download every case again.
  // No barangay filter on purpose: RLS scopes area staff to the union of
  // "lives in my barangay" and "registered at a facility in my barangay", and
  // re-filtering here would drop the second half.
  const casesQuery = useTbCases();
  const centersQuery = useDotsCenters();
  const caseRows = casesQuery.data ?? null;
  const facilityRows = useMemo(() => centersQuery.data ?? [], [centersQuery.data]);
  const loading = casesQuery.isPending || centersQuery.isPending;
  const error = casesQuery.isError
    ? "Unable to load map data right now. Check your Supabase connection and row-level permissions."
    : null;

  // Derived once per data change, not per render.
  const facilityFlows = useMemo<FacilityFlowStat[]>(
    () => (caseRows ? computeFacilityFlows(caseRows, facilityRows) : []),
    [caseRows, facilityRows]
  );
  // Both drill-down directions read from this one per-case list, so a
  // barangay total and a facility total can never disagree.
  const casePins = useMemo<CasePin[]>(
    () => (caseRows ? computeCasePins(caseRows, facilityRows) : []),
    [caseRows, facilityRows]
  );
  // Individual jittered coordinates for the heatmap layer.
  const heatPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    for (const c of caseRows ?? []) {
      if (Number.isFinite(c.jitter_lat) && Number.isFinite(c.jitter_lon)) {
        pts.push([c.jitter_lat as number, c.jitter_lon as number]);
      }
    }
    return pts;
  }, [caseRows]);

  const [attribution, setAttribution] = useCaseAttribution();
  // Hotspots come from the citywide detection run, never from the cases this
  // account can see — a barangay account would otherwise run Gi* on one
  // barangay.
  const { hotspots } = useCurrentHotspots();

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
        hotspots={hotspots.clusters}
        hotspotCaseCounts={hotspots.caseCounts}
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
