import { describe, it, expect } from "vitest";
import {
  computeCasePins,
  computeHotspotInsights,
  attributionPsgc,
  type FacilityRow,
  type HotspotCaseRow,
} from "../lib/hotspotUtils";
import barangays from "../data/barangays.json";

// The panel's example: a patient from MINTAL who registers at a DOTS centre in
// TALOMO. The case is recorded under Talomo; the map must still say Mintal.
const [MINTAL, TALOMO] = (
  barangays as { psgc: number; name: string; lat: number; lon: number }[]
).slice(0, 2);

const TALOMO_DOTS: FacilityRow = {
  id: "talomo-dots",
  name: "Talomo DOTS Center",
  lat: TALOMO.lat,
  lon: TALOMO.lon,
  barangay_psgc: TALOMO.psgc,
};

const CASES: HotspotCaseRow[] = [
  // Lives in Mintal, registered in Talomo.
  {
    barangay_psgc: MINTAL.psgc,
    facility_id: "talomo-dots",
    reported_at: new Date().toISOString(),
    created_at: null,
    tb_classification: null,
  },
  // Lives in Talomo, registered in Talomo.
  {
    barangay_psgc: TALOMO.psgc,
    facility_id: "talomo-dots",
    reported_at: new Date().toISOString(),
    created_at: null,
    tb_classification: null,
  },
  // Lives in Mintal, never entered the register.
  {
    barangay_psgc: MINTAL.psgc,
    facility_id: null,
    reported_at: new Date().toISOString(),
    created_at: null,
    tb_classification: null,
  },
];

const statFor = (
  stats: { psgc: number }[],
  psgc: number
) => stats.find((s) => s.psgc === psgc);

describe("attributionPsgc", () => {
  it("files a case under the registering facility's barangay", () => {
    expect(attributionPsgc(MINTAL.psgc, TALOMO.psgc, "facility")).toBe(
      TALOMO.psgc
    );
  });

  it("keeps residence when that is the axis being asked for", () => {
    expect(attributionPsgc(MINTAL.psgc, TALOMO.psgc, "residence")).toBe(
      MINTAL.psgc
    );
  });

  it("falls back to residence for a case with no registering facility", () => {
    // An unregistered case is still a real case; dropping it off the map
    // because no facility claimed it would understate the burden.
    expect(attributionPsgc(MINTAL.psgc, null, "facility")).toBe(MINTAL.psgc);
  });
});

describe("computeHotspotInsights attribution", () => {
  it("records the Mintal patient under Talomo on the facility axis", () => {
    const insights = computeHotspotInsights(CASES, {
      attribution: "facility",
      facilities: [TALOMO_DOTS],
    });
    // Both registered cases count in Talomo, wherever the patients live.
    expect(statFor(insights.barangayStats, TALOMO.psgc)?.caseCount).toBe(2);
    // Mintal keeps only the case that never reached a register.
    expect(statFor(insights.barangayStats, MINTAL.psgc)?.caseCount).toBe(1);
    expect(insights.attribution).toBe("facility");
  });

  it("records the same patient under Mintal on the residence axis", () => {
    const insights = computeHotspotInsights(CASES, {
      attribution: "residence",
      facilities: [TALOMO_DOTS],
    });
    expect(statFor(insights.barangayStats, MINTAL.psgc)?.caseCount).toBe(2);
    expect(statFor(insights.barangayStats, TALOMO.psgc)?.caseCount).toBe(1);
  });

  it("never loses the origin: both counts ride along on either axis", () => {
    for (const attribution of ["facility", "residence"] as const) {
      const insights = computeHotspotInsights(CASES, {
        attribution,
        facilities: [TALOMO_DOTS],
      });
      const talomo = statFor(insights.barangayStats, TALOMO.psgc)!;
      const mintal = statFor(insights.barangayStats, MINTAL.psgc)!;
      // Talomo registered 2, but only 1 of those patients lives there.
      expect(talomo.registeredCases).toBe(2);
      expect(talomo.residentCases).toBe(1);
      // Mintal registered none, yet 2 of its residents have TB.
      expect(mintal.registeredCases).toBe(0);
      expect(mintal.residentCases).toBe(2);
    }
  });

  it("defaults to residence so existing callers are unchanged", () => {
    const insights = computeHotspotInsights(CASES);
    expect(insights.attribution).toBe("residence");
    expect(statFor(insights.barangayStats, MINTAL.psgc)?.caseCount).toBe(2);
  });

  it("clusters on residence regardless of the counting axis", () => {
    // Transmission happens where people live. Clustering on the registering
    // facility would stack every case onto the clinic and put the hotspot on
    // the health centre instead of the neighbourhood.
    const byFacility = computeHotspotInsights(CASES, {
      attribution: "facility",
      facilities: [TALOMO_DOTS],
    });
    const byResidence = computeHotspotInsights(CASES, {
      attribution: "residence",
      facilities: [TALOMO_DOTS],
    });
    expect(byFacility.clusters).toEqual(byResidence.clusters);
  });
});

describe("computeCasePins", () => {
  it("carries the registering facility's barangay so the map can filter on it", () => {
    const pins = computeCasePins(CASES, [TALOMO_DOTS]);
    const registered = pins.find((p) => p.facilityId === "talomo-dots")!;
    expect(registered.barangayPsgc).toBe(MINTAL.psgc);
    expect(registered.facilityBarangayPsgc).toBe(TALOMO.psgc);

    const unregistered = pins.find((p) => p.facilityId === null)!;
    expect(unregistered.facilityBarangayPsgc).toBeNull();
  });
});
