import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildChartWorkbook } from "../lib/chartWorkbook";

const outcome = {
  title: "Treatment outcome",
  description: "Where each case currently stands in treatment.",
  note: "“Lost to follow-up” cases are the priority for BHW home visits.",
  kind: "donut" as const,
  rows: [
    { label: "Cured", value: 40, color: "#047857" },
    { label: "Ongoing", value: 50, color: "#2563eb" },
    { label: "Lost to follow-up", value: 10, color: "#f59e0b" },
  ],
};

function parts(bytes: Uint8Array) {
  const zip = XLSX.CFB.read(bytes, { type: "array" });
  const get = (name: string) => {
    const i = zip.FullPaths.findIndex((p) => p.endsWith("/" + name));
    return i < 0 ? null : new TextDecoder().decode(zip.FileIndex[i].content as Uint8Array);
  };
  return { zip, get };
}

describe("buildChartWorkbook", () => {
  it("writes a workbook Excel can read, with the table values", () => {
    const wb = XLSX.read(buildChartWorkbook(outcome), { type: "array" });
    expect(wb.SheetNames).toEqual(["Treatment outcome"]);
    const ws = wb.Sheets["Treatment outcome"];
    expect(ws["A1"].v).toBe("Treatment outcome");
    expect(ws["A4"].v).toBe("Category");
    expect(ws["A5"].v).toBe("Cured");
    expect(ws["B6"].v).toBe(50);
    expect(ws["C7"].v).toBeCloseTo(0.1);
    expect(ws["C7"].f).toContain("SUM($B$5:$B$7)");
    expect(ws["B8"].v).toBe(100);
  });

  it("embeds a doughnut chart wired to the sheet with the app's colours", () => {
    const { get } = parts(buildChartWorkbook(outcome));
    const chart = get("xl/charts/chart1.xml")!;
    expect(chart).toContain("<c:doughnutChart>");
    expect(chart).toContain("'Treatment outcome'!$A$5:$A$7");
    expect(chart).toContain("'Treatment outcome'!$B$5:$B$7");
    expect(chart).toContain('<a:srgbClr val="047857"/>');
    expect(chart).toContain('<a:srgbClr val="F59E0B"/>');
    expect(chart).toContain('<c:showPercent val="1"/>');
    expect(get("xl/worksheets/sheet1.xml")).toContain('<drawing r:id="rId1"/>');
    expect(get("[Content_Types].xml")).toContain("drawingml.chart+xml");
  });

  it("writes a column chart and month-on-month change for trends", () => {
    const bytes = buildChartWorkbook({
      title: "Monthly case trend",
      kind: "column",
      sequential: true,
      color: "#829ab1",
      rows: [
        { label: "January 2026", value: 5 },
        { label: "February 2026", value: 8 },
      ],
    });
    const ws = XLSX.read(bytes, { type: "array" }).Sheets["Monthly case trend"];
    expect(ws["D4"].v).toBe("Change vs previous month");
    expect(ws["D6"].v).toBe(3);
    const chart = parts(bytes).get("xl/charts/chart1.xml")!;
    expect(chart).toContain('<c:barDir val="col"/>');
    expect(chart).toContain('<a:srgbClr val="829AB1"/>');
  });

  it("handles an empty chart and awkward sheet names", () => {
    const bytes = buildChartWorkbook({
      title: "Cases: by sex / site [draft] & more — a very long title",
      kind: "donut",
      rows: [],
    });
    const wb = XLSX.read(bytes, { type: "array" });
    expect(wb.SheetNames[0].length).toBeLessThanOrEqual(31);
    expect(wb.SheetNames[0]).not.toMatch(/[:\\/?*[\]]/);
  });
});
