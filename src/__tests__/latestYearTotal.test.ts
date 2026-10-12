import { describe, expect, it } from "vitest";
import { latestYearTotal } from "../hooks/usePublicYearlyCounts";

describe("latestYearTotal", () => {
  it("returns null when there is no data", () => {
    expect(latestYearTotal([])).toBeNull();
  });

  it("sums every barangay of the newest year only", () => {
    const rows = [
      { year: 2024, psgc: 1, count: 10 },
      { year: 2025, psgc: 1, count: 4 },
      { year: 2025, psgc: 2, count: 6 },
      { year: 2024, psgc: 2, count: 99 },
    ];
    expect(latestYearTotal(rows)).toEqual({ year: 2025, total: 10 });
  });

  it("does not depend on row order", () => {
    const rows = [
      { year: 2025, psgc: 2, count: 1 },
      { year: 2023, psgc: 1, count: 5 },
      { year: 2025, psgc: 1, count: 2 },
    ];
    expect(latestYearTotal(rows)).toEqual({ year: 2025, total: 3 });
  });
});
