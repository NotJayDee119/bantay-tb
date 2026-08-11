import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  HeartPulse,
  Lightbulb,
  MapPin,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, PageHeader, Skeleton } from "../../components/ui";
import { supabase } from "../../lib/supabase";
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
  sex: "male" | "female" | null;
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

export function Analytics() {
  const scope = useAreaScope();
  const [data, setData] = useState<AnalyticsData | null>(null);
  // RLS limits area-scoped staff to their barangay, so these figures describe
  // that area rather than the city — say which one in the subtitle.
  const subtitle =
    "TB cases only · Last 12 months · Where to focus screening and contact-tracing campaigns." +
    areaSuffix(scope);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 12);
      // Scoping is left to RLS, which since 20261007000000 returns the union
      // of "lives in my barangay" and "registered at a facility in my
      // barangay". Re-filtering on barangay_psgc here would drop the cases
      // the local facility registered from these figures.
      const query = supabase
        .from("cases")
        .select(
          "barangay_psgc, age, sex, tb_classification, treatment_outcome, reported_at"
        )
        .eq("disease", "tb")
        .gte("reported_at", since.toISOString())
        .limit(20000);
      const { data: rows } = await query;
      if (cancelled) return;
      setData(summarize((rows ?? []) as RawCase[]));
    })();
    return () => {
      cancelled = true;
    };
  }, [scope.scoped, scope.psgc]);

  if (!data) {
    return (
      <>
        <PageHeader
          title="AI Analytics for Outreach"
          subtitle={subtitle}
        />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
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

  return (
    <>
      <PageHeader
        title="AI Analytics for Outreach"
        subtitle={subtitle}
      />

      {/* ── Headline stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Activity}
          iconClass="bg-brand-50 text-brand-700"
          accentClass="bg-brand-500"
          label="Cases · 12 months"
          value={data.total.toLocaleString()}
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
          Heuristics derived from the rolling 12-month case set. Combine with
          local epidemiologic context before finalising campaign targets.
        </p>
      </Card>

      {/* ── Per-area breakdown ───────────────────────────────────────── */}
      <AreaBreakdown rows={data.byBarangay} total={data.total} scope={scope} />

      {/* ── Distribution charts ──────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Cases by month"
          icon={BarChart3}
          bars={data.byMonth.map((m) => ({ label: m.month, value: m.count }))}
        />
        <ChartCard
          title="Age distribution"
          icon={Users}
          bars={data.byAgeBand.map((m) => ({ label: m.band, value: m.count }))}
        />
        <ChartCard
          title="By sex"
          icon={Users}
          bars={data.bySex.map((m) => ({ label: m.label, value: m.count }))}
        />
        <ChartCard
          title="TB classification"
          icon={BarChart3}
          bars={data.byClassification.map((m) => ({
            label: m.label.replace(/_/g, " "),
            value: m.count,
          }))}
        />
        <ChartCard
          title="Treatment outcome"
          icon={BarChart3}
          bars={data.byOutcome.map((m) => ({
            label: m.label.replace(/_/g, " "),
            value: m.count,
          }))}
        />
      </div>
    </>
  );
}

function summarize(rows: RawCase[]): AnalyticsData {
  const byMonthMap = new Map<string, number>();
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

    const dt = new Date(c.reported_at);
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
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
      `Lost-to-follow-up rate is ${Math.round((lost / d.total) * 100)}% — prioritise SMS adherence reminders and BHW home visits.`
    );
  }

  // Trend (recent vs prior 6 months)
  if (d.byMonth.length >= 6) {
    const split = Math.floor(d.byMonth.length / 2);
    const prior = d.byMonth.slice(0, split).reduce((s, m) => s + m.count, 0);
    const recent = d.byMonth.slice(split).reduce((s, m) => s + m.count, 0);
    if (prior > 0 && recent / prior >= 1.2) {
      const pct = Math.round(((recent - prior) / prior) * 100);
      out.push(
        `Case load is up ${pct}% in the recent half vs the prior half — re-run DBSCAN with a tighter eps and notify barangay leaders.`
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
          No cases in the last 12 months, so there is no area to rank.
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
  footer?: string;
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
      {footer && <p className="mt-2 text-xs text-slate-500">{footer}</p>}
    </div>
  );
}

function ChartCard({
  title,
  icon: Icon,
  bars,
}: {
  title: string;
  icon: LucideIcon;
  bars: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
        <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
          <Icon className="h-3.5 w-3.5 text-brand-600" />
          {title}
        </div>
        {bars.length > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-slate-500">
            {bars.length} {bars.length === 1 ? "group" : "groups"}
          </span>
        )}
      </div>
      {bars.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">No data.</p>
      ) : (
        <ul className="space-y-3 p-4">
          {bars.map((b) => (
            <li key={b.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium capitalize text-slate-800">
                  {b.label}
                </span>
                <span className="font-display font-bold tabular-nums text-slate-900">
                  {b.value.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.max(2, (b.value / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
