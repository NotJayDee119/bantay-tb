import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  CalendarClock,
  ClipboardList,
  Flame,
  MapPin,
  MapPinned,
  Pill,
  Sun,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { Badge, Card, PageHeader, Skeleton } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { useAreaScope } from "../../hooks/useAreaScope";
import { areaSuffix, type AreaScope } from "../../lib/areaScope";
import type { AppRole } from "../../lib/supabase";
import barangays from "../../data/barangays.json";
import {
  computeHotspotInsights,
  type CaseAttribution,
  type FacilityRow,
  type HotspotCaseRow,
  type HotspotCluster,
  type HotspotInsights,
} from "../../lib/hotspotUtils";
import { useCaseAttribution } from "../../hooks/useCaseAttribution";
import { useDotsCenters, useTbCases } from "../../hooks/useTbCases";
import { HealthWorkerHome } from "./HealthWorkerHome";
import { CoordinatorHome, type OutcomeStats } from "./CoordinatorHome";
import { YearFilter } from "../../components/YearFilter";
import {
  useCaseYear,
  yearOptions,
  type CaseYear,
} from "../../hooks/useCaseYear";

const TOTAL_BARANGAYS = (barangays as { psgc: number }[]).length;

interface DashboardCaseRow extends HotspotCaseRow {
  id: number | string;
  treatment_outcome?: string | null;
}

// Outcomes that mean treatment has ended, one way or another. "Ongoing" is
// left out so patients still mid-treatment don't drag the success rate down.
const FINISHED = new Set([
  "cured",
  "completed",
  "failed",
  "died",
  "lost_to_followup",
  "not_evaluated",
]);

type IndicatorLevel =
  | "very-high"
  | "high"
  | "mid"
  | "low"
  | "very-low"
  | "none";

interface IndicatorMeta {
  level: IndicatorLevel;
  label: string;
  dotClass: string;
  pillClass: string;
}

function indicatorFor(caseCount: number, maxCount: number): IndicatorMeta {
  if (!maxCount || caseCount <= 0) {
    return {
      level: "none",
      label: "No data",
      dotClass: "bg-slate-300",
      pillClass: "bg-slate-100 text-slate-600",
    };
  }
  const ratio = caseCount / maxCount;
  if (ratio >= 0.8) {
    return {
      level: "very-high",
      label: "Very high",
      dotClass: "bg-red-700",
      pillClass: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-100",
    };
  }
  if (ratio >= 0.6) {
    return {
      level: "high",
      label: "High",
      dotClass: "bg-red-500",
      pillClass:
        "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-100",
    };
  }
  if (ratio >= 0.4) {
    return {
      level: "mid",
      label: "Mid",
      dotClass: "bg-amber-500",
      pillClass:
        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100",
    };
  }
  if (ratio >= 0.2) {
    return {
      level: "low",
      label: "Low",
      dotClass: "bg-sky-500",
      pillClass: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100",
    };
  }
  return {
    level: "very-low",
    label: "Very low",
    dotClass: "bg-emerald-500",
    pillClass:
      "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
  };
}

interface DashboardStats {
  totalCases: number;
  yoyChangePct: number | null;
  activeHotspots: number;
  barangaysWithCases: number;
  detectionRatePct: number;
  lastUpload: Date | null;
  rowCount: number;
  /** Cases in the last `insights.recentWindowDays` days, ignoring the year filter. */
  liveRecentCases: number;
  /** Treatment outcomes of the counted (year-filtered) cases. */
  outcomes: OutcomeStats;
  /** Earliest year with any case, for the year filter's options. */
  earliestYear: number | null;
  /** Newest year with any case. */
  latestYear: number | null;
  /** The year `yoyChangePct` compares against. */
  yoyBaseYear: number;
  insights: HotspotInsights;
  topBarangays: {
    psgc: number;
    name: string;
    caseCount: number;
    recentCases: number;
    indicator: IndicatorMeta;
  }[];
}

