/**
 * Builds a one-sheet .xlsx that carries the chart itself — not just the
 * numbers — so a coordinator who exports a dashboard panel opens Excel (or
 * Google Sheets / LibreOffice) and finds the same donut or column chart the
 * app shows, already drawn, with the same slice colours. A CSV can only hold
 * text, so it can never do this.
 *
 * SheetJS community edition does not write charts, so the package is written
 * by hand: a handful of OOXML parts zipped with a tiny store-only ZIP writer.
 * The chart reads its data from the sheet's cells, so editing a number in
 * Excel redraws the chart.
 */

export interface WorkbookChartRow {
  /** Category or month shown in the table and on the chart. */
  label: string;
  value: number;
  /** "#rrggbb"; donut slices keep the app's colour. */
  color?: string;
}

export interface WorkbookChartSpec {
  title: string;
  description?: string;
  note?: string;
  kind: "donut" | "column";
  /** Rows are months in order — adds a "change vs previous month" column. */
  sequential?: boolean;
  rows: WorkbookChartRow[];
  /** Column fill for column charts ("#rrggbb"). */
  color?: string;
}

/** Fallback slice colours when a row has none. */
const FALLBACK = ["2563EB", "0EA5E9", "14B8A6", "F59E0B", "EF4444", "8B5CF6", "64748B"];

const HEADER_ROW = 4; // 1-based row of the table header
const FIRST_DATA_ROW = HEADER_ROW + 1;

export function buildChartWorkbook(spec: WorkbookChartSpec): Uint8Array {
  const sheetName = safeSheetName(spec.title);
  const enc = new TextEncoder();
  const files: [string, string][] = [
    ["[Content_Types].xml", contentTypes()],
    ["_rels/.rels", rootRels()],
    ["xl/workbook.xml", workbookXml(sheetName)],
    ["xl/_rels/workbook.xml.rels", workbookRels()],
    ["xl/styles.xml", stylesXml()],
    ["xl/worksheets/sheet1.xml", sheetXml(spec)],
    ["xl/worksheets/_rels/sheet1.xml.rels", rel("drawing", "../drawings/drawing1.xml")],
    ["xl/drawings/drawing1.xml", drawingXml(spec)],
    ["xl/drawings/_rels/drawing1.xml.rels", rel("chart", "../charts/chart1.xml")],
    ["xl/charts/chart1.xml", chartXml(spec, sheetName)],
  ];
  return zipStore(files.map(([name, xml]) => [name, enc.encode(xml)]));
}

