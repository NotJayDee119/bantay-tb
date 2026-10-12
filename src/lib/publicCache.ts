/**
 * Last-known copy of PUBLIC data, so a returning visitor sees the page filled
 * in at once while fresh rows load behind it.
 *
 * Only for data the anonymous key can already read — per-barangay totals, the
 * DOTS center directory. Never put case rows, profiles or anything RLS scopes
 * to a user in here: localStorage outlives sign-out and is readable by the
 * next person on a shared clinic computer.
 *
 * Storage can be missing or throw (private mode, blocked site data, quota),
 * so every access is guarded and callers must work when it returns null.
 */

const PREFIX = "bantay:public:";

export function readPublicCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value?: T };
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function writePublicCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ savedAt: Date.now(), value })
    );
  } catch {
    // A convenience, not a requirement — nothing to do.
  }
}