function reportedYear(c: DashboardCaseRow): number | null {
  const raw = c.reported_at ?? c.created_at;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getFullYear() : null;
}

function buildStats(
  rows: DashboardCaseRow[],
  attribution: CaseAttribution,
  facilities: FacilityRow[],
  year: CaseYear
): DashboardStats {
  // The year filter narrows what is counted and ranked. Data freshness (last
  // upload) and "new in the last 30 days" stay on the full set — they describe
  // now, and would read as zero for any past year.
  const counted =
    year === "all" ? rows : rows.filter((c) => reportedYear(c) === year);

  const outcomes: OutcomeStats = {
    finished: 0,
    favourable: 0,
    lostToFollowUp: 0,
    ongoing: 0,
  };
  for (const c of counted) {
    const o = c.treatment_outcome ?? "";
    if (FINISHED.has(o)) outcomes.finished += 1;
    if (o === "cured" || o === "completed") outcomes.favourable += 1;
    if (o === "lost_to_followup") outcomes.lostToFollowUp += 1;
    if (o === "ongoing") outcomes.ongoing += 1;
  }

  // Same axis the GIS map is drawing on. Without both arguments this silently
  // falls back to residence, which is what used to put the two pages' barangay
  // rankings out of step.
  const insights = computeHotspotInsights(counted, { attribution, facilities });

  let earliestYear: number | null = null;
  let latestYear: number | null = null;
  for (const c of rows) {
    const y = reportedYear(c);
    if (y == null) continue;
    if (earliestYear == null || y < earliestYear) earliestYear = y;
    if (latestYear == null || y > latestYear) latestYear = y;
  }

  // Year-over-year change: the selected year vs the one before it. For "all"
  // it is the newest year with data, not the calendar year — a dataset that
  // ends in 2025 would otherwise read as "-100% in 2026".
  const now = new Date();
  const currentYear = year === "all" ? latestYear ?? now.getFullYear() : year;
  const lastYear = currentYear - 1;
  const recentCutoff = now.getTime() - insights.recentWindowDays * 86_400_000;
  let thisYearCount = 0;
  let lastYearCount = 0;
  let latestUpload = 0;
  let liveRecentCases = 0;
  for (const c of rows) {
    const y = reportedYear(c);
    if (y != null) {
      if (y === currentYear) thisYearCount += 1;
      else if (y === lastYear) lastYearCount += 1;
      const t = new Date((c.reported_at ?? c.created_at)!).getTime();
      if (t >= recentCutoff) liveRecentCases += 1;
    }
    const createdRaw = c.created_at ?? c.reported_at;
    if (createdRaw) {
      const t = new Date(createdRaw).getTime();
      if (Number.isFinite(t) && t > latestUpload) latestUpload = t;
    }
  }

  const yoyChangePct =
    lastYearCount > 0
      ? ((thisYearCount - lastYearCount) / lastYearCount) * 100
      : null;

  const maxCaseCount = insights.barangayStats[0]?.caseCount ?? 0;
  const topBarangays = insights.barangayStats.map((b) => ({
    psgc: b.psgc,
    name: b.name,
    caseCount: b.caseCount,
    recentCases: b.recentCases,
    indicator: indicatorFor(b.caseCount, maxCaseCount),
  }));

  return {
    totalCases: insights.totalCases,
    yoyChangePct,
    activeHotspots: insights.clusters.length,
    barangaysWithCases: insights.barangayStats.length,
    detectionRatePct:
      TOTAL_BARANGAYS > 0
        ? Math.round((insights.barangayStats.length / TOTAL_BARANGAYS) * 100)
        : 0,
    lastUpload: latestUpload > 0 ? new Date(latestUpload) : null,
    rowCount: rows.length,
    liveRecentCases,
    outcomes,
    earliestYear,
    latestYear,
    yoyBaseYear: lastYear,
    insights,
    topBarangays,
  };
}