/** Triggers a browser download of the workbook. */
export function downloadChartWorkbook(spec: WorkbookChartSpec, filename: string) {
  const bytes = buildChartWorkbook(spec);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── XML parts ────────────────────────────────────────────────────────────

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const NS_XDR = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function contentTypes() {
  const ct = "application/vnd.openxmlformats-officedocument";
  return (
    XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    `<Override PartName="/xl/workbook.xml" ContentType="${ct}.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${ct}.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="${ct}.spreadsheetml.styles+xml"/>` +
    `<Override PartName="/xl/drawings/drawing1.xml" ContentType="${ct}.drawing+xml"/>` +
    `<Override PartName="/xl/charts/chart1.xml" ContentType="${ct}.drawingml.chart+xml"/>` +
    "</Types>"
  );
}

function rootRels() {
  return (
    XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
    "</Relationships>"
  );
}

function rel(type: string, target: string) {
  return (
    XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${REL}/${type}" Target="${target}"/>` +
    "</Relationships>"
  );
}

function workbookRels() {
  return (
    XML_HEAD +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/>` +
    "</Relationships>"
  );
}

function workbookXml(sheetName: string) {
  return (
    XML_HEAD +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}">` +
    `<sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    "</workbook>"
  );
}

// Cell style indices (cellXfs order below).
const S = {
  title: 1,
  header: 2,
  int: 3,
  pct: 4,
  boldText: 5,
  boldInt: 6,
  boldPct: 7,
  note: 8,
  signed: 9,
} as const;

function stylesXml() {
  return (
    XML_HEAD +
    `<styleSheet xmlns="${NS_MAIN}">` +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0%"/>' +
    '<numFmt numFmtId="165" formatCode="+#,##0;-#,##0;0"/></numFmts>' +
    '<fonts count="4">' +
    '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/><family val="2"/></font>' +
    "</fonts>" +
    '<fills count="3"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>' +
    "</fills>" +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left/><right/><top style="thin"><color rgb="FF94A3B8"/></top><bottom/><diagonal/></border>' +
    "</borders>" +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="10">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>' +
    '<xf numFmtId="3" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>' +
    '<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>"
  );
}

function strCell(ref: string, text: string, style = 0) {
  return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
}

function numCell(ref: string, value: number, style = 0) {
  return `<c r="${ref}"${style ? ` s="${style}"` : ""}><v>${value}</v></c>`;
}

function fmlCell(ref: string, formula: string, cached: number, style = 0) {
  return `<c r="${ref}"${style ? ` s="${style}"` : ""}><f>${esc(formula)}</f><v>${cached}</v></c>`;
}

function lastDataRow(spec: WorkbookChartSpec) {
  return FIRST_DATA_ROW + Math.max(spec.rows.length, 1) - 1;
}

function sheetXml(spec: WorkbookChartSpec) {
  const rows = spec.rows;
  const total = rows.reduce((s, r) => s + r.value, 0);
  const last = lastDataRow(spec);
  const sumRange = `$B$${FIRST_DATA_ROW}:$B$${last}`;
  const out: string[] = [];

  out.push(`<row r="1">${strCell("A1", spec.title, S.title)}</row>`);
  if (spec.description) out.push(`<row r="2">${strCell("A2", spec.description, S.note)}</row>`);

  const head = [
    strCell(`A${HEADER_ROW}`, spec.sequential ? "Month" : "Category", S.header),
    strCell(`B${HEADER_ROW}`, "Cases", S.header),
    strCell(`C${HEADER_ROW}`, "% of cases", S.header),
  ];
  if (spec.sequential) head.push(strCell(`D${HEADER_ROW}`, "Change vs previous month", S.header));
  out.push(`<row r="${HEADER_ROW}">${head.join("")}</row>`);

  rows.forEach((r, i) => {
    const n = FIRST_DATA_ROW + i;
    const cells = [
      strCell(`A${n}`, r.label),
      numCell(`B${n}`, r.value, S.int),
      fmlCell(
        `C${n}`,
        `IF(SUM(${sumRange})=0,0,B${n}/SUM(${sumRange}))`,
        total === 0 ? 0 : r.value / total,
        S.pct
      ),
    ];
    if (spec.sequential && i > 0) {
      cells.push(fmlCell(`D${n}`, `B${n}-B${n - 1}`, r.value - rows[i - 1].value, S.signed));
    }
    out.push(`<row r="${n}">${cells.join("")}</row>`);
  });

  const totalRow = last + 1;
  out.push(
    `<row r="${totalRow}">` +
      strCell(`A${totalRow}`, "Total", S.boldText) +
      fmlCell(`B${totalRow}`, `SUM(${sumRange})`, total, S.boldInt) +
      fmlCell(`C${totalRow}`, `IF(SUM(${sumRange})=0,0,1)`, total === 0 ? 0 : 1, S.boldPct) +
      (spec.sequential ? `<c r="D${totalRow}" s="${S.boldText}"/>` : "") +
      "</row>"
  );

  const noteRow = totalRow + 2;
  if (spec.note) out.push(`<row r="${noteRow}">${strCell(`A${noteRow}`, spec.note, S.note)}</row>`);
  const stampRow = noteRow + (spec.note ? 1 : 0);
  out.push(
    `<row r="${stampRow}">${strCell(
      `A${stampRow}`,
      `Exported from BANTAY-TB on ${new Date().toISOString().slice(0, 10)}`,
      S.note
    )}</row>`
  );

  return (
    XML_HEAD +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}">` +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>' +
    '<cols><col min="1" max="1" width="28" customWidth="1"/>' +
    '<col min="2" max="3" width="12" customWidth="1"/>' +
    '<col min="4" max="4" width="24" customWidth="1"/>' +
    '<col min="5" max="5" width="3" customWidth="1"/></cols>' +
    `<sheetData>${out.join("")}</sheetData>` +
    '<drawing r:id="rId1"/>' +
    "</worksheet>"
  );
}

function drawingXml(spec: WorkbookChartSpec) {
  // Chart sits to the right of the table, from column F, header row down 20 rows.
  const fromCol = 5;
  const toCol = spec.kind === "column" && spec.rows.length > 8 ? 15 : 12;
  return (
    XML_HEAD +
    `<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}">` +
    '<xdr:twoCellAnchor editAs="oneCell">' +
    `<xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${HEADER_ROW - 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${HEADER_ROW + 19}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    '<xdr:graphicFrame macro="">' +
    '<xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>' +
    '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
    `<a:graphic><a:graphicData uri="${NS_C}">` +
    `<c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId1"/>` +
    "</a:graphicData></a:graphic></xdr:graphicFrame>" +
    "<xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>"
  );
}

function fill(hex: string) {
  return `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
}

function txPr(size: number, bold = false, color = "334155") {
  return (
    "<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr>" +
    `<a:defRPr sz="${size * 100}" b="${bold ? 1 : 0}">${fill(color)}</a:defRPr>` +
    '</a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>'
  );
}

function chartXml(spec: WorkbookChartSpec, sheetName: string) {
  const ref = `'${sheetName.replace(/'/g, "''")}'`;
  const last = lastDataRow(spec);
  const n = spec.rows.length;
  const catF = `${ref}!$A$${FIRST_DATA_ROW}:$A$${last}`;
  const valF = `${ref}!$B$${FIRST_DATA_ROW}:$B$${last}`;

  const strCache =
    `<c:strCache><c:ptCount val="${n}"/>` +
    spec.rows.map((r, i) => `<c:pt idx="${i}"><c:v>${esc(r.label)}</c:v></c:pt>`).join("") +
    "</c:strCache>";
  const numCache =
    `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${n}"/>` +
    spec.rows.map((r, i) => `<c:pt idx="${i}"><c:v>${r.value}</c:v></c:pt>`).join("") +
    "</c:numCache>";

  const tx =
    `<c:tx><c:strRef><c:f>${esc(ref)}!$B$${HEADER_ROW}</c:f>` +
    '<c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Cases</c:v></c:pt></c:strCache></c:strRef></c:tx>';
  const cat = `<c:cat><c:strRef><c:f>${esc(catF)}</c:f>${strCache}</c:strRef></c:cat>`;
  const val = `<c:val><c:numRef><c:f>${esc(valF)}</c:f>${numCache}</c:numRef></c:val>`;

  let plot: string;
  let legend: string;
  if (spec.kind === "donut") {
    const points = spec.rows
      .map(
        (r, i) =>
          `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(hex(r.color, FALLBACK[i % FALLBACK.length]))}` +
          `<a:ln w="19050">${fill("FFFFFF")}</a:ln></c:spPr></c:dPt>`
      )
      .join("");
    // Percent labels on the slices, like the app's donut readout. Slivers
    // under 4% get no label (they'd collide; the table has the figure), and
    // light slices get dark text so the label stays readable.
    const total = spec.rows.reduce((s, r) => s + r.value, 0);
    const pointLabels = spec.rows
      .map((r, i) => {
        if (total > 0 && r.value / total < 0.04) {
          return `<c:dLbl><c:idx val="${i}"/><c:delete val="1"/></c:dLbl>`;
        }
        const c = hex(r.color, FALLBACK[i % FALLBACK.length]);
        if (luminance(c) < 0.45) return "";
        return (
          `<c:dLbl><c:idx val="${i}"/><c:numFmt formatCode="0%" sourceLinked="0"/>` +
          "<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>" +
          txPr(10, true, "1E293B") +
          '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/>' +
          '<c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbl>'
        );
      })
      .join("");
    const labels =
      `<c:dLbls>${pointLabels}<c:numFmt formatCode="0%" sourceLinked="0"/>` +
      "<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>" +
      txPr(10, true, "FFFFFF") +
      '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/>' +
      '<c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/>' +
      '<c:showLeaderLines val="1"/></c:dLbls>';
    plot =
      '<c:doughnutChart><c:varyColors val="1"/>' +
      `<c:ser><c:idx val="0"/><c:order val="0"/>${tx}${points}${labels}${cat}${val}</c:ser>` +
      '<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>';
    legend = `<c:legend><c:legendPos val="r"/><c:overlay val="0"/>${txPr(10)}</c:legend>`;
  } else {
    const color = hex(spec.color, "829AB1");
    const labels =
      "<c:dLbls>" +
      "<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>" +
      txPr(9, false, "475569") +
      '<c:dLblPos val="outEnd"/>' +
      '<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/>' +
      '<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>';
    const axisLine = `<c:spPr><a:ln w="9525">${fill("CBD5E1")}</a:ln></c:spPr>`;
    plot =
      '<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>' +
      `<c:ser><c:idx val="0"/><c:order val="0"/>${tx}<c:spPr>${fill(color)}</c:spPr>` +
      `<c:invertIfNegative val="0"/>${labels}${cat}${val}</c:ser>` +
      '<c:gapWidth val="60"/><c:axId val="500100"/><c:axId val="500200"/></c:barChart>' +
      '<c:catAx><c:axId val="500100"/><c:scaling><c:orientation val="minMax"/></c:scaling>' +
      '<c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/>' +
      '<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' +
      `${axisLine}${txPr(9)}` +
      '<c:crossAx val="500200"/><c:crosses val="autoZero"/><c:auto val="1"/>' +
      '<c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>' +
      '<c:valAx><c:axId val="500200"/><c:scaling><c:orientation val="minMax"/></c:scaling>' +
      '<c:delete val="0"/><c:axPos val="l"/>' +
      `<c:majorGridlines><c:spPr><a:ln w="6350">${fill("E2E8F0")}</a:ln></c:spPr></c:majorGridlines>` +
      '<c:numFmt formatCode="#,##0" sourceLinked="0"/>' +
      '<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>' +
      `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr(9)}` +
      '<c:crossAx val="500100"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>';
    // A single series needs no legend, as in the app.
    legend = "";
  }

  const title =
    "<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr>" +
    `<a:defRPr sz="1400" b="1">${fill("1E293B")}</a:defRPr></a:pPr>` +
    `<a:r><a:rPr lang="en-US" sz="1400" b="1">${fill("1E293B")}</a:rPr><a:t>${esc(spec.title)}</a:t></a:r>` +
    '</a:p></c:rich></c:tx><c:overlay val="0"/></c:title>';

  return (
    XML_HEAD +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
    '<c:roundedCorners val="0"/>' +
    `<c:chart>${title}<c:autoTitleDeleted val="0"/>` +
    `<c:plotArea><c:layout/>${plot}</c:plotArea>` +
    legend +
    '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>' +
    `<c:spPr>${fill("FFFFFF")}<a:ln>${fill("E2E8F0")}</a:ln></c:spPr>` +
    "</c:chartSpace>"
  );
}

// ── helpers ──────────────────────────────────────────────────────────────

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Characters XML 1.0 forbids outright.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function hex(color: string | undefined, fallback: string) {
  const m = color?.trim().match(/^#?([0-9a-f]{6})$/i);
  return (m ? m[1] : fallback).toUpperCase();
}

/** WCAG relative luminance of an "RRGGBB" colour, 0 (black) – 1 (white). */
function luminance(rgb: string) {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(rgb.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Excel sheet names: ≤31 chars, none of : \ / ? * [ ]. */
function safeSheetName(title: string) {
  const s = title.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);
  return s || "Chart";
}

// ── minimal ZIP (store, no compression) ─────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStore(entries: [string, Uint8Array][]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const [name, data] of entries) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    // extra, comment, disk, internal attrs, external attrs: all zero
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + cdSize + end.length);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}
