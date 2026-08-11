/**
 * When the hotspot map should re-run detection by itself.
 *
 * The page used to sit still until somebody pressed "Check for hotspots now",
 * and the panel told scoped staff that "detection runs city-wide on a
 * schedule" — which was not true: there is no pg_cron job and no pg_net, so
 * the only things that ever triggered a run were the case form, the bulk
 * import, and that button. A barangay account, which cannot press the button
 * at all, was looking at whatever the last person to encode a case had left
 * behind.
 *
 * Detection is citywide and destructive (it deletes every TB hotspot and
 * rewrites them), so "automatic" cannot mean "whenever anything happens in any
 * tab". Three limits keep it honest:
 *
 *   MIN_RUN_INTERVAL_MS  A floor between runs, checked against the newest
 *                        `detected_at` in the table rather than a local
 *                        timestamp — that is what stops five open dashboards
 *                        from each firing the function for the same case.
 *   STALE_AFTER_MS       On open, refresh anything older than this. Covers the
 *                        sliding window: a 90-day window quietly ages cases out
 *                        even on a day when nobody encodes anything.
 *   DEBOUNCE_MS          Let a burst of case writes settle before reacting. A
 *                        bulk import is thousands of inserts and deserves one
 *                        run, not thousands.
 */

/** Don't re-run detection more often than this, across all clients. */
export const MIN_RUN_INTERVAL_MS = 60_000;

/** On opening the page, re-run if the last result is older than this. */
export const STALE_AFTER_MS = 15 * 60_000;

/** Wait for case activity to settle before reacting to it. */
export const DEBOUNCE_MS = 6_000;

/** Coalesce the delete-then-insert of one run into a single list reload. */
export const RELOAD_DEBOUNCE_MS = 400;

export type DetectReason =
  /** Page opened and the stored result is stale (or absent). */
  | "stale"
  /** A case was inserted, updated or deleted while the page was open. */
  | "cases_changed";

export interface DetectDecision {
  run: boolean;
  /** Why it was skipped, for the console. Null when running. */
  skipped: "too_soon" | "fresh" | null;
}

/**
 * @param lastRunIso  Newest `hotspots.detected_at`, or null when the table is
 *                    empty — which is itself a reason to run, since an empty
 *                    map and "no hotspots exist" are indistinguishable to a
 *                    user otherwise.
 * @param now         Current time, injected so this stays testable.
 */
export function shouldDetect(
  lastRunIso: string | null,
  reason: DetectReason,
  now: number = Date.now()
): DetectDecision {
  // Never been run, or every hotspot was cleared. Nothing to protect.
  if (!lastRunIso) return { run: true, skipped: null };

  const age = now - new Date(lastRunIso).getTime();

  // A clock skew between the browser and Postgres can make `detected_at` look
  // like the future. Treat that as "just ran" rather than "infinitely stale",
  // which would otherwise trigger a run on every single mount.
  if (age < 0) return { run: false, skipped: "too_soon" };

  if (age < MIN_RUN_INTERVAL_MS) return { run: false, skipped: "too_soon" };

  if (reason === "stale" && age < STALE_AFTER_MS) {
    return { run: false, skipped: "fresh" };
  }

  return { run: true, skipped: null };
}

/**
 * How the panel describes its own freshness. Health workers should not have to
 * infer whether the map is live from the absence of a spinner.
 */
export function freshnessLabel(
  lastRunIso: string | null,
  now: number = Date.now()
): string {
  if (!lastRunIso) return "Not checked yet";
  const age = now - new Date(lastRunIso).getTime();
  if (age < 0 || age < 60_000) return "Updated just now";
  const minutes = Math.floor(age / 60_000);
  if (minutes < 60)
    return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
}
