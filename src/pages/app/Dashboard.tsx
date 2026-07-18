import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import type { AppRole } from "../../lib/supabase";
import barangays from "../../data/barangays.json";
import {
  computeHotspotInsights,
  type HotspotCaseRow,
  type HotspotCluster,
  type HotspotInsights,
} from "../../lib/hotspotUtils";

const TOTAL_BARANGAYS = (barangays as { psgc: number }[]).length;

interface DashboardCaseRow extends HotspotCaseRow {
  id: number | string;
}

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
  insights: HotspotInsights;
  topBarangays: {
    psgc: number;
    name: string;
    caseCount: number;
    recentCases: number;
    indicator: IndicatorMeta;
  }[];
}

function buildStats(rows: DashboardCaseRow[]): DashboardStats {
  const insights = computeHotspotInsights(rows);

  // Year-over-year change (current year vs previous year reported_at).
  const now = new Date();
  const currentYear = now.getFullYear();
  const lastYear = currentYear - 1;
  let thisYearCount = 0;
  let lastYearCount = 0;
  let latestUpload = 0;
  for (const c of rows) {
    const reportedRaw = c.reported_at ?? c.created_at;
    const reported = reportedRaw ? new Date(reportedRaw) : null;
    if (reported && !Number.isNaN(reported.getTime())) {
      const y = reported.getFullYear();
      if (y === currentYear) thisYearCount += 1;
      else if (y === lastYear) lastYearCount += 1;
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
  const role = profile?.role;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHotspotsModal, setShowHotspotsModal] = useState(false);
  const cancelRef = useRef(false);

  const fetchData = useCallback(async () => {
    // Supabase imposes a default 1000-row response cap; page through it so we
    // never undercount when the dataset grows past that limit.
    const pageSize = 1000;
    const all: DashboardCaseRow[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "id, barangay_psgc, reported_at, created_at, tb_classification, jitter_lat, jitter_lon"
        )
        .eq("disease", "tb")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (cancelRef.current) return;
      if (error || !data) {
        if (all.length === 0) {
          setStats(null);
          setLoading(false);
          return;
        }
        break;
      }
      all.push(...(data as unknown as DashboardCaseRow[]));
      if (data.length < pageSize) break;
    }
    if (cancelRef.current) return;
    setStats(buildStats(all));
    setLoading(false);
  }, []);

  // Initial load + realtime refresh on changes to the `cases` table so the
  // dashboard mirrors uploads and edits without a manual refresh.
  useEffect(() => {
    if (!role || role === "patient") {
      setLoading(false);
      return;
    }
    cancelRef.current = false;
    setLoading(true);
    fetchData();

    const channel = supabase
      .channel("dashboard-cases")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Polling fallback so the dashboard still refreshes even if Supabase
    // realtime is not enabled for the `cases` table on this project.
    const poll = window.setInterval(() => {
      fetchData();
    }, 60_000);

    return () => {
      cancelRef.current = true;
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [role, fetchData]);

  // Lock body scroll while the hotspots modal is open.
  useEffect(() => {
    if (!showHotspotsModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showHotspotsModal]);

  const assignedAreaName = profile?.barangay_psgc
    ? (barangays as { psgc: number; name: string }[]).find(
        (b) => b.psgc === profile.barangay_psgc
      )?.name
    : null;

  const subtitle = useMemo(() => {
    const base = SUBTITLE[role ?? "patient"];
    if (
      assignedAreaName &&
      (role === "health_worker" || role === "barangay_admin")
    ) {
      return `${base} · Assigned area: ${assignedAreaName}.`;
    }
    return base;
  }, [role, assignedAreaName]);

  return (
    <>
      {role !== "patient" && (
        <PageHeader
          title={`Welcome${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
          subtitle={subtitle}
        />
      )}

      {assignedAreaName &&
        (role === "health_worker" || role === "barangay_admin") && (
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
                  You are tracking{" "}
                  <span className="font-semibold text-slate-900">
                    {stats?.totalCases ?? 0}
                  </span>{" "}
                  case{stats?.totalCases === 1 ? "" : "s"} from this area.
                </p>
              </div>
            </Card>
          </div>
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
      ) : !stats ? (
        <Card className="p-6 text-sm text-slate-600">
          We couldn&apos;t load case data right now. Please refresh in a
          moment.
        </Card>
      ) : (
        <SurveillanceDashboard
          stats={stats}
          onOpenHotspots={() => setShowHotspotsModal(true)}
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
  onOpenHotspots,
}: {
  stats: DashboardStats;
  onOpenHotspots: () => void;
}) {
  const yoy = formatYoy(stats.yoyChangePct);

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
              Live &middot; City-wide TB surveillance
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
                  {yoy.text} vs {new Date().getFullYear() - 1}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Total confirmed TB cases across{" "}
              <span className="font-semibold text-slate-200">
                {stats.barangaysWithCases}
              </span>{" "}
              barangays.
            </p>
          </div>

          {/* Quick actions */}
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
                Click to inspect clusters
              </span>
            }
            interactive
          />
        </button>

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

      {/* Top barangay table with indicator labels */}
      <BarangayTable rows={stats.topBarangays} />
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
}: {
  rows: DashboardStats["topBarangays"];
}) {
  const maxCount = rows[0]?.caseCount ?? 0;
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <MapPin className="h-4 w-4 text-brand-600" /> Cases by barangay
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Ranked by total case count, most affected first.
          </p>
        </div>
        <Badge tone="info">{rows.length} active</Badge>
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          No cases recorded yet.
        </p>
      ) : (
        <div className="max-h-[30rem] overflow-y-auto overscroll-contain">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
              <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pl-5 pr-2 text-left font-semibold">
                  Barangay
                </th>
                <th className="hidden w-[34%] px-3 text-left font-semibold sm:table-cell">
                  Share
                </th>
                <th className="px-3 text-right font-semibold">Total</th>
                <th className="px-3 text-right font-semibold">Last 30d</th>
                <th className="py-2.5 pl-2 pr-5 text-right font-semibold">
                  Status
                </th>
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
                        <span className="font-medium text-slate-800">
                          {b.name}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-3 sm:table-cell">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={"h-full rounded-full " + b.indicator.dotClass}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 text-right font-display font-bold tabular-nums text-slate-900">
                      {b.caseCount}
                    </td>
                    <td className="px-3 text-right tabular-nums text-slate-600">
                      {b.recentCases}
                    </td>
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
              {sorted.length} DBSCAN cluster{sorted.length === 1 ? "" : "s"}{" "}
              detected from recent cases.
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
              No active hotspots detected. Cases are dispersed enough that
              DBSCAN found no clusters meeting the density threshold.
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
      blurb: "Chat in English, Filipino, o Bisaya — anytime.",
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
