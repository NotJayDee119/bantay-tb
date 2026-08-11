import { describe, it, expect } from "vitest";
import { areaScopeFor, areaSuffix } from "../lib/areaScope";
import barangays from "../data/barangays.json";

const SAMPLE = (barangays as { psgc: number; name: string }[])[0];
const FACILITY = "11111111-1111-1111-1111-111111111111";

describe("areaScopeFor", () => {
  it("scopes barangay_admin and health_worker to their assigned area", () => {
    for (const role of ["barangay_admin", "health_worker"] as const) {
      const scope = areaScopeFor({ role, barangay_psgc: SAMPLE.psgc });
      expect(scope.scoped).toBe(true);
      expect(scope.psgc).toBe(SAMPLE.psgc);
      expect(scope.name).toBe(SAMPLE.name);
      expect(scope.unassigned).toBe(false);
    }
  });

  it("leaves tb_coordinator and system_admin citywide even with a home barangay", () => {
    for (const role of ["tb_coordinator", "system_admin"] as const) {
      const scope = areaScopeFor({ role, barangay_psgc: SAMPLE.psgc });
      expect(scope.scoped).toBe(false);
      // psgc must stay null so pages don't accidentally filter citywide views.
      expect(scope.psgc).toBeNull();
    }
  });

  it("treats a missing profile as citywide-but-inert", () => {
    const scope = areaScopeFor(null);
    expect(scope.scoped).toBe(false);
    expect(scope.psgc).toBeNull();
  });

  it("does not scope patients, who are governed by their own row policies", () => {
    const scope = areaScopeFor({ role: "patient", barangay_psgc: SAMPLE.psgc });
    expect(scope.scoped).toBe(false);
  });

  // ── The role split (20261010000000) ──────────────────────────────────────
  // A barangay dashboard covers residents. A health centre covers residents
  // AND its own facility's register, whose patients live elsewhere.

  it("gives a health_worker its own facility", () => {
    const scope = areaScopeFor({
      role: "health_worker",
      barangay_psgc: SAMPLE.psgc,
      facility_id: FACILITY,
    });
    expect(scope.clinicScoped).toBe(true);
    expect(scope.facilityId).toBe(FACILITY);
  });

  it("never gives a barangay_admin a facility, even if one is stored", () => {
    const scope = areaScopeFor({
      role: "barangay_admin",
      barangay_psgc: SAMPLE.psgc,
      facility_id: FACILITY,
    });
    expect(scope.clinicScoped).toBe(false);
    expect(scope.facilityId).toBeNull();
  });

  it("flags a barangay_admin with no area as unassigned", () => {
    const scope = areaScopeFor({ role: "barangay_admin", barangay_psgc: null });
    expect(scope.scoped).toBe(true);
    expect(scope.unassigned).toBe(true);
  });

  it("flags a health_worker with neither area nor facility as unassigned", () => {
    const scope = areaScopeFor({ role: "health_worker", barangay_psgc: null });
    expect(scope.scoped).toBe(true);
    expect(scope.unassigned).toBe(true);
    expect(scope.psgc).toBeNull();
    expect(scope.facilityId).toBeNull();
  });

  it("does not call a health_worker unassigned when only the facility is set", () => {
    // Their clinic's register still reads, so the "ask an admin" notice would
    // be wrong — they are seeing exactly what they should.
    const scope = areaScopeFor({
      role: "health_worker",
      barangay_psgc: null,
      facility_id: FACILITY,
    });
    expect(scope.unassigned).toBe(false);
    expect(scope.facilityId).toBe(FACILITY);
  });
});

describe("areaSuffix", () => {
  it("names the assigned area for scoped staff", () => {
    const scope = areaScopeFor({
      role: "barangay_admin",
      barangay_psgc: SAMPLE.psgc,
    });
    expect(areaSuffix(scope)).toBe(` · Assigned area: ${SAMPLE.name}.`);
  });

  it("names the facility alongside the area when one is known", () => {
    const scope = areaScopeFor({
      role: "health_worker",
      barangay_psgc: SAMPLE.psgc,
      facility_id: FACILITY,
    });
    expect(areaSuffix(scope, "Mintal DOTS")).toBe(
      ` · Assigned area: ${SAMPLE.name} · Facility: Mintal DOTS.`
    );
  });

  it("still says a facility is in play when its name hasn't loaded", () => {
    const scope = areaScopeFor({
      role: "health_worker",
      barangay_psgc: null,
      facility_id: FACILITY,
    });
    expect(areaSuffix(scope)).toBe(" · Own facility.");
  });

  it("says so when a scoped account has nothing assigned yet", () => {
    expect(
      areaSuffix(areaScopeFor({ role: "barangay_admin", barangay_psgc: null }))
    ).toBe(" · No area assigned yet.");
    expect(
      areaSuffix(areaScopeFor({ role: "health_worker", barangay_psgc: null }))
    ).toBe(" · No area or facility assigned yet.");
  });

  it("adds nothing for citywide roles", () => {
    expect(areaSuffix(areaScopeFor({ role: "tb_coordinator", barangay_psgc: null }))).toBe("");
  });
});
