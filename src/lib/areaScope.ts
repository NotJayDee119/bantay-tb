import barangays from "../data/barangays.json";
import type { AppRole } from "./supabase";

// Mirrors the RLS split in 20261010000000_scope_by_role_and_own_facility.sql.
// The scope follows the role, and each role gets the axis its job runs on:
//
//   tb_coordinator / system_admin : citywide, both axes
//   barangay_admin                : residents of its barangay, and only those
//   health_worker                 : those residents PLUS every case registered
//                                   at its own DOTS facility, wherever the
//                                   patient lives
//
// Only health_worker reads across barangay lines, and only through its own
// facility — a clinic must reach the patients it registered, a barangay
// dashboard must not reach someone else's residents.
const AREA_SCOPED_ROLES: ReadonlySet<AppRole> = new Set<AppRole>([
  "barangay_admin",
  "health_worker",
]);

/** Roles that additionally read their own facility's register. */
const CLINIC_SCOPED_ROLES: ReadonlySet<AppRole> = new Set<AppRole>([
  "health_worker",
]);

export interface ScopedProfile {
  role: AppRole;
  barangay_psgc: number | null;
  facility_id?: string | null;
}

export interface AreaScope {
  /** True when this account is limited to an area and/or a single facility. */
  scoped: boolean;
  /** Assigned barangay PSGC — null for citywide roles or unassigned staff. */
  psgc: number | null;
  /** Display name for the assigned barangay. */
  name: string | null;
  /**
   * The DOTS facility this account is posted to. Null unless the role reads
   * by facility (health_worker) and one has actually been assigned.
   */
  facilityId: string | null;
  /**
   * True when this account sees cases registered at its own facility on top of
   * its residents. Pages use it to decide whether a row from another barangay
   * is expected — for a barangay_admin it never is.
   */
  clinicScoped: boolean;
  /**
   * Scoped but with nothing assigned to scope *to*. RLS fails closed for these
   * accounts, so they legitimately see zero cases until a system_admin sets
   * their area (and facility) — pages should say so rather than render a bare
   * empty state. A health worker with a facility but no barangay is NOT
   * unassigned: their clinic's register still reads.
   */
  unassigned: boolean;
}

const CITYWIDE: AreaScope = {
  scoped: false,
  psgc: null,
  name: null,
  facilityId: null,
  clinicScoped: false,
  unassigned: false,
};

export function areaScopeFor(profile: ScopedProfile | null): AreaScope {
  if (!profile || !AREA_SCOPED_ROLES.has(profile.role)) return CITYWIDE;

  const psgc = profile.barangay_psgc ?? null;
  const name =
    psgc === null
      ? null
      : ((barangays as { psgc: number; name: string }[]).find(
          (b) => b.psgc === psgc
        )?.name ?? null);

  const clinicScoped = CLINIC_SCOPED_ROLES.has(profile.role);
  const facilityId = clinicScoped ? (profile.facility_id ?? null) : null;

  return {
    scoped: true,
    psgc,
    name,
    facilityId,
    clinicScoped,
    unassigned: psgc === null && facilityId === null,
  };
}

/**
 * Suffix for page subtitles, e.g. " · Assigned area: Mintal."
 *
 * `facilityName` is optional because the name lives in `dots_centers`, not in
 * the profile — pages that already load the facility list can pass it, and the
 * rest fall back to naming the area alone.
 */
export function areaSuffix(
  scope: AreaScope,
  facilityName?: string | null
): string {
  if (!scope.scoped) return "";

  const parts: string[] = [];
  if (scope.name) parts.push(`Assigned area: ${scope.name}`);
  if (scope.facilityId) {
    parts.push(facilityName ? `Facility: ${facilityName}` : "Own facility");
  }

  if (parts.length === 0) {
    return scope.clinicScoped
      ? " · No area or facility assigned yet."
      : " · No area assigned yet.";
  }
  return ` · ${parts.join(" · ")}.`;
}
