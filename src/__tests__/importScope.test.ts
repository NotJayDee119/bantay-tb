import { describe, it, expect } from "vitest";
import {
  canBulkImport,
  explainImportBlocker,
  scopeImport,
  type ImportProfile,
} from "../lib/importScope";
import barangays from "../data/barangays.json";
import type { Database } from "../lib/database.types";

type CaseInsert = Database["public"]["Tables"]["cases"]["Insert"];

const ALL = barangays as { psgc: number; name: string; lat: number; lon: number }[];
const HOME = ALL[0];
const AWAY = ALL[1];
const FACILITY = "11111111-1111-1111-1111-111111111111";

function row(psgc: number, extra: Partial<CaseInsert> = {}): CaseInsert {
  const b = ALL.find((x) => x.psgc === psgc)!;
  return {
    barangay_psgc: psgc,
    disease: "tb",
    sex: "unknown",
    treatment_outcome: "ongoing",
    jitter_lat: b.lat,
    jitter_lon: b.lon,
    source: "bulk_import",
    ...extra,
  } as CaseInsert;
}

const coordinator: ImportProfile = {
  role: "tb_coordinator",
  barangay_psgc: null,
};
const bhwWithClinic: ImportProfile = {
  role: "health_worker",
  barangay_psgc: HOME.psgc,
  facility_id: FACILITY,
};
const bhwNoClinic: ImportProfile = {
  role: "health_worker",
  barangay_psgc: HOME.psgc,
  facility_id: null,
};
const brgyAdmin: ImportProfile = {
  role: "barangay_admin",
  barangay_psgc: HOME.psgc,
};

describe("canBulkImport", () => {
  it("admits every staff role and no one else", () => {
    for (const role of [
      "tb_coordinator",
      "system_admin",
      "barangay_admin",
      "health_worker",
    ] as const) {
      expect(canBulkImport({ role, barangay_psgc: HOME.psgc })).toBe(true);
    }
    expect(canBulkImport({ role: "patient", barangay_psgc: HOME.psgc })).toBe(
      false
    );
    expect(canBulkImport(null)).toBe(false);
  });
});

describe("scopeImport — citywide roles", () => {
  it("passes rows through untouched and keeps replace-all", () => {
    const rows = [row(HOME.psgc), row(AWAY.psgc)];
    const scoped = scopeImport(coordinator, rows);
    expect(scoped.blocker).toBeNull();
    expect(scoped.mode).toBe("replace_all");
    expect(scoped.inserts).toEqual(rows);
    expect(scoped.relocations).toEqual([]);
    expect(scoped.stampedFacility).toBeNull();
  });
});

describe("scopeImport — health worker with a facility", () => {
  it("stamps the clinic and leaves residence where the sheet put it", () => {
    const scoped = scopeImport(bhwWithClinic, [row(HOME.psgc), row(AWAY.psgc)]);
    expect(scoped.blocker).toBeNull();
    expect(scoped.stampedFacility).toBe(FACILITY);
    expect(scoped.inserts.every((r) => r.facility_id === FACILITY)).toBe(true);
    // The Calinan resident treated at the Mintal clinic still maps to Calinan.
    expect(scoped.inserts.map((r) => r.barangay_psgc)).toEqual([
      HOME.psgc,
      AWAY.psgc,
    ]);
    expect(scoped.relocations).toEqual([]);
    expect(scoped.forcedTo).toBeNull();
  });

  it("never deletes — a field upload adds to the register", () => {
    expect(scopeImport(bhwWithClinic, [row(HOME.psgc)]).mode).toBe("append");
    expect(scopeImport(brgyAdmin, [row(HOME.psgc)]).mode).toBe("append");
  });

  it("overwrites a facility the sheet tried to claim for someone else", () => {
    const other = "22222222-2222-2222-2222-222222222222";
    const scoped = scopeImport(bhwWithClinic, [
      row(HOME.psgc, { facility_id: other }),
    ]);
    expect(scoped.inserts[0].facility_id).toBe(FACILITY);
  });
});

