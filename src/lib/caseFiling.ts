import type { AppRole } from "./supabase";

/**
 * Can this account file this case?
 *
 * A client-side mirror of the "cases staff insert" policy
 * (20261015000000_health_worker_case_intake.sql). RLS remains the boundary —
 * this exists only so the form can say *why* before someone fills it in, and
 * not after they have typed a name, an address and geocoded a pin.
 *
 * The bug it was written for: a health_worker assigned to Mintal but with no
 * facility on their profile picked Ma-a as the barangay of residence. The
 * residence branch failed (Ma-a ≠ Mintal) and the facility branch failed
 * because `null = null` is null in SQL, not true. Postgres answered with
 * `new row violates row-level security policy for table "cases"`, which tells
 * a nurse nothing at all.
 *
 * Keep in step with the SQL. If the policy changes and this doesn't, the form
 * will block work the database would have accepted.
 */

/** Why the case cannot be filed, or null when it can. */
export type FilingBlocker =
  /** Health centre account with no DOTS facility, filing outside its area. */
  | "no_facility"
  /** Barangay dashboard filing outside the barangay it covers. */
  | "outside_area"
  /** Scoped account with no barangay assigned and no facility to fall back on. */
  | "unassigned";

export interface FilingProfile {
  role: AppRole;
  barangay_psgc: number | null;
  facility_id?: string | null;
}

export interface FilingCheck {
  allowed: boolean;
  blocker: FilingBlocker | null;
}

const ALLOWED: FilingCheck = { allowed: true, blocker: null };

const CITYWIDE_ROLES: ReadonlySet<AppRole> = new Set<AppRole>([
  "tb_coordinator",
  "system_admin",
]);

/**
 * @param profile        The signed-in staff account.
 * @param targetPsgc     Barangay of residence chosen on the form. Null while
 *                       the field is still empty, which is not yet an error.
 * @param stampedFacility The facility the insert will carry. For a health
 *                       worker this is their own clinic — the form has no
 *                       other value to offer, and RLS accepts no other.
 */
export function checkCaseFiling(
  profile: FilingProfile | null,
  targetPsgc: number | null,
  stampedFacility: string | null
): FilingCheck {
  // No profile yet — the form is still loading. Don't block on a guess.
  if (!profile) return ALLOWED;
  if (CITYWIDE_ROLES.has(profile.role)) return ALLOWED;

  const own = profile.barangay_psgc ?? null;
  const facility = profile.facility_id ?? null;

  if (profile.role === "health_worker") {
    // The facility branch stands on its own: a clinic may register a walk-in
    // from anywhere, so a health worker with a facility is never blocked here
    // — not even before they have picked a barangay.
    if (facility !== null && stampedFacility === facility) return ALLOWED;
    if (own === null) return { allowed: false, blocker: "unassigned" };
    if (targetPsgc === null) return ALLOWED;
    if (targetPsgc === own) return ALLOWED;
    // Residence doesn't match and there is no clinic to stamp. This is the
    // Mintal case, and it is an account-setup problem, not a data-entry one.
    return { allowed: false, blocker: "no_facility" };
  }

  if (profile.role === "barangay_admin") {
    if (own === null) return { allowed: false, blocker: "unassigned" };
    if (targetPsgc === null) return ALLOWED;
    return targetPsgc === own
      ? ALLOWED
      : { allowed: false, blocker: "outside_area" };
  }

  // patient, or any role added later without an insert grant.
  return { allowed: false, blocker: "unassigned" };
}

/**
 * Why the barangay-of-residence field should be shown as settled rather than
 * offered as a dropdown, or null when the account may genuinely pick any.
 *
 * The same policy read from the other direction: if only one barangay can ever
 * be accepted, offering 182 of them is the form inviting a choice the database
 * will refuse. The two locks are different facts and get different copy —
 * `area_role` is permanent, `awaiting_facility` lifts as soon as a system_admin
 * links the clinic.
 */
export type BarangayLock = "area_role" | "awaiting_facility";

export function barangayLockFor(
  profile: FilingProfile | null
): BarangayLock | null {
  // Nothing to pin to. The account is blocked outright, which the banner
  // covers; locking the field to "No area assigned" would just be a dead end.
  if (!profile || profile.barangay_psgc === null) return null;
  if (profile.role === "barangay_admin") return "area_role";
  if (profile.role === "health_worker" && !profile.facility_id)
    return "awaiting_facility";
  // Citywide roles, and a health worker whose clinic can register anyone.
  return null;
}

/**
 * Postgres speaks in constraint names; a health worker needs a next action.
 * `42501` is insufficient_privilege, which is what an RLS refusal surfaces as
 * through PostgREST.
 */
export function explainCaseError(
  error: { code?: string; message?: string } | null
): string {
  if (!error) return "Something went wrong. Please try again.";
  const message = error.message ?? "";
  const isRls =
    error.code === "42501" || /row-level security/i.test(message);
  if (isRls) {
    return (
      "You're not allowed to record a case for this barangay. " +
      "Ask a system administrator to assign your DOTS facility, then try again."
    );
  }
  if (error.code === "23505") {
    return "This case looks like it has already been recorded.";
  }
  return message || "Could not save the case. Please try again.";
}
