import barangays from "../data/barangays.json";
import type { Database } from "./database.types";
import type { AppRole } from "./supabase";

type CaseInsert = Database["public"]["Tables"]["cases"]["Insert"];

/**
 * Turn the rows `parseImportFile` read out of a spreadsheet into rows the
 * signed-in account is actually allowed to file.
 *
 * Bulk import used to be a TB Coordinator errand, so the parser could trust the
 * sheet: whatever barangay a row named was the barangay it got. Now a BHW, a
 * nurse or a doctor uploads their own register, and two things follow from that.
 *
 * 1. The upload must carry the uploader's assignment, not just the sheet's.
 *    "cases staff insert" (20261015000000) accepts a scoped account's row on one
 *    of two grounds — the patient lives in the barangay you cover, or the case is
 *    filed against your own clinic. A row that satisfies neither is refused by
 *    Postgres with `new row violates row-level security policy`, which tells a
 *    nurse holding a rejected file nothing at all. Stamping here means the rows
 *    we send are rows RLS will take.
 *
 * 2. The upload must not delete. The coordinator's importer replaces the city's
 *    caseload wholesale, and RLS would happily narrow that to "everything in my
 *    barangay" for a field account — so a BHW uploading this month's list would
 *    silently erase every case their barangay had ever recorded. Field uploads
 *    append. Replace-all stays with the role whose job is the citywide picture.
 *
 * The stamp each role gets mirrors how it files a case by hand
 * (`checkCaseFiling` in caseFiling.ts — keep the two in step):
 *
 *   tb_coordinator / system_admin : nothing stamped, replace-all
 *   health_worker with a facility : facility_id = own clinic, residence kept
 *   barangay_admin                : barangay_psgc = own area, residence forced
 *   health_worker, no facility    : same as barangay_admin — its own area is
 *                                   the only ground RLS will accept
 *
 * Keeping residence for a clinic is the point of the facility branch: a Mintal
 * DOTS centre treating a Calinan resident must map that patient to Calinan,
 * where they live and where transmission happens, while still owning the record.
 */

/** Why this account cannot bulk-upload at all. */
export type ImportBlocker =
  /** Scoped account with neither a barangay nor a facility to file against. */
  | "unassigned"
  /** A role with no insert grant (patient, or anything added later). */
  | "not_permitted";

export type ImportMode = "replace_all" | "append";

export interface ImportProfile {
  role: AppRole;
  barangay_psgc: number | null;
  facility_id?: string | null;
}

/**
 * A barangay named in the sheet whose rows were re-filed under the uploader's
 * own area. Surfaced in the preview so the relocation is a decision the user
 * makes, not something the importer does behind their back.
 */
export interface Relocation {
  from: string;
  count: number;
}

export interface ScopedImport {
  /** Rows to send, stamped. Empty when `blocker` is set. */
  inserts: CaseInsert[];
  /** Whether the import deletes first, or only adds. */
  mode: ImportMode;
  /** The clinic stamped onto every row, or null when none was. */
  stampedFacility: string | null;
  /** Barangay the rows were forced to, or null when residence was kept. */
  forcedTo: { psgc: number; name: string } | null;
  /** Sheet barangays that had to be re-filed, busiest first. */
  relocations: Relocation[];
  blocker: ImportBlocker | null;
}

interface BarangayEntry {
  psgc: number;
  name: string;
  lat: number;
  lon: number;
}

const BARANGAYS = barangays as BarangayEntry[];

const CITYWIDE_ROLES: ReadonlySet<AppRole> = new Set<AppRole>([
  "tb_coordinator",
  "system_admin",
]);

const UPLOAD_ROLES: ReadonlySet<AppRole> = new Set<AppRole>([
  "tb_coordinator",
  "system_admin",
  "barangay_admin",
  "health_worker",
]);

/** Can this account reach /app/import at all? Mirrors the route guard. */
export function canBulkImport(profile: ImportProfile | null): boolean {
  return profile !== null && UPLOAD_ROLES.has(profile.role);
}

function barangayByPsgc(psgc: number): BarangayEntry | null {
  return BARANGAYS.find((b) => b.psgc === psgc) ?? null;
}

