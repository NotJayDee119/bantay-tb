import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Download,
  HeartPulse,
  Info,
  Lightbulb,
  MapPin,
  Maximize2,
  Microscope,
  PieChart,
  Printer,
  ShieldAlert,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, Card, Modal, PageHeader, Select, Skeleton } from "../../components/ui";
import { ColumnChart, DonutChart } from "../../components/charts";
import { NEUTRAL, SERIES, toSlices, type Slice } from "../../lib/chartPalette";
import { YearFilter } from "../../components/YearFilter";
import {
  useCaseYear,
  yearOptions,
  type CaseYear,
} from "../../hooks/useCaseYear";
import { useTbCases, type TbCaseRow } from "../../hooks/useTbCases";
import { drugAxis } from "../../lib/hotspotUtils";
import { useAreaScope } from "../../hooks/useAreaScope";
import { areaSuffix, type AreaScope } from "../../lib/areaScope";
import barangays from "../../data/barangays.json";

const BARANGAY_NAME = new Map(
  (barangays as { psgc: number; name: string }[]).map((b) => [b.psgc, b.name])
);

interface RawCase {
  /** Residence, not the registering facility — see byBarangay below. */
  barangay_psgc: number;
  age: number | null;
  sex: "male" | "female" | "other" | "unknown" | null;
  tb_classification: string | null;
  /** ITIS anatomical site. */
  tb_site: string | null;
  /** ITIS bacteriological status. */
  diagnosis_status: string | null;
  lab_results: TbCaseRow["lab_results"];
  treatment_outcome: string | null;
  reported_at: string;
}

interface AreaRow {
  psgc: number;
  name: string;
  count: number;
}

interface AnalyticsData {
  total: number;
  byMonth: { month: string; count: number }[];
  /**
   * Cases per barangay of RESIDENCE, densest first. Residence is the axis this
   * page is for: screening drives and contact tracing happen where people
   * live, not where their case was filed. Grouping by registering facility
   * would point campaigns at whichever barangay happens to hold a clinic.
   */
  byBarangay: AreaRow[];
  byAgeBand: { band: string; count: number }[];
  bySex: { label: string; count: number }[];
  /** ITIS axis 1 — anatomical site (pulmonary / extra-pulmonary). */
  bySite: { label: string; count: number }[];
  /** ITIS axis 2 — bacteriological status (BC / CD / presumptive). */
  byBact: { label: string; count: number }[];
  /** ITIS axis 3 — drug resistance (DS-TB / DR-TB / not tested). */
  byDrug: { label: string; count: number }[];
  /** Male and female counts per age band — the population pyramid. */
  sexByAge: { band: string; male: number; female: number }[];
  byOutcome: { label: string; count: number }[];
}

const AGE_BANDS = [
  { label: "0–17", min: 0, max: 17 },
  { label: "18–34", min: 18, max: 34 },
  { label: "35–54", min: 35, max: 54 },
  { label: "55+", min: 55, max: 200 },
];

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

// Fixed colour per category so a slice never changes hue when counts reorder.
const SEX_COLORS: Record<string, string> = {
  male: SERIES[0],
  female: SERIES[1],
  other: SERIES[2],
  unknown: NEUTRAL,
};
// The three ITIS classification axes, each with its own fixed palette.
// "Not recorded" stays neutral so it never competes with a real category.
const SITE_COLORS: Record<string, string> = {
  pulmonary: SERIES[0],
  extra_pulmonary: SERIES[4],
  not_recorded: NEUTRAL,
};
const BACT_COLORS: Record<string, string> = {
  bacteriologically_confirmed: SERIES[2],
  clinically_diagnosed: SERIES[0],
  presumptive: SERIES[3],
  not_recorded: NEUTRAL,
};
const DRUG_COLORS: Record<string, string> = {
  drug_sensitive: SERIES[2],
  drug_resistant: SERIES[1],
  not_tested: NEUTRAL,
};
// Readable names for the ITIS categories (legend, table and readouts).
const CATEGORY_LABEL: Record<string, string> = {
  pulmonary: "Pulmonary",
  extra_pulmonary: "Extra-pulmonary",
  bacteriologically_confirmed: "Bact. confirmed",
  clinically_diagnosed: "Clinically diagnosed",
  presumptive: "Presumptive",
  drug_sensitive: "Drug-susceptible",
  drug_resistant: "Drug-resistant",
  not_tested: "No DST result",
  not_recorded: "Not recorded",
};
// Outcomes read as status: greens are favourable, amber/red need follow-up.
// Every slice is also labelled in the legend, so colour is never the only cue.
const OUTCOME_COLORS: Record<string, string> = {
  cured: "#047857",
  completed: "#34d399",
  ongoing: SERIES[0],
  lost_to_followup: "#f59e0b",
  failed: "#eb6834",
  died: "#be123c",
  not_evaluated: "#cbd5e1",
  unknown: NEUTRAL,
};

