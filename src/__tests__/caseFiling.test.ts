import { describe, it, expect } from "vitest";
import {
  barangayLockFor,
  checkCaseFiling,
  explainCaseError,
} from "../lib/caseFiling";

// The two barangays from the bug report: the account covers Mintal, the
// patient lives in Ma-a.
const MINTAL = 112402079;
const MAA = 112402061;
const CLINIC = "8f4a1e89-8018-4a6b-967d-22baca23b4b7";

describe("checkCaseFiling — health_worker", () => {
  it("blocks an out-of-area case when the account has no facility", () => {
    // The reported bug. Residence doesn't match and there is no clinic to
    // stamp, so RLS refuses — and the form has to say so first.
    const check = checkCaseFiling(
      { role: "health_worker", barangay_psgc: MINTAL, facility_id: null },
      MAA,
      null
    );
    expect(check.allowed).toBe(false);
    expect(check.blocker).toBe("no_facility");
  });

  it("allows its own residents even with no facility", () => {
    expect(
      checkCaseFiling(
        { role: "health_worker", barangay_psgc: MINTAL, facility_id: null },
        MINTAL,
        null
      ).allowed
    ).toBe(true);
  });

  it("allows any barangay once the case is stamped with its own clinic", () => {
    // The whole point of the facility branch: a Mintal clinic registering a
    // Ma-a walk-in is the most ordinary event in a DOTS centre.
    expect(
      checkCaseFiling(
        { role: "health_worker", barangay_psgc: MINTAL, facility_id: CLINIC },
        MAA,
        CLINIC
      ).allowed
    ).toBe(true);
  });

  it("does not accept a case stamped with somebody else's clinic", () => {
    const check = checkCaseFiling(
      { role: "health_worker", barangay_psgc: MINTAL, facility_id: CLINIC },
      MAA,
      "a-different-clinic"
    );
    expect(check.allowed).toBe(false);
    expect(check.blocker).toBe("no_facility");
  });

  it("is not blocked before a barangay has been picked", () => {
    expect(
      checkCaseFiling(
        { role: "health_worker", barangay_psgc: MINTAL, facility_id: null },
        null,
        null
      ).allowed
    ).toBe(true);
  });

  it("blocks an account with neither barangay nor facility", () => {
    const check = checkCaseFiling(
      { role: "health_worker", barangay_psgc: null, facility_id: null },
      MAA,
      null
    );
    expect(check.allowed).toBe(false);
    expect(check.blocker).toBe("unassigned");
  });
});

describe("checkCaseFiling — barangay_admin", () => {
  it("files its own residents", () => {
    expect(
      checkCaseFiling(
        { role: "barangay_admin", barangay_psgc: MINTAL },
        MINTAL,
        null
      ).allowed
    ).toBe(true);
  });

  it("cannot file outside its barangay, facility or not", () => {
    // A barangay dashboard has no facility branch in the policy, so even a
    // stamped clinic doesn't buy it reach across barangay lines.
    const check = checkCaseFiling(
      { role: "barangay_admin", barangay_psgc: MINTAL, facility_id: CLINIC },
      MAA,
      CLINIC
    );
    expect(check.allowed).toBe(false);
    expect(check.blocker).toBe("outside_area");
  });
});

describe("checkCaseFiling — citywide roles", () => {
  it.each(["tb_coordinator", "system_admin"] as const)(
    "%s files any barangay",
    (role) => {
      expect(
        checkCaseFiling({ role, barangay_psgc: null }, MAA, null).allowed
      ).toBe(true);
    }
  );
});

describe("checkCaseFiling — loading", () => {
  it("does not block while the profile is still null", () => {
    expect(checkCaseFiling(null, MAA, null).allowed).toBe(true);
  });
});

describe("barangayLockFor", () => {
  it("locks a barangay_admin to its own area, permanently", () => {
    expect(
      barangayLockFor({ role: "barangay_admin", barangay_psgc: MINTAL })
    ).toBe("area_role");
  });

  it("locks a health worker who has no facility yet", () => {
    expect(
      barangayLockFor({
        role: "health_worker",
        barangay_psgc: MINTAL,
        facility_id: null,
      })
    ).toBe("awaiting_facility");
  });

  it("leaves the full list to a health worker with a facility", () => {
    // Registering a walk-in from another barangay is the ordinary case for a
    // clinic — locking the field would break the thing the policy exists for.
    expect(
      barangayLockFor({
        role: "health_worker",
        barangay_psgc: MINTAL,
        facility_id: CLINIC,
      })
    ).toBeNull();
  });

  it.each(["tb_coordinator", "system_admin"] as const)(
    "leaves %s unlocked",
    (role) => {
      expect(barangayLockFor({ role, barangay_psgc: null })).toBeNull();
    }
  );

  it("does not lock an account with no barangay to pin to", () => {
    expect(
      barangayLockFor({
        role: "health_worker",
        barangay_psgc: null,
        facility_id: null,
      })
    ).toBeNull();
  });

  it("does not lock while the profile is still loading", () => {
    expect(barangayLockFor(null)).toBeNull();
  });
});

describe("lock and filing agree", () => {
  it("a locked account can always file its own area", () => {
    // The lock is only safe if the one value it leaves is one RLS accepts.
    for (const profile of [
      { role: "barangay_admin" as const, barangay_psgc: MINTAL },
      {
        role: "health_worker" as const,
        barangay_psgc: MINTAL,
        facility_id: null,
      },
    ]) {
      expect(barangayLockFor(profile)).not.toBeNull();
      expect(checkCaseFiling(profile, MINTAL, null).allowed).toBe(true);
    }
  });
});

describe("explainCaseError", () => {
  it("replaces the raw RLS string with something actionable", () => {
    const msg = explainCaseError({
      code: "42501",
      message: 'new row violates row-level security policy for table "cases"',
    });
    expect(msg).not.toMatch(/row-level security/i);
    expect(msg).toMatch(/DOTS facility/);
  });

  it("catches the RLS wording even without the code", () => {
    const msg = explainCaseError({
      message: 'new row violates row-level security policy for table "cases"',
    });
    expect(msg).not.toMatch(/row-level security/i);
  });

  it("passes other messages through unchanged", () => {
    expect(explainCaseError({ code: "08006", message: "connection failure" }))
      .toBe("connection failure");
  });
});