/**
 * Re-derive the map pin when a row is moved to another barangay.
 *
 * The parser scatters rows ~75 m around their barangay's centroid so markers
 * don't stack on one point. A relocated row keeps its old centroid unless we
 * recompute, which would drop a Mintal-filed case onto Calinan's town centre —
 * a pin outside the barangay it is now counted under, and a phantom cluster for
 * DBSCAN to find. `index` reproduces the parser's own scatter.
 */
function jitterFor(
  home: BarangayEntry,
  index: number
): { jitter_lat: number; jitter_lon: number } {
  const angle = ((index * 137.5) % 360) * (Math.PI / 180);
  const r = 0.0006 + (index % 7) * 0.0002;
  return {
    jitter_lat: home.lat + Math.sin(angle) * r,
    jitter_lon: home.lon + Math.cos(angle) * r,
  };
}

const EMPTY: Omit<ScopedImport, "blocker" | "mode"> = {
  inserts: [],
  stampedFacility: null,
  forcedTo: null,
  relocations: [],
};

export function scopeImport(
  profile: ImportProfile | null,
  inserts: CaseInsert[]
): ScopedImport {
  if (!profile || !UPLOAD_ROLES.has(profile.role)) {
    return { ...EMPTY, mode: "append", blocker: "not_permitted" };
  }

  // Citywide surveillance uploads the city's file as the city's file.
  if (CITYWIDE_ROLES.has(profile.role)) {
    return {
      inserts,
      mode: "replace_all",
      stampedFacility: null,
      forcedTo: null,
      relocations: [],
      blocker: null,
    };
  }

  const own = profile.barangay_psgc ?? null;
  const facility = profile.facility_id ?? null;
  const useFacility = profile.role === "health_worker" && facility !== null;

  // Nothing to file against on either axis. RLS fails closed for this account,
  // so every row would bounce; say so before the file is parsed rather than
  // after 400 rejections.
  if (!useFacility && own === null) {
    return { ...EMPTY, mode: "append", blocker: "unassigned" };
  }

  // A clinic owns the record and the patient keeps their address.
  if (useFacility) {
    return {
      inserts: inserts.map((row) => ({ ...row, facility_id: facility })),
      mode: "append",
      stampedFacility: facility,
      forcedTo: null,
      relocations: [],
      blocker: null,
    };
  }

  // Residence-scoped: every row is filed under the area this account covers.
  const home = barangayByPsgc(own as number);
  if (!home) {
    // The profile points at a barangay that isn't in the reference list —
    // an account-setup fault, and one that would produce pinless cases.
    return { ...EMPTY, mode: "append", blocker: "unassigned" };
  }

  const counts = new Map<string, number>();
  const stamped = inserts.map((row, index) => {
    if (row.barangay_psgc !== home.psgc) {
      const previous =
        row.barangay_psgc == null
          ? "Unspecified"
          : (barangayByPsgc(row.barangay_psgc)?.name ??
            `PSGC ${row.barangay_psgc}`);
      counts.set(previous, (counts.get(previous) ?? 0) + 1);
      return {
        ...row,
        barangay_psgc: home.psgc,
        ...jitterFor(home, index),
        // The sheet's street address belongs to the barangay we just moved the
        // row away from. Keeping it would caption a Mintal case with a Calinan
        // address; the barangay centroid is now the only honest location.
        address: null,
        residence_lat: null,
        residence_lon: null,
      };
    }
    return row;
  });

  return {
    inserts: stamped,
    mode: "append",
    stampedFacility: null,
    forcedTo: { psgc: home.psgc, name: home.name },
    relocations: [...counts.entries()]
      .map(([from, count]) => ({ from, count }))
      .sort((a, b) => b.count - a.count || a.from.localeCompare(b.from)),
    blocker: null,
  };
}

/** Sentence for the blocked state, or null when the account may upload. */
export function explainImportBlocker(blocker: ImportBlocker | null): string | null {
  switch (blocker) {
    case "unassigned":
      return (
        "Your account has no assigned area yet, so there is nowhere to file " +
        "these cases. Ask a system administrator to set your barangay — or, " +
        "if you work at a DOTS centre, your facility — then upload again."
      );
    case "not_permitted":
      return "Your account is not allowed to upload case files.";
    default:
      return null;
  }
}
