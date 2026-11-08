// Pure helpers for the staff-password Edge Function, kept free of Deno APIs so
// vitest can exercise them (src/__tests__/staffPassword.test.ts).

export type StaffRole =
  | "system_admin"
  | "tb_coordinator"
  | "barangay_admin"
  | "health_worker"
  | "patient";

const COORDINATOR_CAN_RESET: StaffRole[] = ["health_worker", "barangay_admin"];

/**
 * Who may issue a temporary password for whom. Self-resets are refused by the
 * caller before this is consulted.
 *   system_admin    any account
 *   tb_coordinator  health_worker and barangay_admin only
 *   anyone else     nobody
 */
export function canReset(actor: StaffRole, target: StaffRole): boolean {
  if (actor === "system_admin") return true;
  if (actor === "tb_coordinator") return COORDINATOR_CAN_RESET.includes(target);
  return false;
}

// Easy to read aloud or copy off a screen: no 0/O, 1/l/I.
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGIT = "23456789";
export const TEMP_PASSWORD_ALPHABET = LOWER + UPPER + DIGIT;

function randomIndex(n: number): number {
  // Rejection sampling so every character is equally likely.
  const limit = 256 - (256 % n);
  const buf = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/**
 * e.g. "Kq7m-4tzp-X9hr": 12 random characters (about 70 bits) in three
 * groups, always containing a lowercase letter, an uppercase letter and a
 * digit so a strict password policy can't reject it.
 */
export function temporaryPassword(): string {
  const all = TEMP_PASSWORD_ALPHABET;
  for (;;) {
    let raw = "";
    for (let i = 0; i < 12; i++) raw += all[randomIndex(all.length)];
    if (/[a-z]/.test(raw) && /[A-Z]/.test(raw) && /[0-9]/.test(raw)) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
    }
  }
}