const MONTH_FMT = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  timeZone: "UTC",
});
const MONTH_YEAR_FMT = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function Analytics() {
  const scope = useAreaScope();
  // Which chart is open in the detail modal, and which item in it is selected.
  const [detail, setDetail] = useState<{
    id: ChartId;
    focus: number | null;
  } | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);
  const [year, setYear] = useCaseYear();
  // Barangay-level report: null = every barangay this account can see.
  const [area, setArea] = useState<number | null>(null);
  const areaName = area === null ? null : (BARANGAY_NAME.get(area) ?? `PSGC ${area}`);
  const periodLabel = year === "all" ? "All years" : String(year);
  // RLS limits area-scoped staff to their barangay, so these figures describe
  // that area rather than the city — say which one in the subtitle.
  const subtitle =
    (areaName
      ? `Barangay-level report for ${areaName} · TB cases only · ${periodLabel}.`
      : `TB cases only · ${periodLabel} · Where to focus screening and contact-tracing campaigns.`) +
    areaSuffix(scope);
  // Reads the shared, cached register (the same copy the Dashboard and map
  // use) and filters by year here, so switching years is instant and opening
  // this page after the Dashboard downloads nothing. The year is the local
  // (Philippine) calendar year, matching the Dashboard's bucketing.
  const casesQuery = useTbCases();
  const yearSpan = useMemo(() => {
    let earliest: number | null = null;
    let latest: number | null = null;
    for (const c of casesQuery.data ?? []) {
      const y = localYear(c.reported_at);
      if (y == null) continue;
      if (earliest == null || y < earliest) earliest = y;
      if (latest == null || y > latest) latest = y;
    }
    return { earliest, latest };
  }, [casesQuery.data]);
  const yearRows = useMemo<RawCase[] | null>(() => {
    if (!casesQuery.data) return null;
    const rows: RawCase[] = [];
    for (const c of casesQuery.data) {
      if (!c.reported_at) continue;
      if (year !== "all" && localYear(c.reported_at) !== year) continue;
      rows.push({
        barangay_psgc: c.barangay_psgc,
        age: c.age,
        sex: c.sex,
        tb_classification: c.tb_classification,
        tb_site: c.tb_site ?? null,
        diagnosis_status: c.diagnosis_status ?? null,
        lab_results: c.lab_results ?? null,
        treatment_outcome: c.treatment_outcome,
        reported_at: c.reported_at,
      });
    }
    return rows;
  }, [casesQuery.data, year]);
  // Every chart below is recomputed for the chosen barangay, so the page
  // doubles as a printable barangay-level report.
  const data = useMemo<AnalyticsData | null>(() => {
    if (!yearRows) return null;
    return summarize(
      area === null ? yearRows : yearRows.filter((r) => r.barangay_psgc === area),
      year
    );
  }, [yearRows, area, year]);
  // The barangay ranking always covers every barangay in the period, so the
  // list stays a way to pick the next report.
  const allAreas = useMemo<AreaRow[]>(
    () => (yearRows ? summarize(yearRows, year).byBarangay : []),
    [yearRows, year]
  );
  const yearTotal = yearRows?.length ?? 0;
  const pickArea = useCallback((psgc: number | null) => {
    setArea(psgc);
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const yearFilter = (
    <YearFilter
      className="mb-5"
      value={year}
      years={yearOptions(yearSpan.earliest, yearSpan.latest, year)}
      onChange={setYear}
    />
  );

  if (!data) {
    return (
      <>
        <PageHeader
          title="Analytics for Outreach"
          subtitle={subtitle}
        />
        {yearFilter}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-80 rounded-xl lg:col-span-2" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      </>
    );
  }

  const insights = buildInsights(data);
  const workingShare =
    data.total === 0
      ? 0
      : Math.round(
          (((data.byAgeBand.find((b) => b.band === "18–34")?.count ?? 0) +
            (data.byAgeBand.find((b) => b.band === "35–54")?.count ?? 0)) /
            data.total) *
            100
        );
  const curedShare =
    data.total === 0
      ? 0
      : Math.round(
          (((data.byOutcome.find((o) => o.label === "cured")?.count ?? 0) +
            (data.byOutcome.find((o) => o.label === "completed")?.count ?? 0)) /
            data.total) *
            100
        );

  // Recent half vs prior half of the window — same split buildInsights uses.
  const split = Math.floor(data.byMonth.length / 2);
  const priorHalf = data.byMonth.slice(0, split).reduce((s, m) => s + m.count, 0);
  const recentHalf = data.byMonth.slice(split).reduce((s, m) => s + m.count, 0);
  const trendPct =
    priorHalf === 0 ? null : Math.round(((recentHalf - priorHalf) / priorHalf) * 100);
  const peakMonth = data.byMonth.reduce<{ month: string; count: number } | null>(
    (best, m) => (best == null || m.count > best.count ? m : best),
    null
  );

  const specs: Record<ChartId, ChartSpec> = {
    trend: {
      title: "Monthly case trend",
      icon: BarChart3,
      kind: "column",
      sequential: true,
      description:
        year === "all"
          ? "New TB cases reported per month, across every year on record."
          : `New TB cases reported per month in ${year}.`,
      note:
        year === new Date().getFullYear() || year === "all"
          ? "The current month is still in progress, so its column will keep growing."
          : undefined,
      rows: data.byMonth.map((m) => {
        const d = monthDate(m.month);
        return {
          label:
            d.getUTCMonth() === 0
              ? `${MONTH_FMT.format(d)} ’${String(d.getUTCFullYear()).slice(2)}`
              : MONTH_FMT.format(d),
          title: MONTH_YEAR_FMT.format(d),
          value: m.count,
        };
      }),
      columnProps: {
        color: "#829ab1",
        emphasisColor: "#243b53",
        showAverage: true,
        height: 220,
      },
    },
    outcome: {
      title: "Treatment outcome",
      icon: HeartPulse,
      kind: "donut",
      description:
        "Where each case currently stands in treatment. Cured and completed are favourable outcomes.",
      note: "“Lost to follow-up” cases are the priority for BHW home visits and follow-up calls.",
      rows: sliceRows(toSlices(data.byOutcome, OUTCOME_COLORS)),
    },
    sex: {
      title: "By sex",
      icon: PieChart,
      kind: "donut",
      description: "Share of cases by recorded sex.",
      note: "A strong skew toward one group is a cue to tailor health-promotion messaging and venues.",
      rows: sliceRows(toSlices(data.bySex, SEX_COLORS)),
    },
    site: {
      title: "Anatomical site",
      icon: Stethoscope,
      kind: "donut",
      description:
        "ITIS classification by anatomical site: pulmonary (lungs) or extra-pulmonary (outside the lungs).",
      note: "Pulmonary TB is the infectious form, so a high pulmonary share means contact tracing of households is the priority.",
      rows: sliceRows(toSlices(data.bySite, SITE_COLORS)),
    },
    bact: {
      title: "Bacteriological status",
      icon: Microscope,
      kind: "donut",
      description:
        "ITIS classification by how the case was diagnosed: bacteriologically confirmed (smear, culture or Xpert positive) or clinically diagnosed.",
      note: "A low bacteriologically confirmed share points to limited access to GeneXpert or sputum testing — a budget item for diagnostics.",
      rows: sliceRows(toSlices(data.byBact, BACT_COLORS)),
    },
    drug: {
      title: "Drug resistance",
      icon: ShieldAlert,
      kind: "donut",
      description:
        "ITIS classification by drug susceptibility testing (DST): drug-susceptible (DS-TB) or drug-resistant (DR-TB).",
      note: "DR-TB needs a longer, costlier regimen. Each DR-TB case should be budgeted separately from DS-TB cases.",
      rows: sliceRows(toSlices(data.byDrug, DRUG_COLORS)),
    },
    age: {
      title: "Age distribution",
      icon: Users,
      kind: "column",
      description: "Cases grouped by age band, in years.",
      note: "Cases with no recorded age are left out of this chart, so the bands may sum to less than the total.",
      rows: data.byAgeBand.map((b) => ({
        label: b.band,
        title: `Aged ${b.band}`,
        value: b.count,
      })),
      columnProps: { color: "#0ea5e9", height: 168 },
    },
  };

  const sexNote = sexIndication(data);

  return (
    <>
      <PageHeader
        title={areaName ? `Barangay Report · ${areaName}` : "Analytics for Outreach"}
        subtitle={subtitle}
        actions={
          <Button
            variant="secondary"
            size="sm"
            className="print:hidden"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print report
          </Button>
        }
      />
      {yearFilter}
      <ReportScopeBar
        areas={allAreas}
        value={area}
        onChange={pickArea}
        total={data.total}
        yearTotal={yearTotal}
      />

      {/* ── Headline stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Activity}
          iconClass="bg-brand-50 text-brand-700"
          accentClass="bg-brand-500"
          label={`Cases · ${periodLabel}`}
          value={data.total.toLocaleString()}
          footer={
            trendPct == null ? undefined : (
              <TrendBadge pct={trendPct} suffix="second half vs first half" />
            )
          }
        />
        {areaName ? (
          <StatTile
            icon={MapPin}
            iconClass="bg-vigil-300/20 text-vigil-600"
            accentClass="bg-vigil-400"
            label="Share of all cases"
            value={`${yearTotal === 0 ? 0 : Math.round((data.total / yearTotal) * 1000) / 10}%`}
            footer={`${data.total.toLocaleString()} of ${yearTotal.toLocaleString()} cases · rank ${
              allAreas.findIndex((a) => a.psgc === area) + 1
            } of ${allAreas.length}`}
          />
        ) : (
          <StatTile
            icon={MapPin}
            iconClass="bg-vigil-300/20 text-vigil-600"
            accentClass="bg-vigil-400"
            label="Barangays affected"
            value={data.byBarangay.length.toLocaleString()}
            footer={
              data.byBarangay.length > 0
                ? `Most affected: ${data.byBarangay[0].name}`
                : undefined
            }
          />
        )}
        <StatTile
          icon={Users}
          iconClass="bg-sky-50 text-sky-700"
          accentClass="bg-sky-500"
          label="Working-age share"
          value={`${workingShare}%`}
          footer="Cases aged 18–54"
        />
        <StatTile
          icon={HeartPulse}
          iconClass="bg-accent-50 text-accent-700"
          accentClass="bg-accent-500"
          label="Cured / completed"
          value={`${curedShare}%`}
          footer="Favourable treatment outcomes"
        />
      </div>

      {/* ── Trend + outcomes ─────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          spec={specs.trend}
          meta={
            peakMonth && peakMonth.count > 0
              ? `Peak · ${MONTH_YEAR_FMT.format(monthDate(peakMonth.month))}`
              : undefined
          }
          onOpen={(focus) => setDetail({ id: "trend", focus })}
        >
          <p className="border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 text-xs text-slate-400">
            Darker column is the current (partial) month. Dotted line is the
            monthly average across the window.
          </p>
        </Panel>
        <Panel
          spec={specs.outcome}
          onOpen={(focus) => setDetail({ id: "outcome", focus })}
        />
      </div>

      {/* ── Who: demographics ────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel spec={specs.sex} onOpen={(focus) => setDetail({ id: "sex", focus })}>
          <SexIndication note={sexNote} />
        </Panel>
        <Panel
          spec={specs.age}
          meta="Years"
          onOpen={(focus) => setDetail({ id: "age", focus })}
        />
        <SexAgePyramid
          className="md:col-span-2 xl:col-span-1"
          rows={data.sexByAge}
        />
      </div>

      {/* ── ITIS case classification ─────────────────────────────────── */}
      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <div className={MICRO_LABEL}>Case classification · ITIS</div>
          <p className="mt-0.5 text-sm text-slate-600">
            Every TB case classified on the three ITIS axes: where the disease
            is, how it was diagnosed, and whether it is drug-resistant.
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel spec={specs.site} onOpen={(focus) => setDetail({ id: "site", focus })} />
        <Panel spec={specs.bact} onOpen={(focus) => setDetail({ id: "bact", focus })} />
        <Panel
          className="md:col-span-2 xl:col-span-1"
          spec={specs.drug}
          onOpen={(focus) => setDetail({ id: "drug", focus })}
        />
      </div>

      {detail && (
        <ChartDetailModal
          id={detail.id}
          spec={specs[detail.id]}
          focus={detail.focus}
          onFocus={(focus) => setDetail({ id: detail.id, focus })}
          onClose={closeDetail}
        />
      )}

      {/* ── Outreach recommendations ─────────────────────────────────── */}
      <Card className="mt-4 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <Lightbulb className="h-3.5 w-3.5 text-vigil-500" />
            Outreach recommendations
          </div>
          {insights.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {insights.length} signal{insights.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {insights.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Not enough data yet. Encode more cases or run Bulk Import.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {insights.map((i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-vigil-400/40 bg-vigil-300/20 text-vigil-600"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm leading-relaxed text-slate-800">{i}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 text-xs text-slate-400">
          Heuristics derived from the cases in the selected period. Combine with
          local epidemiologic context before finalising campaign targets.
        </p>
      </Card>

      {/* ── Per-area breakdown ───────────────────────────────────────── */}
      <AreaBreakdown
        rows={allAreas}
        total={yearTotal}
        scope={scope}
        selected={area}
        onPick={pickArea}
      />
    </>
  );
}

function localYear(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

function monthKey(dt: Date) {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthDate(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

function summarize(rows: RawCase[], year: CaseYear): AnalyticsData {
  // Seed every month in the period with zero so a quiet month shows as an
  // empty column instead of silently vanishing from the trend. A year runs
  // Jan–Dec (stopping at this month for the current year); "all" runs from
  // the oldest case to now.
  const byMonthMap = new Map<string, number>();
  const now = new Date();
  let start: Date;
  let end: Date;
  if (year === "all") {
    // Oldest case to newest case — not to today, so data that ends in 2025
    // doesn't trail a row of empty 2026 months.
    const times = rows.map((c) => new Date(c.reported_at).getTime());
    start = new Date(times.length ? Math.min(...times) : now.getTime());
    end = new Date(times.length ? Math.max(...times) : now.getTime());
  } else {
    start = new Date(Date.UTC(year, 0, 1));
    end = new Date(Math.min(Date.UTC(year, 11, 1), now.getTime()));
  }
  for (
    let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    d <= end;
    d.setUTCMonth(d.getUTCMonth() + 1)
  ) {
    byMonthMap.set(monthKey(d), 0);
  }
  const byBarangayMap = new Map<number, number>();
  const byAgeBand = AGE_BANDS.map((b) => ({ band: b.label, count: 0 }));
  const bySexMap = new Map<string, number>();
  const bySiteMap = new Map<string, number>();
  const byBactMap = new Map<string, number>();
  const byDrugMap = new Map<string, number>();
  const sexByAge = AGE_BANDS.map((b) => ({ band: b.label, male: 0, female: 0 }));
  const byOutcomeMap = new Map<string, number>();

  for (const c of rows) {
    byBarangayMap.set(
      c.barangay_psgc,
      (byBarangayMap.get(c.barangay_psgc) ?? 0) + 1
    );

    const key = monthKey(new Date(c.reported_at));
    byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + 1);

    if (c.age != null) {
      const band = AGE_BANDS.find((b) => c.age! >= b.min && c.age! <= b.max);
      if (band) {
        const e = byAgeBand.find((x) => x.band === band.label)!;
        e.count += 1;
        const p = sexByAge.find((x) => x.band === band.label)!;
        if (c.sex === "male") p.male += 1;
        else if (c.sex === "female") p.female += 1;
      }
    }
    const sex = c.sex ?? "unknown";
    bySexMap.set(sex, (bySexMap.get(sex) ?? 0) + 1);

    const { site, bact, drug } = itisAxes(c);
    bySiteMap.set(site, (bySiteMap.get(site) ?? 0) + 1);
    byBactMap.set(bact, (byBactMap.get(bact) ?? 0) + 1);
    byDrugMap.set(drug, (byDrugMap.get(drug) ?? 0) + 1);

    const out = c.treatment_outcome ?? "unknown";
    byOutcomeMap.set(out, (byOutcomeMap.get(out) ?? 0) + 1);
  }

  const byMonth = [...byMonthMap.entries()]
    .sort()
    .map(([month, count]) => ({ month, count }));

  // Densest first — the list is a work queue, so the barangay needing a
  // screening drive most should not be something you scroll to find. Ties fall
  // back to name so the order is stable between refreshes.
  const byBarangay = [...byBarangayMap.entries()]
    .map(([psgc, count]) => ({
      psgc,
      name: BARANGAY_NAME.get(psgc) ?? `PSGC ${psgc}`,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    total: rows.length,
    byMonth,
    byBarangay,
    byAgeBand,
    bySex: toSorted(bySexMap),
    bySite: toSorted(bySiteMap),
    byBact: toSorted(byBactMap),
    byDrug: toSorted(byDrugMap),
    sexByAge,
    byOutcome: toSorted(byOutcomeMap),
  };
}

function toSorted(m: Map<string, number>) {
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

function buildInsights(d: AnalyticsData): string[] {
  if (d.total === 0) return [];
  const out: string[] = [];

  // Where the burden sits. A citywide percentage is a different job depending
  // on whether it is concentrated in three barangays or spread over forty, and
  // that is the difference between a targeted drive and a general campaign.
  if (d.byBarangay.length >= 4) {
    const top3 = d.byBarangay.slice(0, 3);
    const topShare = Math.round(
      (top3.reduce((s, r) => s + r.count, 0) / d.total) * 100
    );
    if (topShare >= 50) {
      out.push(
        `${topShare}% of cases live in just 3 of ${d.byBarangay.length} affected barangays (${top3
          .map((r) => r.name)
          .join(", ")}) — concentrate screening there before widening the campaign.`
      );
    }
  }

  // Working-age burden
  const workingAge =
    (d.byAgeBand.find((b) => b.band === "18–34")?.count ?? 0) +
    (d.byAgeBand.find((b) => b.band === "35–54")?.count ?? 0);
  const workingShare = Math.round((workingAge / d.total) * 100);
  if (workingShare >= 50) {
    out.push(
      `Working-age adults (18–54) make up ${workingShare}% of cases — consider workplace and barangay-hall screening drives during weekends.`
    );
  }

  // Pediatric share
  const peds = d.byAgeBand.find((b) => b.band === "0–17")?.count ?? 0;
  if (d.total > 30 && peds / d.total >= 0.1) {
    out.push(
      `Pediatric share is ${Math.round((peds / d.total) * 100)}% — coordinate with day care / school nurses for symptom screening and IPT for contacts.`
    );
  }

  // Sex skew
  const m = d.bySex.find((s) => s.label === "male")?.count ?? 0;
  const f = d.bySex.find((s) => s.label === "female")?.count ?? 0;
  if (m + f > 50 && (m / (m + f) > 0.6 || f / (m + f) > 0.6)) {
    const dominant = m > f ? "men" : "women";
    out.push(
      `Caseload skews ${Math.round((Math.max(m, f) / (m + f)) * 100)}% toward ${dominant} — tailor health-promotion messaging accordingly.`
    );
  }

  // Treatment outcome
  const lost =
    d.byOutcome.find((o) => o.label === "lost_to_followup")?.count ?? 0;
  if (lost / d.total >= 0.05) {
    out.push(
      `Lost-to-follow-up rate is ${Math.round((lost / d.total) * 100)}% — prioritise BHW home visits and follow-up calls.`
    );
  }

  // Trend (second half of the period vs the first half)
  if (d.byMonth.length >= 6) {
    const split = Math.floor(d.byMonth.length / 2);
    const prior = d.byMonth.slice(0, split).reduce((s, m) => s + m.count, 0);
    const recent = d.byMonth.slice(split).reduce((s, m) => s + m.count, 0);
    if (prior > 0 && recent / prior >= 1.2) {
      const pct = Math.round(((recent - prior) / prior) * 100);
      out.push(
        `Case load is up ${pct}% in the recent half vs the prior half — check the Hotspots page and notify barangay leaders.`
      );
    } else if (prior > 0 && recent / prior <= 0.8) {
      const pct = Math.round(((prior - recent) / prior) * 100);
      out.push(
        `Case load is down ${pct}% recently — sustain ACF momentum; do not relax surveillance.`
      );
    }
  }

  return out;
}

/**
 * A case on the three ITIS classification axes.
 *
 * The dedicated columns win. Rows written before they existed (bulk import,
 * seed) only carry the legacy `tb_classification`, so each axis falls back to
 * what that single value actually asserts and nothing more: a "drug_resistant"
 * row had a DST result, so it is bacteriologically confirmed, but it says
 * nothing about the site.
 */
function itisAxes(c: RawCase): { site: string; bact: string; drug: string } {
  const legacy = c.tb_classification;
  const site =
    c.tb_site ??
    (legacy === "pulmonary" || legacy === "extra_pulmonary" ? legacy : "not_recorded");
  const bact =
    c.diagnosis_status ??
    (legacy === "presumptive"
      ? "presumptive"
      : legacy === "drug_sensitive" || legacy === "drug_resistant"
        ? "bacteriologically_confirmed"
        : legacy === "pulmonary" || legacy === "extra_pulmonary"
          ? "clinically_diagnosed"
          : "not_recorded");
  const drug = drugAxis(c) ?? "not_tested";
  return { site, bact, drug };
}

interface SexNote {
  male: number;
  female: number;
  /** Male share of cases with a recorded sex, 0–100. */
  malePct: number;
  /** Men per woman, e.g. 1.8 → "1.8 : 1". Null when there are no women. */
  ratio: number | null;
  headline: string;
  action: string;
}

/**
 * What the male and female counts are telling the planner. A bare 62 / 38
 * donut invites "so what?"; the ratio and the action it implies are what a
 * budget or a screening schedule is decided on.
 */
function sexIndication(d: AnalyticsData): SexNote | null {
  const male = d.bySex.find((s) => s.label === "male")?.count ?? 0;
  const female = d.bySex.find((s) => s.label === "female")?.count ?? 0;
  const known = male + female;
  if (known === 0) return null;
  const malePct = Math.round((male / known) * 100);
  const ratio = female === 0 ? null : Math.round((male / female) * 10) / 10;
  const ratioText = ratio === null ? "only men recorded" : `${ratio} : 1 (male : female)`;
  if (malePct >= 55) {
    return {
      male,
      female,
      malePct,
      ratio,
      headline: `Men are ${malePct}% of cases · ${ratioText}.`,
      action:
        "Men are being notified more than women. Men are less likely to visit health centres on their own, so bring screening to them: workplaces, markets, terminals and evening or weekend schedules.",
    };
  }
  if (malePct <= 45) {
    return {
      male,
      female,
      malePct,
      ratio,
      headline: `Women are ${100 - malePct}% of cases · ${ratioText}.`,
      action:
        "Women are being notified more than men. Check whether men are being missed, and use prenatal, family-planning and household visits to reach women early.",
    };
  }
  return {
    male,
    female,
    malePct,
    ratio,
    headline: `Cases are split almost evenly · ${ratioText}.`,
    action:
      "No strong sex skew. Plan household-based screening that reaches both men and women.",
  };
}

function SexIndication({ note }: { note: SexNote | null }) {
  if (!note) return null;
  return (
    <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-2.5">
      <p className="text-xs font-semibold text-slate-800">{note.headline}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{note.action}</p>
    </div>
  );
}

/**
 * Population pyramid: men to the left, women to the right, one row per age
 * band. Shows which sex AND age group to target in the same glance — the
 * question a separate sex donut and age chart leave the reader to combine.
 */
function SexAgePyramid({
  rows,
  className = "",
}: {
  rows: { band: string; male: number; female: number }[];
  className?: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.male, r.female]));
  const top = rows.reduce<{ band: string; sex: string; n: number } | null>((best, r) => {
    const cand =
      r.male >= r.female
        ? { band: r.band, sex: "men", n: r.male }
        : { band: r.band, sex: "women", n: r.female };
    return best === null || cand.n > best.n ? cand : best;
  }, null);
  return (
    <Card className={"flex flex-col overflow-hidden p-0 " + className}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-2">
        <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
          <Users className="h-3.5 w-3.5 text-brand-600" />
          Sex by age group
        </div>
        <span className="font-mono text-[10px] text-slate-500">Cases</span>
      </div>
      <div className="flex-1 px-4 py-4">
        <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] font-semibold">
          <span className="text-right" style={{ color: SEX_COLORS.male }}>Male</span>
          <span className="w-12" />
          <span style={{ color: SEX_COLORS.female }}>Female</span>
        </div>
        <ul className="space-y-2.5">
          {[...rows].reverse().map((r) => (
            <li key={r.band} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="flex items-center justify-end gap-1.5">
                <span className="font-mono text-[11px] tabular-nums text-slate-600">{r.male}</span>
                <div className="h-4 w-full overflow-hidden rounded-l-md bg-slate-100">
                  <div
                    className="ml-auto h-full rounded-l-md"
                    style={{ width: `${(r.male / max) * 100}%`, background: SEX_COLORS.male }}
                  />
                </div>
              </div>
              <span className="w-12 text-center font-mono text-[11px] font-semibold text-slate-700">
                {r.band}
              </span>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-full overflow-hidden rounded-r-md bg-slate-100">
                  <div
                    className="h-full rounded-r-md"
                    style={{ width: `${(r.female / max) * 100}%`, background: SEX_COLORS.female }}
                  />
                </div>
                <span className="font-mono text-[11px] tabular-nums text-slate-600">{r.female}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {top && top.n > 0 && (
        <p className="border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 text-xs leading-relaxed text-slate-500">
          Largest group:{" "}
          <strong className="text-slate-800">
            {top.sex} aged {top.band}
          </strong>{" "}
          ({top.n.toLocaleString()} cases). Target this group first when
          scheduling screening.
        </p>
      )}
    </Card>
  );
}

/**
 * Chooses what the page reports on: every barangay, or one barangay. Picking
 * one turns every chart into that barangay's report.
 */
function ReportScopeBar({
  areas,
  value,
  onChange,
  total,
  yearTotal,
}: {
  areas: AreaRow[];
  value: number | null;
  onChange: (psgc: number | null) => void;
  total: number;
  yearTotal: number;
}) {
  const sorted = [...areas].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <MapPin className="h-4 w-4" />
        </span>
        <div>
          <div className={MICRO_LABEL}>Report for</div>
          <div className="text-sm font-semibold text-slate-900">
            {value === null ? "All barangays" : (BARANGAY_NAME.get(value) ?? value)}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
        <Select
          aria-label="Choose a barangay for the report"
          className="w-full sm:w-64 print:hidden"
          value={value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">All barangays ({yearTotal.toLocaleString()} cases)</option>
          {sorted.map((a) => (
            <option key={a.psgc} value={a.psgc}>
              {a.name} ({a.count.toLocaleString()})
            </option>
          ))}
        </Select>
        {value !== null && (
          <>
            <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-brand-700">
              {total.toLocaleString()} case{total === 1 ? "" : "s"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="print:hidden"
              onClick={() => onChange(null)}
            >
              Back to all barangays
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

const AREAS_COLLAPSED = 8;

/**
 * Cases per barangay of residence.
 *
 * Every other panel on this page answers "who" — this one answers "where", and
 * without it the citywide totals give a campaign planner nothing to act on: a
 * 12% lost-to-follow-up rate is a different job in one barangay than spread
 * evenly over forty.
 *
 * The list is whatever `cases` RLS returned, so it is also a scope readout. A
 * health centre sees its own residents plus the cases its facility registered,
 * and those patients live elsewhere — so rows for other barangays are expected
 * there and the user's own area is tagged to keep the two apart.
 */
function AreaBreakdown({
  rows,
  total,
  scope,
  selected,
  onPick,
}: {
  rows: AreaRow[];
  total: number;
  scope: AreaScope;
  selected: number | null;
  onPick: (psgc: number | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, AREAS_COLLAPSED);
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card className="mt-4 overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
        <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
          <MapPin className="h-3.5 w-3.5 text-vigil-500" />
          Cases by barangay · where patients live · click one for its report
        </div>
        {rows.length > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-slate-500">
            {rows.length} {rows.length === 1 ? "area" : "areas"}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No cases in this period, so there is no area to rank.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {shown.map((r, i) => {
              const share = total === 0 ? 0 : (r.count / total) * 100;
              const mine = scope.scoped && r.psgc === scope.psgc;
              const on = selected === r.psgc;
              return (
                <li
                  key={r.psgc}
                  onClick={() => onPick(on ? null : r.psgc)}
                  title={on ? "Back to all barangays" : `Open the ${r.name} report`}
                  className={
                    "cursor-pointer px-4 py-3 transition-colors " +
                    (on ? "bg-brand-50" : "hover:bg-slate-50")
                  }
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-slate-400">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium text-slate-800">
                        {r.name}
                      </span>
                      {mine && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-brand-200 bg-brand-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-brand-700">
                          Your area
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-slate-500">
                        {share.toFixed(share < 10 ? 1 : 0)}%
                      </span>
                      <span className="font-display font-bold tabular-nums text-slate-900">
                        {r.count.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={
                        "h-full rounded-full " +
                        (mine ? "bg-brand-500" : "bg-vigil-400")
                      }
                      style={{ width: `${Math.max(2, (r.count / max) * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {rows.length > AREAS_COLLAPSED && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="w-full border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 text-xs font-semibold text-brand-700 transition hover:bg-slate-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/60"
            >
              {expanded
                ? "Show top 8 only"
                : `Show all ${rows.length} barangays`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

function StatTile({
  icon: Icon,
  iconClass,
  accentClass,
  label,
  value,
  footer,
}: {
  icon: LucideIcon;
  iconClass: string;
  accentClass: string;
  label: string;
  value: string;
  footer?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft transition-shadow hover:shadow-lift">
      <span aria-hidden className={"absolute inset-y-0 left-0 w-1 " + accentClass} />
      <span className={"inline-flex rounded-xl p-2.5 " + iconClass}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-900">
        {value}
      </div>
      {footer && <div className="mt-2 text-xs text-slate-500">{footer}</div>}
    </div>
  );
}

type ChartId = "trend" | "outcome" | "sex" | "site" | "bact" | "drug" | "age";

interface ChartRow {
  /** Short label (axis / legend). */
  label: string;
  /** Long label for readouts and the table; defaults to `label`. */
  title?: string;
  value: number;
  color?: string;
}

/**
 * One chart's data and presentation, shared by its dashboard panel and its
 * detail modal so the two can never disagree.
 */
interface ChartSpec {
  title: string;
  icon: LucideIcon;
  kind: "donut" | "column";
  description: string;
  note?: string;
  /** Rows are in time order, so month-on-month change is meaningful. */
  sequential?: boolean;
  rows: ChartRow[];
  columnProps?: {
    color?: string;
    emphasisColor?: string;
    showAverage?: boolean;
    height?: number;
  };
}

function sliceRows(slices: Slice[]): ChartRow[] {
  return slices.map((s) => ({
    label: s.label,
    title: humanize(s.label),
    value: s.value,
    color: s.color,
  }));
}

function humanize(label: string) {
  if (CATEGORY_LABEL[label]) return CATEGORY_LABEL[label];
  const s = label.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function SpecChart({
  spec,
  size = "md",
  selected = null,
  onSelect,
}: {
  spec: ChartSpec;
  size?: "md" | "lg";
  selected?: number | null;
  onSelect?: (index: number) => void;
}) {
  if (spec.kind === "donut") {
    return (
      <DonutChart
        slices={spec.rows.map((r) => ({
          label: r.label,
          value: r.value,
          color: r.color,
        }))}
        centerLabel="Cases"
        formatLabel={(l) => spec.rows.find((r) => r.label === l)?.title ?? l}
        size={size}
        selected={selected}
        onSelect={onSelect}
      />
    );
  }
  const { height = 200, ...rest } = spec.columnProps ?? {};
  return (
    <ColumnChart
      columns={spec.rows}
      {...rest}
      height={size === "lg" ? Math.max(260, height) : height}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

/**
 * Dashboard card for one chart. The whole body opens the detail modal; a
 * click on a specific slice or column opens it with that item pre-selected.
 */
function Panel({
  spec,
  meta,
  className = "",
  onOpen,
  children,
}: {
  spec: ChartSpec;
  meta?: string;
  className?: string;
  onOpen: (focus: number | null) => void;
  children?: ReactNode;
}) {
  const Icon = spec.icon;
  return (
    <Card
      className={
        "group flex flex-col overflow-hidden p-0 hover:border-brand-300 hover:shadow-lift " +
        className
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-2">
        <div className={"flex min-w-0 items-center gap-1.5 " + MICRO_LABEL}>
          <Icon className="h-3.5 w-3.5 shrink-0 text-brand-600" />
          <span className="truncate">{spec.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta && (
            <span className="hidden truncate font-mono text-[10px] tabular-nums text-slate-500 sm:inline">
              {meta}
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpen(null)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
          >
            <Maximize2 className="h-3 w-3" />
            Details
          </button>
        </div>
      </div>
      <div
        className="flex flex-1 cursor-pointer flex-col justify-center"
        onClick={() => onOpen(null)}
        title="Click for details"
      >
        <SpecChart spec={spec} onSelect={(i) => onOpen(i)} />
      </div>
      {children}
    </Card>
  );
}

function ChartDetailModal({
  id,
  spec,
  focus,
  onFocus,
  onClose,
}: {
  id: ChartId;
  spec: ChartSpec;
  focus: number | null;
  onFocus: (focus: number | null) => void;
  onClose: () => void;
}) {
  const Icon = spec.icon;
  const rows = spec.rows;
  const total = rows.reduce((s, r) => s + r.value, 0);
  const share = (v: number) => (total === 0 ? 0 : (v / total) * 100);
  const fmtShare = (v: number) => {
    const p = share(v);
    return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
  };
  const top = rows.reduce<number | null>(
    (best, r, i) => (best == null || r.value > rows[best].value ? i : best),
    null
  );
  const max = Math.max(1, ...rows.map((r) => r.value));
  const avg = rows.length === 0 ? 0 : total / rows.length;
  const toggle = (i: number) => onFocus(focus === i ? null : i);

  const sel = focus != null ? rows[focus] : null;
  // "vs previous" only means something in time order — next to a category
  // it would compare against whichever row happens to sit above it.
  const prev =
    spec.sequential && focus != null && focus > 0 ? rows[focus - 1] : null;
  const rank =
    sel == null ? 0 : rows.filter((r) => r.value > sel.value).length + 1;

  function exportCsv() {
    const head = spec.sequential
      ? "Month,Cases,% of cases,Change vs previous month"
      : "Category,Cases,% of cases";
    const lines = rows.map((r, i) => {
      const cells = [
        `"${(r.title ?? r.label).replace(/"/g, '""')}"`,
        r.value,
        share(r.value).toFixed(1),
      ];
      if (spec.sequential) cells.push(i === 0 ? "" : r.value - rows[i - 1].value);
      return cells.join(",");
    });
    const blob = new Blob([[head, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bantay-tb-${id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      open
      title={spec.title}
      description={spec.description}
      icon={<Icon className="h-5 w-5" />}
      onClose={onClose}
      className="sm:max-w-4xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {/* Summary strip */}
      <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/40">
        <SummaryStat label="Total cases" value={total.toLocaleString()} />
        <SummaryStat
          label={spec.sequential ? "Highest month" : "Most common"}
          value={top == null ? "—" : rows[top].value.toLocaleString()}
          sub={
            top == null
              ? undefined
              : `${rows[top].title ?? rows[top].label} · ${fmtShare(rows[top].value)} of cases`
          }
        />
        {spec.sequential ? (
          <SummaryStat
            label="Average per month"
            value={avg.toFixed(1)}
            sub={`${rows.length} months`}
          />
        ) : (
          <SummaryStat
            label="Categories"
            value={rows.filter((r) => r.value > 0).length.toString()}
            sub="with at least 1 case"
          />
        )}
      </div>

      <div className="grid gap-0 md:grid-cols-5">
        {/* Chart + selection readout */}
        <div className="border-b border-slate-200 md:col-span-3 md:border-b-0 md:border-r">
          <SpecChart spec={spec} size="lg" selected={focus} onSelect={toggle} />
          <div className="px-4 pb-4">
            {sel ? (
              <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3">
                <span
                  aria-hidden
                  className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                  style={{
                    background:
                      sel.color ?? spec.columnProps?.emphasisColor ?? spec.columnProps?.color,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Selected
                  </div>
                  <div className="font-display text-base font-bold text-slate-900">
                    {sel.title ?? sel.label}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">
                    <strong className="tabular-nums text-slate-900">
                      {sel.value.toLocaleString()}
                    </strong>{" "}
                    case{sel.value === 1 ? "" : "s"} · {fmtShare(sel.value)} of
                    total · {ordinal(rank)}{" "}
                    {spec.sequential
                      ? `highest of ${rows.length} months`
                      : `most common of ${rows.length}`}
                    {prev && (
                      <>
                        {" · "}
                        <DeltaText
                          delta={sel.value - prev.value}
                          vs={prev.title ?? prev.label}
                        />
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onFocus(null)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                >
                  Clear
                </button>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-center text-xs text-slate-500">
                Click a {spec.kind === "donut" ? "slice" : "column"} or a table
                row to inspect it.
              </p>
            )}
          </div>
        </div>

        {/* Data table */}
        <div className="md:col-span-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-semibold">
                  {spec.sequential ? "Month" : "Category"}
                </th>
                <th className="px-2 py-2.5 text-right font-semibold">Cases</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  {spec.sequential ? "Change" : "% of cases"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => {
                const on = focus === i;
                return (
                  <tr
                    key={r.label + i}
                    onClick={() => toggle(i)}
                    aria-selected={on}
                    className={
                      "cursor-pointer transition-colors " +
                      (on ? "bg-brand-50" : "hover:bg-slate-50")
                    }
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {r.color && (
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ background: r.color }}
                          />
                        )}
                        <span
                          className={
                            "truncate " +
                            (on ? "font-semibold text-slate-900" : "text-slate-700")
                          }
                        >
                          {r.title ?? r.label}
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-400"
                          style={{ width: `${(r.value / max) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-display font-bold tabular-nums text-slate-900">
                      {r.value.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-[11px] tabular-nums text-slate-500">
                      {spec.sequential ? (
                        i === 0 ? (
                          "—"
                        ) : (
                          <DeltaText delta={r.value - rows[i - 1].value} />
                        )
                      ) : (
                        fmtShare(r.value)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {spec.note && (
        <p className="flex items-start gap-2 border-t border-slate-200 bg-vigil-300/10 px-5 py-3 text-xs leading-relaxed text-slate-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-vigil-600" />
          {spec.note}
        </p>
      )}
    </Modal>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 font-display text-xl font-extrabold tabular-nums text-slate-900">
        {value}
      </div>
      {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

/** Case-count change. More cases is the bad direction, so it reads in rose. */
function DeltaText({ delta, vs }: { delta: number; vs?: string }) {
  const tone =
    delta > 0 ? "text-rose-700" : delta < 0 ? "text-accent-700" : "text-slate-500";
  return (
    <span className={"font-semibold tabular-nums " + tone}>
      {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "± "}
      {delta}
      {vs && <span className="font-normal text-slate-500"> vs {vs}</span>}
    </span>
  );
}

/**
 * Direction of the caseload. Rising cases are the bad direction here, so
 * "up" wears the warning tone and "down" the favourable one — the arrow and
 * sign carry the meaning too, not just the colour.
 */
function TrendBadge({ pct, suffix }: { pct: number; suffix: string }) {
  const up = pct > 0;
  const flat = pct === 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums " +
          (flat
            ? "bg-slate-100 text-slate-600"
            : up
              ? "bg-rose-50 text-rose-700"
              : "bg-accent-50 text-accent-700")
        }
      >
        {!flat && <Icon className="h-3 w-3" />}
        {up ? "+" : ""}
        {pct}%
      </span>
      {suffix}
    </span>
  );
}
