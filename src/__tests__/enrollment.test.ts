import { describe, expect, it } from "vitest";
import {
  claimState,
  enrollmentState,
  type EnrollmentInput,
} from "../lib/enrollment";

/**
 * A confirmed, named, untreated TB case — the one shape that is enrollable.
 * Each test below breaks exactly one thing about it.
 */
function enrollable(overrides: Partial<EnrollmentInput> = {}): EnrollmentInput {
  return {
    disease: "tb",
    diagnosis_status: "bacteriologically_confirmed",
    treatment_outcome: "ongoing",
    enrolled_at: null,
    patient_profile_id: null,
    given_name: "Maria",
    family_name: "Dela Cruz",
    ...overrides,
  };
}

describe("enrollmentState", () => {
  it("allows a confirmed, named, untreated TB case", () => {
    expect(enrollmentState(enrollable())).toEqual({
      status: "not_enrolled",
      canEnroll: true,
      blocker: null,
    });
  });

  it("allows a clinically diagnosed case, not only a bacteriological one", () => {
    const state = enrollmentState(
      enrollable({ diagnosis_status: "clinically_diagnosed" })
    );
    expect(state.canEnroll).toBe(true);
  });

  // The rule the panel exists to enforce: presumptive is the case-finding
  // yield, not a patient. Enrolling one would put a six-month course against
  // someone who may be sent home well, and inflate every adherence figure.
  it("refuses a presumptive case", () => {
    const state = enrollmentState(
      enrollable({ diagnosis_status: "presumptive" })
    );
    expect(state).toEqual({
      status: "awaiting_diagnosis",
      canEnroll: false,
      blocker: "not_diagnosed",
    });
  });

  it("refuses a case with no diagnosis recorded at all", () => {
    const state = enrollmentState(enrollable({ diagnosis_status: null }));
    expect(state.canEnroll).toBe(false);
    expect(state.blocker).toBe("not_diagnosed");
  });

  it("refuses a non-TB case — only TB runs a DOTS programme", () => {
    for (const disease of ["pneumonia", "covid19", "asthma"]) {
      const state = enrollmentState(enrollable({ disease }));
      expect(state.canEnroll, disease).toBe(false);
      expect(state.blocker, disease).toBe("not_tb");
    }
  });

  it("reports an already-enrolled case as enrolled, by either marker", () => {
    expect(
      enrollmentState(enrollable({ enrolled_at: "2026-08-10T00:00:00Z" }))
    ).toEqual({
      status: "enrolled",
      canEnroll: false,
      blocker: "already_enrolled",
    });

    // The account may exist before enrolled_at was backfilled; either one is
    // enough to mean "this person already has a treatment record".
    expect(
      enrollmentState(enrollable({ patient_profile_id: "some-uuid" })).status
    ).toBe("enrolled");
  });

  it("refuses a case whose treatment has closed", () => {
    for (const outcome of ["cured", "completed", "failed", "died", "lost_to_followup"]) {
      const state = enrollmentState(
        enrollable({ treatment_outcome: outcome })
      );
      expect(state.canEnroll, outcome).toBe(false);
      expect(state.blocker, outcome).toBe("treatment_closed");
    }
  });

  // Imported and historical rows are pseudonymous — there is nothing for the
  // nurse to verify the person against, which is the whole point of the panel.
  it("refuses a case with no name, including whitespace-only names", () => {
    expect(enrollmentState(enrollable({ given_name: null })).blocker).toBe(
      "name_missing"
    );
    expect(enrollmentState(enrollable({ family_name: null })).blocker).toBe(
      "name_missing"
    );
    expect(enrollmentState(enrollable({ given_name: "   " })).blocker).toBe(
      "name_missing"
    );
  });

  it("checks enrollment before diagnosis, so an enrolled case never reads as presumptive", () => {
    const state = enrollmentState(
      enrollable({
        enrolled_at: "2026-08-10T00:00:00Z",
        diagnosis_status: "presumptive",
      })
    );
    expect(state.status).toBe("enrolled");
  });
});

describe("claimState", () => {
  const now = new Date("2026-08-10T12:00:00Z");

  it("is active before expiry and unused", () => {
    expect(
      claimState(
        { used_at: null, expires_at: "2026-08-17T12:00:00Z" },
        now
      )
    ).toBe("active");
  });

  it("is used once redeemed, even if it has not expired", () => {
    expect(
      claimState(
        { used_at: "2026-08-10T09:00:00Z", expires_at: "2026-08-17T12:00:00Z" },
        now
      )
    ).toBe("used");
  });

  it("is expired past its window", () => {
    expect(
      claimState(
        { used_at: null, expires_at: "2026-08-09T12:00:00Z" },
        now
      )
    ).toBe("expired");
  });

  // A code that lapses exactly now is spent — matches the SQL's
  // `expires_at > now()`, which is strict.
  it("treats the exact expiry instant as expired", () => {
    expect(
      claimState({ used_at: null, expires_at: now.toISOString() }, now)
    ).toBe("expired");
  });
});
