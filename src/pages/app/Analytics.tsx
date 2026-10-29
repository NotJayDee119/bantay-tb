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
  PieChart,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, Card, Modal, PageHeader, Skeleton } from "../../components/ui";
import { ColumnChart, DonutChart } from "../../components/charts";
import { NEUTRAL, SERIES, toSlices, type Slice } from "../../lib/chartPalette";
import { YearFilter } from "../../components/YearFilter";
import {
  useCaseYear,
  yearOptions,
  type CaseYear,
} from "../../hooks/useCaseYear";
import { useTbCases } from "../../hooks/useTbCases";
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
  byClassification: { label: string; count: number }[];
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
// Mirrors the `tb_classification` DB enum, which still carries the legacy
// drug-susceptibility values alongside the site ones — leaving any out folds
// real cases into "Other".
const CLASS_COLORS: Record<string, string> = {
  drug_sensitive: SERIES[0],
  drug_resistant: SERIES[1],
  pulmonary: SERIES[2],
  extra_pulmonary: SERIES[4],
  presumptive: SERIES[3],
  unknown: NEUTRAL,
  unspecified: NEUTRAL,
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
  const periodLabel = year === "all" ? "All years" : String(year);
  // RLS limits area-scoped staff to their barangay, so these figures describe
  // that area rather than the city — say which one in the subtitle.
  const subtitle =
    `TB cases only · ${periodLabel} · Where to focus screening and contact-tracing campaigns.` +
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
  const data = useMemo<AnalyticsData | null>(() => {
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
        treatment_outcome: c.treatment_outcome,
        reported_at: c.reported_at,
      });
    }
    return summarize(rows, year);
  }, [casesQuery.data, year]);

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
          title="AI Analytics for Outreach"
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
    classification: {
      title: "TB classification",
      icon: PieChart,
      kind: "donut",
      description:
        "Classification as recorded: drug susceptibility (sensitive / resistant) or site of disease, plus presumptive cases from screening.",
      note: "Presumptive cases are screening yield awaiting diagnosis — they are not confirmed TB.",
      rows: sliceRows(toSlices(data.byClassification, CLASS_COLORS)),
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

  return (
    <>
      <PageHeader
        title="AI Analytics for Outreach"
        subtitle={subtitle}
      />
      {yearFilter}

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
        <Panel spec={specs.sex} onOpen={(focus) => setDetail({ id: "sex", focus })} />
        <Panel
          spec={specs.classification}
          onOpen={(focus) => setDetail({ id: "classification", focus })}
        />
        <Panel
          className="md:col-span-2 xl:col-span-1"
          spec={specs.age}
          meta="Years"
          onOpen={(focus) => setDetail({ id: "age", focus })}
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
      <AreaBreakdown rows={data.byBarangay} total={data.total} scope={scope} />
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
  const byClassMap = new Map<string, number>();
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
      }
    }
    const sex = c.sex ?? "unknown";
    bySexMap.set(sex, (bySexMap.get(sex) ?? 0) + 1);

    const cls = c.tb_classification ?? "unspecified";
    byClassMap.set(cls, (byClassMap.get(cls) ?? 0) + 1);

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
    byClassification: toSorted(byClassMap),
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
}: {
  rows: AreaRow[];
  total: number;
  scope: AreaScope;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, AREAS_COLLAPSED);
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card className="mt-4 overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
        <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
          <MapPin className="h-3.5 w-3.5 text-vigil-500" />
          Cases by barangay · where patients live
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
              return (
                <li key={r.psgc} className="px-4 py-3">
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

type ChartId = "trend" | "outcome" | "sex" | "classification" | "age";

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
