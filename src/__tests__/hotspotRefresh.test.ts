import { describe, it, expect } from "vitest";
import {
  MIN_RUN_INTERVAL_MS,
  STALE_AFTER_MS,
  freshnessLabel,
  shouldDetect,
} from "../lib/hotspotRefresh";

const NOW = Date.parse("2026-08-11T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("shouldDetect", () => {
  it("runs when nothing has ever been detected", () => {
    // An empty table and "no hotspots exist" look identical to a user, so the
    // empty case has to resolve itself rather than wait to be asked.
    expect(shouldDetect(null, "stale", NOW).run).toBe(true);
    expect(shouldDetect(null, "cases_changed", NOW).run).toBe(true);
  });

  it("holds the floor between runs, whatever triggered it", () => {
    const recent = ago(MIN_RUN_INTERVAL_MS / 2);
    for (const reason of ["stale", "cases_changed"] as const) {
      const d = shouldDetect(recent, reason, NOW);
      expect(d.run).toBe(false);
      expect(d.skipped).toBe("too_soon");
    }
  });

  it("reacts to a case change once the floor has passed", () => {
    expect(
      shouldDetect(ago(MIN_RUN_INTERVAL_MS + 1_000), "cases_changed", NOW).run
    ).toBe(true);
  });

  it("does not re-run on open while the result is still fresh", () => {
    // Opening the page is not itself evidence anything changed — only the
    // sliding window justifies a run, and that takes time to matter.
    const d = shouldDetect(ago(STALE_AFTER_MS / 2), "stale", NOW);
    expect(d.run).toBe(false);
    expect(d.skipped).toBe("fresh");
  });

  it("re-runs on open once the result has gone stale", () => {
    expect(shouldDetect(ago(STALE_AFTER_MS + 1_000), "stale", NOW).run).toBe(
      true
    );
  });

  it("treats a future timestamp as just-run, not infinitely stale", () => {
    // Clock skew between the browser and Postgres would otherwise fire a run
    // on every mount, forever.
    const d = shouldDetect(new Date(NOW + 60_000).toISOString(), "stale", NOW);
    expect(d.run).toBe(false);
    expect(d.skipped).toBe("too_soon");
  });
});

describe("freshnessLabel", () => {
  it("says so when nothing has been detected yet", () => {
    expect(freshnessLabel(null, NOW)).toBe("Not checked yet");
  });

  it("rounds anything under a minute to just now", () => {
    expect(freshnessLabel(ago(30_000), NOW)).toBe("Updated just now");
  });

  it.each([
    [2 * 60_000, "Updated 2 minutes ago"],
    [60 * 60_000, "Updated 1 hour ago"],
    [26 * 60 * 60_000, "Updated 1 day ago"],
  ])("scales the unit with the age", (age, expected) => {
    expect(freshnessLabel(ago(age), NOW)).toBe(expected);
  });

  it("singularises one minute", () => {
    expect(freshnessLabel(ago(60_000), NOW)).toBe("Updated 1 minute ago");
  });
});