function formatYoy(pct: number | null): {
  text: string;
  positive: boolean | null;
} {
  if (pct === null) return { text: "No prior year", positive: null };
  const sign = pct > 0 ? "+" : "";
  return { text: `${sign}${pct.toFixed(1)}%`, positive: pct >= 0 };
}

function formatUpload(d: Date | null): string {
  if (!d) return "Never";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function Dashboard() {
  const { profile } = useAuth();
  const scope = useAreaScope();
  const role = profile?.role;

  const [attribution, setAttribution] = useCaseAttribution();
  const [year, setYear] = useCaseYear();
  // The rows and the facility list come from the shared, cached register
  // (useTbCases) — the GIS map reads the same copy, so moving between the two
  // doesn't download 7,000+ rows again. Switching the axis or the year is a
  // different way of counting the same cases, not a different query.
  const staff = !!role && role !== "patient";
  const casesQuery = useTbCases(staff);
  const centersQuery = useDotsCenters(staff);
  const caseRows = casesQuery.data ?? null;
  const facilities = useMemo(() => centersQuery.data ?? [], [centersQuery.data]);
  const loading = staff && (casesQuery.isPending || centersQuery.isPending);
  const [showHotspotsModal, setShowHotspotsModal] = useState(false);

  const stats = useMemo(
    () =>
      caseRows ? buildStats(caseRows, attribution, facilities, year) : null,
    [caseRows, attribution, facilities, year]
  );
  // "Last 30 days" per barangay is only worth a column when something
  // actually happened in the last 30 days and the view includes today.
  const showRecent =
    (year === "all" || year === new Date().getFullYear()) &&
    (stats?.liveRecentCases ?? 0) > 0;


  // Lock body scroll while the hotspots modal is open.
  useEffect(() => {
    if (!showHotspotsModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showHotspotsModal]);

  const assignedAreaName = scope.name;

  const subtitle = useMemo(
    () => SUBTITLE[role ?? "patient"] + areaSuffix(scope),
    [role, scope]
  );

  return (
    <>
      {/* Health workers get their own greeting inside HealthWorkerHome. */}
      {role !== "patient" &&
        role !== "health_worker" &&
        role !== "tb_coordinator" && (
        <PageHeader
          title={`Welcome${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!`}
          subtitle={subtitle}
        />
      )}

      {scope.scoped && assignedAreaName && role !== "health_worker" && (
          <div className="mb-4">
            <Card className="flex items-center gap-3 border-brand-100 bg-brand-50/40 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-100 text-brand-700">
                <MapPinned className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  Coverage area
                </div>
                <div className="text-base font-semibold text-slate-900">
                  {assignedAreaName}
                </div>
                <p className="text-xs text-slate-600">
                  {stats && stats.totalCases > 0 ? (
                    <>
                      You are tracking{" "}
                      <span className="font-semibold text-slate-900">
                        {stats.totalCases}
                      </span>{" "}
                      case{stats.totalCases === 1 ? "" : "s"} from this area.
                    </>
                  ) : (
                    "No cases recorded for this area yet."
                  )}
                </p>
              </div>
            </Card>
          </div>
        )}

      {role !== "patient" && stats && (
        <YearFilter
          className="mb-5"
          value={year}
          years={yearOptions(stats.earliestYear, stats.latestYear, year)}
          onChange={setYear}
        />
      )}

      {role === "patient" ? (
        <PatientDashboard name={profile?.full_name ?? null} />
      ) : loading ? (
        <div className="space-y-6">
          <Skeleton className="h-56 rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      ) : !stats || casesQuery.isError ? (
        <Card className="p-6 text-sm text-slate-600">
          We couldn&apos;t load case data right now. Please refresh in a
          moment.
        </Card>
      ) : role === "health_worker" && profile ? (
        <HealthWorkerHome
          year={year}
          userId={profile.id}
          firstName={profile.full_name?.trim().split(/\s+/)[0] ?? null}
          scope={scope}
          totalCases={stats.totalCases}
          recentCases={stats.liveRecentCases}
          recentWindowDays={stats.insights.recentWindowDays}
          activeHotspots={stats.activeHotspots}
          lastUpload={stats.lastUpload}
          onOpenHotspots={() => setShowHotspotsModal(true)}
          areaTable={
            <BarangayTable
              rows={stats.topBarangays}
              scope={scope}
              attribution={attribution}
              onAttributionChange={setAttribution}
              showRecent={showRecent}
            />
          }
        />
      ) : role === "tb_coordinator" && profile ? (
        <CoordinatorHome
          year={year}
          outcomes={stats.outcomes}
          yoyBaseYear={stats.yoyBaseYear}
          userId={profile.id}
          firstName={profile.full_name?.trim().split(/\s+/)[0] ?? null}
          totalCases={stats.totalCases}
          yoyChangePct={stats.yoyChangePct}
          barangaysWithCases={stats.barangaysWithCases}
          totalBarangays={TOTAL_BARANGAYS}
          recentCases={stats.liveRecentCases}
          recentWindowDays={stats.insights.recentWindowDays}
          activeHotspots={stats.activeHotspots}
          lastUpload={stats.lastUpload}
          onOpenHotspots={() => setShowHotspotsModal(true)}
          areaTable={
            <BarangayTable
              rows={stats.topBarangays}
              scope={scope}
              attribution={attribution}
              onAttributionChange={setAttribution}
              showRecent={showRecent}
            />
          }
        />
      ) : (
        <SurveillanceDashboard
          stats={stats}
          year={year}
          onOpenHotspots={() => setShowHotspotsModal(true)}
          scope={scope}
          attribution={attribution}
          onAttributionChange={setAttribution}
        />
      )}

      {stats && showHotspotsModal && (
        <HotspotsModal
          clusters={stats.insights.clusters}
          onClose={() => setShowHotspotsModal(false)}
        />
      )}
    </>
  );
}

const SUBTITLE: Record<AppRole, string> = {
  system_admin:
    "Central administration — monitor system-wide data, manage users and area assignments.",
  tb_coordinator: "City-wide TB surveillance overview.",
  barangay_admin:
    "Frontline tools for case finding, monitoring trends, and acting on hotspot alerts.",
  health_worker:
    "Clinical decision support, adherence and alert monitoring, GIS heatmap, and outreach analytics.",
  patient:
    "Welcome to BANTAY-TB. Track your medication, learn about TB, and chat with our health assistant.",
};

const QUICK_ACTIONS = [
  { to: "/app/map", label: "GIS Map", icon: MapPinned },
  { to: "/app/hotspots", label: "Hotspots", icon: Flame },
  { to: "/app/cases", label: "Cases (ACF)", icon: ClipboardList },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
];

function SurveillanceDashboard({
  stats,
  year,
  onOpenHotspots,
  scope,
  attribution,
  onAttributionChange,
}: {
  stats: DashboardStats;
  year: CaseYear;
  onOpenHotspots: () => void;
  scope: AreaScope;
  attribution: CaseAttribution;
  onAttributionChange: (next: CaseAttribution) => void;
}) {
  const yoy = formatYoy(stats.yoyChangePct);
  const scopeLabel = scope.scoped ? (scope.name ?? "Assigned area") : "City-wide";
  const areaName = scope.name ?? "your assigned area";

  // An area-scoped account whose barangay has no cases would otherwise get a
  // wall of zeroes — 0 headline, 0 hotspots, 0 recent, 0%-share table — which
  // reads as a broken dashboard rather than an accurate one. Say it once,
  // plainly, and keep the upload provenance so they can tell "nothing here"
  // apart from "data never arrived".
  if (scope.scoped && stats.totalCases === 0) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-brand-900 bg-brand-950 p-6 text-white shadow-soft sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-60"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/10 blur-3xl"
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                {scopeLabel} TB surveillance
              </p>
              <div className="mt-4 flex items-start gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-2xl font-bold leading-tight tracking-tight text-white">
                    No cases in this area
                  </p>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-400">
                    No TB cases have been recorded for{" "}
                    <span className="font-semibold text-slate-300">
                      {areaName}
                    </span>
                    . Cases encoded or imported for this barangay will appear
                    here automatically.
                  </p>
                </div>
              </div>
            </div>
            <QuickActions />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            icon={<Upload className="h-5 w-5" />}
            iconClass="bg-brand-50 text-brand-700"
            accentClass="bg-brand-500"
            label="Last upload"
            value={formatUpload(stats.lastUpload)}
            footer={
              <span className="text-slate-500">
                CHO records · {stats.rowCount.toLocaleString()} rows
              </span>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Command band — headline surveillance figure + quick actions ── */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-900 bg-brand-950 p-6 text-white shadow-soft sm:p-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-60" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vigil-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-vigil-400" />
              </span>
              Live &middot; {scopeLabel} TB surveillance
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <span className="font-display text-5xl font-black leading-none tracking-tight text-white sm:text-6xl">
                {stats.totalCases.toLocaleString()}
              </span>
              {yoy.positive === null ? (
                <span className="mb-1.5 font-mono text-xs uppercase tracking-wider text-slate-400">
                  {yoy.text}
                </span>
              ) : (
                <span
                  className={
                    "mb-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold " +
                    (yoy.positive
                      ? "bg-red-500/15 text-red-300"
                      : "bg-accent-500/15 text-accent-300")
                  }
                >
                  {yoy.positive ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {yoy.text} vs {stats.yoyBaseYear}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {scope.scoped ? (
                <>
                  TB cases {year === "all" ? "" : `in ${year} `}in{" "}
                  <span className="font-semibold text-slate-200">
                    {scope.name ?? "your assigned area"}
                  </span>
                  .
                </>
              ) : (
                <>
                  TB cases {year === "all" ? "" : `in ${year} `}across{" "}
                  <span className="font-semibold text-slate-200">
                    {stats.barangaysWithCases}
                  </span>{" "}
                  barangays.
                </>
              )}
            </p>
          </div>

          <QuickActions />
        </div>
      </div>

      {/* ── Stat bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={onOpenHotspots}
          className="text-left"
          aria-label={`View ${stats.activeHotspots} active hotspot${stats.activeHotspots === 1 ? "" : "s"}`}
        >
          <StatTile
            icon={<Flame className="h-5 w-5" />}
            iconClass="bg-red-50 text-red-600"
            accentClass="bg-red-500"
            label="Active hotspots"
            value={stats.activeHotspots.toLocaleString()}
            footer={
              <span className="inline-flex items-center gap-1 font-medium text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Areas with concentrated cases — click to inspect
              </span>
            }
            interactive
          />
        </button>

        {/* "Detection rate" is barangays-with-cases over all 182 — a citywide
            coverage measure. For a single-barangay account it collapses to
            1/182 ≈ 1%, which reads as a failure rather than a statistic. Show
            them recent caseload instead, which is what they can act on. */}
        {scope.scoped ? (
          <StatTile
            icon={<Activity className="h-5 w-5" />}
            iconClass="bg-accent-50 text-accent-600"
            accentClass="bg-accent-500"
            label={`Cases · last ${stats.insights.recentWindowDays}d`}
            value={stats.liveRecentCases.toLocaleString()}
            footer={
              <span className="text-slate-500">
                Within {scope.name ?? "your assigned area"}
              </span>
            }
          />
        ) : (
          <StatTile
            icon={<Activity className="h-5 w-5" />}
            iconClass="bg-accent-50 text-accent-600"
            accentClass="bg-accent-500"
            label="Detection rate"
            value={`${stats.detectionRatePct}%`}
            footer={
              <span className="text-slate-500">
                {stats.barangaysWithCases} of {TOTAL_BARANGAYS} barangays covered
              </span>
            }
          />
        )}

        <StatTile
          icon={<Upload className="h-5 w-5" />}
          iconClass="bg-brand-50 text-brand-700"
          accentClass="bg-brand-500"
          label="Last upload"
          value={formatUpload(stats.lastUpload)}
          footer={
            <span className="text-slate-500">
              CHO records · {stats.rowCount.toLocaleString()} rows
            </span>
          }
        />
      </div>

      {/* Top barangay table with indicator labels. Area-scoped accounts get a
          single-row variant covering just their assigned barangay. */}
      <BarangayTable
        rows={stats.topBarangays}
        scope={scope}
        attribution={attribution}
        onAttributionChange={onAttributionChange}
        showRecent={
          (year === "all" || year === new Date().getFullYear()) &&
          stats.liveRecentCases > 0
        }
      />
    </div>
  );
}

function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
      {QUICK_ACTIONS.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-200 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/10 hover:text-white"
        >
          <a.icon className="h-4 w-4 shrink-0 text-accent-400" />
          <span className="truncate">{a.label}</span>
          <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 -translate-x-1 text-slate-500 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </Link>
      ))}
    </div>
  );
}

function StatTile({
  icon,
  iconClass,
  accentClass = "bg-slate-300",
  label,
  value,
  footer,
  interactive = false,
}: {
  icon: React.ReactNode;
  iconClass: string;
  accentClass?: string;
  label: string;
  value: string;
  footer?: React.ReactNode;
  interactive?: boolean;
}) {
  return (
    <div
      className={
        "group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft transition-all duration-300 " +
        (interactive ? "cursor-pointer hover:-translate-y-1 hover:shadow-lift" : "hover:shadow-lift")
      }
    >
      <span
        aria-hidden
        className={"absolute inset-y-0 left-0 w-1 " + accentClass}
      />
      <div className="flex items-center justify-between">
        <span className={`inline-flex rounded-xl p-2.5 ${iconClass}`}>
          {icon}
        </span>
        {interactive && (
          <ArrowRight className="h-4 w-4 -translate-x-1 text-slate-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        )}
      </div>
      <div className="mt-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="font-display mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
        {value}
      </div>
      {footer && <div className="mt-2 text-xs">{footer}</div>}
    </div>
  );
}

function BarangayTable({
  rows,
  scope,
  attribution,
  onAttributionChange,
  showRecent = true,
}: {
  rows: DashboardStats["topBarangays"];
  scope: AreaScope;
  attribution: CaseAttribution;
  onAttributionChange: (next: CaseAttribution) => void;
  /** Off for a past year, where "last 30 days" would be a column of zeros. */
  showRecent?: boolean;
}) {
  const maxCount = rows[0]?.caseCount ?? 0;
  // Share and Status are both measured against the worst-hit barangay in the
  // set. With a single scoped row that comparison is against itself, so the
  // bar is always 100% full and the status always reads "Very high". Drop
  // both columns there and keep the counts, which mean the same thing either
  // way. The rank number goes too — there's nothing to rank against.
  const comparative = !scope.scoped;
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <MapPin className="h-4 w-4 text-brand-600" /> Cases by barangay
          </div>
          {/* Which axis produced these numbers, spelled out. The same barangay
              legitimately holds two different totals, and a table that doesn't
              say which one it is showing is how the Dashboard and the map came
              to look like they disagreed. */}
          <p className="mt-0.5 text-xs text-slate-500">
            {attribution === "facility"
              ? "Counting each case where it was registered"
              : "Counting each case where the patient lives"}
            {comparative ? " · most affected first." : " · your assigned area."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Same control, same wording as the GIS map's — and the same
              setting behind it, so switching here moves the map too. */}
          <div
            role="group"
            aria-label="Count cases by"
            className="flex rounded-lg bg-slate-100 p-0.5"
          >
            {(
              [
                ["facility", "Registered at"],
                ["residence", "Lives in"],
              ] as [CaseAttribution, string][]
            ).map(([key, label]) => {
              const on = attribution === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onAttributionChange(key)}
                  aria-pressed={on}
                  className={
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 " +
                    (on
                      ? "bg-white text-brand-700 shadow-soft"
                      : "text-slate-500 hover:text-slate-700")
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          {comparative ? (
            <Badge tone="info">{rows.length} active</Badge>
          ) : (
            scope.name && <Badge tone="info">{scope.name}</Badge>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {scope.unassigned
            ? "No area assigned to your account yet."
            : "No cases recorded yet."}
        </p>
      ) : (
        <div className="max-h-[30rem] overflow-y-auto overscroll-contain">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
              <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pl-5 pr-2 text-left font-semibold">
                  Barangay
                </th>
                {comparative && (
                  <th className="hidden w-[34%] px-3 text-left font-semibold sm:table-cell">
                    Share
                  </th>
                )}
                <th className="px-3 text-right font-semibold">Total</th>
                {showRecent && (
                  <th
                    className={
                      "px-3 text-right font-semibold " +
                      (comparative ? "" : "pr-5")
                    }
                  >
                    Last 30 days
                  </th>
                )}
                {comparative && (
                  <th className="py-2.5 pl-2 pr-5 text-right font-semibold">
                    Status
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((b, i) => {
                const pct =
                  maxCount > 0 ? Math.max(4, (b.caseCount / maxCount) * 100) : 0;
                return (
                  <tr
                    key={b.psgc}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    <td className="py-3 pl-5 pr-2">
                      <div className="flex items-center gap-2.5">
                        {comparative && (
                          <span
                            className={
                              "grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-[11px] font-bold " +
                              (i < 3
                                ? "bg-brand-950 text-white"
                                : "bg-slate-100 text-slate-500")
                            }
                          >
                            {i + 1}
                          </span>
                        )}
                        <span className="font-medium text-slate-800">
                          {b.name}
                        </span>
                      </div>
                    </td>
                    {comparative && (
                      <td className="hidden px-3 sm:table-cell">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={
                              "h-full rounded-full " + b.indicator.dotClass
                            }
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    )}
                    <td className="px-3 text-right font-display font-bold tabular-nums text-slate-900">
                      {b.caseCount}
                    </td>
                    {showRecent && (
                      <td
                        className={
                          "px-3 text-right tabular-nums text-slate-600 " +
                          (comparative ? "" : "pr-5")
                        }
                      >
                        {b.recentCases}
                      </td>
                    )}
                    {comparative && (
                      <td className="py-3 pl-2 pr-5 text-right">
                        <span
                          className={
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold " +
                            b.indicator.pillClass
                          }
                        >
                          <span
                            className={
                              "h-1.5 w-1.5 rounded-full " + b.indicator.dotClass
                            }
                          />
                          {b.indicator.label}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function HotspotsModal({
  clusters,
  onClose,
}: {
  clusters: HotspotCluster[];
  onClose: () => void;
}) {
  // Close on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const sorted = useMemo(
    () => [...clusters].sort((a, b) => b.caseCount - a.caseCount),
    [clusters]
  );

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hotspots-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2
              id="hotspots-modal-title"
              className="font-display text-lg font-bold tracking-tight text-slate-900"
            >
              Active hotspots
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {sorted.length} area{sorted.length === 1 ? "" : "s"} with a high
              concentration of TB cases, grouped by DBSCAN.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {sorted.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No active hotspots. Cases are spread out enough that no area
              reaches the concentration threshold DBSCAN looks for.
            </p>
          ) : (
            <ul className="space-y-3">
              {sorted.map((cluster) => (
                <li
                  key={cluster.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base font-semibold text-slate-900">
                          Hotspot #{cluster.id + 1}
                        </span>
                        <SeverityBadge severity={cluster.severity} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <ClipboardList className="h-3.5 w-3.5" />
                          {cluster.caseCount} case
                          {cluster.caseCount === 1 ? "" : "s"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {cluster.radiusKm.toFixed(2)} km radius
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {cluster.centroid.lat.toFixed(4)},{" "}
                          {cluster.centroid.lon.toFixed(4)}
                        </span>
                      </div>
                    </div>
                    {cluster.barangays.length > 0 && (
                      <Link
                        to={`/app/map?focus=${encodeURIComponent(cluster.barangays[0].name)}`}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-700"
                      >
                        View on map
                      </Link>
                    )}
                  </div>
                  {cluster.barangays.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {cluster.barangays.slice(0, 6).map((b) => (
                        <span
                          key={b.psgc}
                          className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-700 ring-1 ring-inset ring-slate-200"
                        >
                          {b.name} · {b.count}
                        </span>
                      ))}
                      {cluster.barangays.length > 6 && (
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">
                          +{cluster.barangays.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-3">
          <Link
            to="/app/hotspots"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700"
            onClick={onClose}
          >
            Open hotspots page
          </Link>
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: HotspotCluster["severity"] }) {
  if (severity === "urgent") return <Badge tone="danger">Urgent</Badge>;
  if (severity === "high") return <Badge tone="danger">High</Badge>;
  if (severity === "moderate" || severity === "medium")
    return <Badge tone="warning">{severity === "moderate" ? "Moderate" : "Medium"}</Badge>;
  return <Badge tone="info">Watch</Badge>;
}

/**
 * Patient home — friendly, nursery-style landing that matches the patient
 * Adherence and Health Education pages: pastel hero + big colorful tiles.
 */
function PatientDashboard({ name }: { name: string | null }) {
  const firstName = (name ?? "").trim().split(/\s+/)[0] || "friend";
  const tiles = [
    {
      to: "/app/adherence",
      label: "My medicine",
      blurb: "Tap when you take your dose and earn stars!",
      icon: Pill,
      card: "border-emerald-200 bg-emerald-50 hover:border-emerald-300",
      iconBg: "bg-emerald-500",
      arrow: "text-emerald-400",
    },
    {
      to: "/app/chatbot",
      label: "Ask a question",
      blurb: "Chat in English, Filipino, o Cebuano — anytime.",
      icon: Bot,
      card: "border-sky-200 bg-sky-50 hover:border-sky-300",
      iconBg: "bg-sky-500",
      arrow: "text-sky-400",
    },
    {
      to: "/app/education",
      label: "Learn & grow",
      blurb: "Easy step-by-step guides about TB and getting better.",
      icon: BookOpen,
      card: "border-pink-200 bg-pink-50 hover:border-pink-300",
      iconBg: "bg-pink-500",
      arrow: "text-pink-400",
    },
  ];
  return (
    <div className="space-y-6">
      {/* ── Hero — warm welcome ──────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-sky-200 bg-gradient-to-br from-sky-100 via-emerald-50 to-amber-100 p-5 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-200/50 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-emerald-200/50 blur-2xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-sky-700 shadow-soft">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            Your health home
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Hi, {firstName}!
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-700 sm:text-base">
            Every day you take your medicine, you get closer to feeling great.
            What would you like to do today?
          </p>
        </div>
      </section>

      {/* ── Big friendly tiles — tap to open each area ───────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={
              "group block rounded-3xl border-2 p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-lift active:scale-[0.98] " +
              t.card
            }
          >
            <div className="flex items-start justify-between">
              <span
                className={
                  "grid h-12 w-12 place-items-center rounded-2xl text-white shadow-soft " +
                  t.iconBg
                }
              >
                <t.icon className="h-6 w-6" />
              </span>
              <span
                className={
                  "grid h-8 w-8 place-items-center rounded-full bg-white/70 transition-transform group-hover:translate-x-0.5 " +
                  t.arrow
                }
              >
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4 font-display text-lg font-extrabold tracking-tight text-slate-900">
              {t.label}
            </div>
            <div className="mt-1 text-sm font-medium text-slate-600">
              {t.blurb}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
