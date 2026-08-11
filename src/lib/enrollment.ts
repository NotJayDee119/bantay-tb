/**
 * Who may be enrolled in treatment, and what a claim slip is currently worth.
 *
 * The server owns both rules — `case_enrollable()` and the guards inside
 * `redeem_patient_claim()` are what actually decide. This module is the client
 * mirror that drives button visibility and status chips, kept deliberately
 * small so the two can be compared line for line.
 *
 * The reason strings match the SQL exactly. If one side gains a case, the
 * other has to gain it too.
 */

export type EnrollmentStatus =
  | "enrolled"
  | "awaiting_diagnosis"
  | "treatment_closed"
  | "not_enrolled";

export type EnrollmentBlocker =
  | "already_enrolled"
  | "not_diagnosed"
  | "treatment_closed"
  | "name_missing"
  | "not_tb";

/** The subset of a case row that decides enrollability. */
export interface EnrollmentInput {
  disease: string;
  diagnosis_status: string | null;
  treatment_outcome: string;
  enrolled_at: string | null;
  patient_profile_id: string | null;
  given_name: string | null;
  family_name: string | null;
}

export interface EnrollmentState {
  status: EnrollmentStatus;
  canEnroll: boolean;
  /** Why not, when `canEnroll` is false and the case isn't already enrolled. */
  blocker: EnrollmentBlocker | null;
}

export function enrollmentState(row: EnrollmentInput): EnrollmentState {
  if (row.enrolled_at !== null || row.patient_profile_id !== null) {
    return { status: "enrolled", canEnroll: false, blocker: "already_enrolled" };
  }

  // Only TB runs a DOTS treatment programme. The register carries pneumonia,
  // COVID and asthma rows for surveillance, and none of them get enrolled.
  if (row.disease !== "tb") {
    return { status: "not_enrolled", canEnroll: false, blocker: "not_tb" };
  }

  // A presumptive is the case-finding yield: symptomatic, not yet diagnosed,
  // and quite possibly not a TB patient at all. Enrolling one would put a
  // six-month course against someone who may be sent home well.
  if (
    row.diagnosis_status === null ||
    row.diagnosis_status === "presumptive"
  ) {
    return {
      status: "awaiting_diagnosis",
      canEnroll: false,
      blocker: "not_diagnosed",
    };
  }

  if (row.treatment_outcome !== "ongoing") {
    return {
      status: "treatment_closed",
      canEnroll: false,
      blocker: "treatment_closed",
    };
  }

  // Imported and historical rows are pseudonymous. There is nothing for the
  // nurse to verify against, so the name is filled in before enrolling.
  if (
    !(row.given_name ?? "").trim() ||
    !(row.family_name ?? "").trim()
  ) {
    return {
      status: "not_enrolled",
      canEnroll: false,
      blocker: "name_missing",
    };
  }

  return { status: "not_enrolled", canEnroll: true, blocker: null };
}

export type ClaimState = "active" | "used" | "expired";

export function claimState(
  claim: { used_at: string | null; expires_at: string },
  now: Date = new Date()
): ClaimState {
  if (claim.used_at) return "used";
  if (new Date(claim.expires_at).getTime() <= now.getTime()) return "expired";
  return "active";
}
