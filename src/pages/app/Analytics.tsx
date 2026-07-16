import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  HeartPulse,
  Lightbulb,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, PageHeader, Skeleton } from "../../components/ui";
import { supabase } from "../../lib/supabase";

interface RawCase {
  age: number | null;
  sex: "male" | "female" | null;
  tb_classification: string | null;
  treatment_outcome: string | null;
  reported_at: string;
}

interface AnalyticsData {
  total: number;
  byMonth: { month: string; count: number }[];
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
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 12);
      const { data: rows } = await supabase
        .from("cases")
        .select("age, sex, tb_classification, treatment_outcome, reported_at")
        .eq("disease", "tb")
        .gte("reported_at", since.toISOString())
        .limit(20000);
      if (cancelled) return;
      setData(summarize((rows ?? []) as RawCase[]));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return (
      <>
        <PageHeader
          title="AI Analytics for Outreach"
          subtitle="TB cases only · Last 12 months · Where to focus screening and contact-tracing campaigns."
        />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
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
        subtitle="TB cases only · Last 12 months · Where to focus screening and contact-tracing campaigns."
      />

      {/* ── Headline stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          icon={Activity}
          iconClass="bg-brand-50 text-brand-700"
          accentClass="bg-brand-500"
          label="Cases · 12 months"
          value={data.total.toLocaleString()}
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
  const byAgeBand = AGE_BANDS.map((b) => ({ band: b.label, count: 0 }));
  const bySexMap = new Map<string, number>();
  const byClassMap = new Map<string, number>();
  const byOutcomeMap = new Map<string, number>();

  for (const c of rows) {
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

  return {
    total: rows.length,
    byMonth,
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