describe("scopeImport — residence-scoped accounts", () => {
  it("files every row under the uploader's own barangay", () => {
    const scoped = scopeImport(brgyAdmin, [row(HOME.psgc), row(AWAY.psgc)]);
    expect(scoped.forcedTo).toEqual({ psgc: HOME.psgc, name: HOME.name });
    expect(scoped.inserts.every((r) => r.barangay_psgc === HOME.psgc)).toBe(
      true
    );
    expect(scoped.stampedFacility).toBeNull();
  });

  it("reports what it moved, so the relocation is visible before import", () => {
    const scoped = scopeImport(brgyAdmin, [
      row(AWAY.psgc),
      row(AWAY.psgc),
      row(ALL[2].psgc),
      row(HOME.psgc),
    ]);
    expect(scoped.relocations).toEqual([
      { from: AWAY.name, count: 2 },
      { from: ALL[2].name, count: 1 },
    ]);
  });

  it("re-pins a moved row onto its new barangay, not the one it came from", () => {
    const scoped = scopeImport(brgyAdmin, [row(AWAY.psgc)]);
    const moved = scoped.inserts[0];
    // Within the ~75 m scatter of home, and nowhere near the sheet's barangay.
    expect(Math.abs(moved.jitter_lat! - HOME.lat)).toBeLessThan(0.002);
    expect(Math.abs(moved.jitter_lon! - HOME.lon)).toBeLessThan(0.002);
    expect(Math.abs(moved.jitter_lat! - AWAY.lat)).toBeGreaterThan(0.002);
  });

  it("drops a street address that belonged to the barangay it moved away from", () => {
    const scoped = scopeImport(brgyAdmin, [
      row(AWAY.psgc, {
        address: "12 Somewhere St",
        residence_lat: AWAY.lat,
        residence_lon: AWAY.lon,
      }),
    ]);
    expect(scoped.inserts[0].address).toBeNull();
    expect(scoped.inserts[0].residence_lat).toBeNull();
    expect(scoped.inserts[0].residence_lon).toBeNull();
  });

  it("leaves an in-area row's address alone", () => {
    const scoped = scopeImport(brgyAdmin, [
      row(HOME.psgc, { address: "12 Somewhere St" }),
    ]);
    expect(scoped.inserts[0].address).toBe("12 Somewhere St");
    expect(scoped.relocations).toEqual([]);
  });

  it("treats a facility-less health worker as residence-scoped", () => {
    const scoped = scopeImport(bhwNoClinic, [row(AWAY.psgc)]);
    expect(scoped.blocker).toBeNull();
    expect(scoped.stampedFacility).toBeNull();
    expect(scoped.forcedTo).toEqual({ psgc: HOME.psgc, name: HOME.name });
    expect(scoped.inserts[0].barangay_psgc).toBe(HOME.psgc);
  });
});

describe("scopeImport — blocked accounts", () => {
  it("blocks a scoped account with neither barangay nor facility", () => {
    for (const role of ["barangay_admin", "health_worker"] as const) {
      const scoped = scopeImport(
        { role, barangay_psgc: null, facility_id: null },
        [row(HOME.psgc)]
      );
      expect(scoped.blocker).toBe("unassigned");
      expect(scoped.inserts).toEqual([]);
    }
  });

  it("does not block a health worker who has a facility but no barangay", () => {
    const scoped = scopeImport(
      { role: "health_worker", barangay_psgc: null, facility_id: FACILITY },
      [row(AWAY.psgc)]
    );
    expect(scoped.blocker).toBeNull();
    expect(scoped.inserts[0].facility_id).toBe(FACILITY);
  });

  it("blocks patients and unauthenticated callers", () => {
    expect(
      scopeImport({ role: "patient", barangay_psgc: HOME.psgc }, [
        row(HOME.psgc),
      ]).blocker
    ).toBe("not_permitted");
    expect(scopeImport(null, [row(HOME.psgc)]).blocker).toBe("not_permitted");
  });

  it("explains every blocker and stays quiet when there is none", () => {
    expect(explainImportBlocker("unassigned")).toMatch(/no assigned area/i);
    expect(explainImportBlocker("not_permitted")).toMatch(/not allowed/i);
    expect(explainImportBlocker(null)).toBeNull();
  });
});
