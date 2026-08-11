import { describe, it, expect } from "vitest";
import {
  buildHotspotAlerts,
  hotspotCoversBarangay,
  isAlertingSeverity,
  type AlertRecipient,
} from "../lib/hotspotAlerts";

// The case the panel raised: one cluster, two barangays of residence. Calinan
// holds 12 of the cases and is therefore the modal barangay; Baguio holds 9.
const CALINAN = 112402005;
const BAGUIO = 112402004;
const TORIL = 112402039;

const STRADDLING = {
  id: "hs-1",
  severity: "high",
  barangay_psgc: CALINAN,
  barangay_psgcs: [CALINAN, BAGUIO],
};

const STAFF: AlertRecipient[] = [
  { id: "coord", role: "tb_coordinator", barangay_psgc: null },
  { id: "admin", role: "system_admin", barangay_psgc: null },
  { id: "calinan-hw", role: "health_worker", barangay_psgc: CALINAN },
  { id: "baguio-hw", role: "health_worker", barangay_psgc: BAGUIO },
  { id: "toril-ba", role: "barangay_admin", barangay_psgc: TORIL },
  { id: "unassigned", role: "health_worker", barangay_psgc: null },
];

function recipientsFor(hotspotId: string, alerts: { hotspot_id: string; recipient_id: string }[]) {
  return alerts.filter((a) => a.hotspot_id === hotspotId).map((a) => a.recipient_id).sort();
}

describe("hotspotCoversBarangay", () => {
  it("covers every barangay of residence in the cluster, not just the modal one", () => {
    expect(hotspotCoversBarangay(STRADDLING, CALINAN)).toBe(true);
    expect(hotspotCoversBarangay(STRADDLING, BAGUIO)).toBe(true);
    expect(hotspotCoversBarangay(STRADDLING, TORIL)).toBe(false);
  });

  it("falls back to the modal barangay for rows recorded before membership existed", () => {
    const legacy = { id: "old", severity: "high", barangay_psgc: CALINAN };
    expect(hotspotCoversBarangay(legacy, CALINAN)).toBe(true);
    expect(hotspotCoversBarangay(legacy, BAGUIO)).toBe(false);

    const emptyArray = { ...legacy, barangay_psgcs: [] };
    expect(hotspotCoversBarangay(emptyArray, CALINAN)).toBe(true);
  });
});

describe("buildHotspotAlerts", () => {
  it("alerts both barangays whose residents are in a straddling cluster", () => {
    const alerts = buildHotspotAlerts([STRADDLING], STAFF);
    expect(recipientsFor("hs-1", alerts)).toEqual([
      "admin",
      "baguio-hw",
      "calinan-hw",
      "coord",
    ]);
  });

  it("does not alert a barangay with no resident in the cluster", () => {
    const alerts = buildHotspotAlerts([STRADDLING], STAFF);
    expect(recipientsFor("hs-1", alerts)).not.toContain("toril-ba");
  });

  it("skips area staff with no assigned barangay, who have no residents to trace", () => {
    const alerts = buildHotspotAlerts([STRADDLING], STAFF);
    expect(recipientsFor("hs-1", alerts)).not.toContain("unassigned");
  });

  it("only raises alerts for high and urgent clusters", () => {
    expect(isAlertingSeverity("urgent")).toBe(true);
    expect(isAlertingSeverity("high")).toBe(true);
    expect(isAlertingSeverity("moderate")).toBe(false);
    expect(isAlertingSeverity("watch")).toBe(false);

    const quiet = buildHotspotAlerts(
      [{ ...STRADDLING, id: "hs-quiet", severity: "moderate" }],
      STAFF
    );
    expect(quiet).toEqual([]);
  });

  it("gives citywide roles every cluster regardless of geography", () => {
    const elsewhere = {
      id: "hs-2",
      severity: "urgent",
      barangay_psgc: TORIL,
      barangay_psgcs: [TORIL],
    };
    const alerts = buildHotspotAlerts([STRADDLING, elsewhere], STAFF);
    expect(recipientsFor("hs-2", alerts)).toEqual(["admin", "coord", "toril-ba"]);
  });
});
