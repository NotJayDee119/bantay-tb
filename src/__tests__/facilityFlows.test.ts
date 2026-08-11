import { describe, it, expect } from "vitest";
import {
  computeCasePins,
  computeFacilityFlows,
  type FacilityRow,
} from "../lib/hotspotUtils";
import barangays from "../data/barangays.json";

// Two real barangays so origins resolve through the PSGC index.
const [HOME, AWAY] = (
  barangays as { psgc: number; name: string; lat: number; lon: number }[]
).slice(0, 2);

const CLINIC: FacilityRow = {
  id: "clinic-1",
  name: "Home Health Center",
  lat: HOME.lat,
  lon: HOME.lon,
  barangay_psgc: HOME.psgc,
};

const HUB: FacilityRow = {
  id: "hub-1",
  name: "District Hub",
  lat: AWAY.lat,
  lon: AWAY.lon,
  barangay_psgc: AWAY.psgc,
};

describe("computeFacilityFlows", () => {
  it("groups cases per facility and breaks them down by residence barangay", () => {
    const flows = computeFacilityFlows(
      [
        { barangay_psgc: HOME.psgc, facility_id: "hub-1" },
        { barangay_psgc: HOME.psgc, facility_id: "hub-1" },
        { barangay_psgc: AWAY.psgc, facility_id: "hub-1" },
        { barangay_psgc: HOME.psgc, facility_id: "clinic-1" },
      ],
      [CLINIC, HUB]
    );

    const hub = flows.find((f) => f.id === "hub-1")!;
    expect(hub.caseCount).toBe(3);
    // Two of the hub's patients live in HOME, not the hub's own barangay —
    // the exposure risk (and possible service gap) is there.
    expect(hub.outsideCount).toBe(2);
    expect(hub.origins[0]).toMatchObject({ psgc: HOME.psgc, count: 2 });
    expect(hub.origins[1]).toMatchObject({ psgc: AWAY.psgc, count: 1 });

    const clinic = flows.find((f) => f.id === "clinic-1")!;
    expect(clinic.caseCount).toBe(1);
    expect(clinic.outsideCount).toBe(0);
  });

  it("sorts busiest facilities first and keeps zero-case facilities", () => {
    const flows = computeFacilityFlows(
      [{ barangay_psgc: HOME.psgc, facility_id: "hub-1" }],
      [CLINIC, HUB]
    );
    expect(flows.map((f) => f.id)).toEqual(["hub-1", "clinic-1"]);
    expect(flows[1].caseCount).toBe(0);
    expect(flows[1].origins).toEqual([]);
  });

  it("ignores cases with no recorded facility (legacy rows, presumptives)", () => {
    const flows = computeFacilityFlows(
      [
        { barangay_psgc: HOME.psgc, facility_id: null },
        { barangay_psgc: HOME.psgc },
      ],
      [CLINIC]
    );
    expect(flows[0].caseCount).toBe(0);
  });

  it("reports outsideCount as null when the facility's own barangay is unrecorded", () => {
    const flows = computeFacilityFlows(
      [{ barangay_psgc: HOME.psgc, facility_id: "hub-1" }],
      [{ ...HUB, barangay_psgc: null }]
    );
    expect(flows[0].caseCount).toBe(1);
    // "Outside the facility's barangay" is undefined without a barangay.
    expect(flows[0].outsideCount).toBeNull();
  });

  it("still counts cases whose residence barangay is not in the index", () => {
    const flows = computeFacilityFlows(
      [{ barangay_psgc: 999, facility_id: "clinic-1" }],
      [CLINIC]
    );
    // Counted toward the facility total (and as outside its barangay), but
    // no origin marker since there is no centroid to draw it at.
    expect(flows[0].caseCount).toBe(1);
    expect(flows[0].outsideCount).toBe(1);
    expect(flows[0].origins).toEqual([]);
    expect(flows[0].points).toEqual([]);
  });

  it("stays arithmetically identical to computeCasePins", () => {
    // The map drills down in both directions from these two helpers. If a
    // barangay total and a facility total can disagree, the map contradicts
    // itself — which is the bug this pairing exists to prevent.
    const cases = [
      { barangay_psgc: HOME.psgc, facility_id: "hub-1" },
      { barangay_psgc: HOME.psgc, facility_id: "clinic-1" },
      { barangay_psgc: AWAY.psgc, facility_id: "hub-1" },
      { barangay_psgc: AWAY.psgc, facility_id: null },
    ];
    const flows = computeFacilityFlows(cases, [CLINIC, HUB]);
    const pins = computeCasePins(cases, [CLINIC, HUB]);

    for (const f of flows) {
      expect(pins.filter((p) => p.facilityId === f.id)).toHaveLength(
        f.caseCount
      );
    }
    // The unregistered case still gets a pin, so a barangay drill-down shows
    // it even though no facility claims it.
    expect(pins).toHaveLength(4);
    expect(pins.filter((p) => p.facilityId === null)).toHaveLength(1);
    expect(pins.filter((p) => p.barangayPsgc === HOME.psgc)).toHaveLength(2);
  });

  it("carries both ends of the link on each pin", () => {
    const [pin] = computeCasePins(
      [
        {
          barangay_psgc: AWAY.psgc,
          facility_id: "clinic-1",
          address: "12 Mabini St.",
          residence_lat: 7.05,
          residence_lon: 125.6,
        },
      ],
      [CLINIC]
    );
    expect(pin).toMatchObject({
      lat: 7.05,
      lon: 125.6,
      exact: true,
      address: "12 Mabini St.",
      barangayPsgc: AWAY.psgc,
      barangayName: AWAY.name,
      facilityId: "clinic-1",
      facilityName: CLINIC.name,
      facilityLat: CLINIC.lat,
      facilityLon: CLINIC.lon,
    });
  });

  it("leaves the facility end null when the case is not yet registered", () => {
    const [pin] = computeCasePins(
      [{ barangay_psgc: HOME.psgc, facility_id: null }],
      [CLINIC]
    );
    expect(pin.facilityId).toBeNull();
    expect(pin.facilityLat).toBeNull();
    // Still positioned, so the barangay drill-down can draw a dot with no line.
    expect(pin.lat).toBe(HOME.lat);
  });

  it("traces each case to the best available point: household, jitter, centroid", () => {
    const flows = computeFacilityFlows(
      [
        {
          barangay_psgc: HOME.psgc,
          facility_id: "clinic-1",
          address: "123 Mabini St.",
          residence_lat: 7.1,
          residence_lon: 125.6,
          jitter_lat: 7.2,
          jitter_lon: 125.5,
        },
        {
          barangay_psgc: HOME.psgc,
          facility_id: "clinic-1",
          jitter_lat: 7.2,
          jitter_lon: 125.5,
        },
        { barangay_psgc: HOME.psgc, facility_id: "clinic-1" },
      ],
      [CLINIC]
    );
    const points = flows[0].points;
    expect(points).toHaveLength(3);
    // Geocoded household wins over the jittered point.
    expect(points[0]).toMatchObject({
      lat: 7.1,
      lon: 125.6,
      exact: true,
      address: "123 Mabini St.",
      barangayName: HOME.name,
    });
    // No household → the jittered barangay-level point, flagged approximate.
    expect(points[1]).toMatchObject({ lat: 7.2, lon: 125.5, exact: false });
    // No coordinates at all → the barangay centroid.
    expect(points[2]).toMatchObject({
      lat: HOME.lat,
      lon: HOME.lon,
      exact: false,
      address: null,
    });
  });
});
