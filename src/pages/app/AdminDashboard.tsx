import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardList,
  MapPinned,
  Settings2,
  Users as UsersIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, PageHeader, Spinner } from "../../components/ui";
import { supabase, ROLE_LABELS, type AppRole } from "../../lib/supabase";

interface BarangayCount {
  barangay_psgc: number;
  case_count: number;
}

interface AdminStats {
  totalUsers: number;
  byRole: Record<AppRole, number>;
  totalCases: number;
  activeHotspots: number;
  barangaysWithCases: number;
  totalBarangays: number;
}

const ROLE_ORDER: AppRole[] = [
  "system_admin",
  "tb_coordinator",
  "barangay_admin",
  "health_worker",
  "patient",
];

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

const QUICK_ACTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/app/users", label: "Manage users", icon: UsersIcon },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings2 },
];

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      // Count users per role with server-side count (head:true) so we don't
      // hit PostgREST's default 1000-row cap once the system has many users.
      const roleCountQs = ROLE_ORDER.map((r) =>
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", r)
      );

      const [casesQ, hotspotsQ, byBarangayQ, totalBgyQ, ...roleQs] =
        await Promise.all([
          supabase
            .from("cases")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("hotspots")
            .select("id", { count: "exact", head: true })
            .gte("window_end", since.toISOString()),
          supabase.rpc("barangay_case_counts", {
            p_disease: null,
            p_days: 365,
          }),
          supabase
            .from("barangays")
            .select("psgc", { count: "exact", head: true }),
          ...roleCountQs,
        ]);

      if (cancelled) return;

      const byRole: Record<AppRole, number> = {
        system_admin: 0,
        tb_coordinator: 0,
        barangay_admin: 0,
        health_worker: 0,
        patient: 0,
      };
      let totalUsers = 0;
      ROLE_ORDER.forEach((r, i) => {
        const c = roleQs[i]?.count ?? 0;
        byRole[r] = c;
        totalUsers += c;
      });

      const counts = (byBarangayQ.data ?? []) as BarangayCount[];
      const barangaysWithCases = counts.filter((c) => c.case_count > 0).length;

      setStats({
        totalUsers,
        byRole,
        totalCases: casesQ.count ?? 0,
        activeHotspots: hotspotsQ.count ?? 0,
        barangaysWithCases,
        totalBarangays: totalBgyQ.count ?? 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) {
    return (
      <>
        <PageHeader
          title="Central Admin Dashboard"
          subtitle="System-wide BANTAY-TB monitoring overview."
        />
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      </>
    );
  }

  const coverage = stats.totalBarangays
    ? Math.round((stats.barangaysWithCases / stats.totalBarangays) * 100)
    : 0;
  const uncovered = stats.totalBarangays - stats.barangaysWithCases;
  const maxRole = Math.max(1, ...ROLE_ORDER.map((r) => stats.byRole[r] ?? 0));

  return (
    <>
      <PageHeader
        title="Central Admin Dashboard"
        subtitle="System-wide BANTAY-TB monitoring — users, cases, hotspots, and coverage."
      />

      {/* ── Command band — headline system figure + quick actions ────── */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-900 bg-brand-950 p-6 text-white shadow-soft sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-60"
        />
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
              Live &middot; System administration
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <span className="font-display text-5xl font-black leading-none tracking-tight text-white sm:text-6xl">
                {stats.totalUsers.toLocaleString()}
              </span>
              <span className="mb-1.5 font-mono text-xs uppercase tracking-wider text-slate-400">
                registered users
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Across{" "}
              <span className="font-semibold text-slate-200">
                {ROLE_ORDER.length}
              </span>{" "}
              roles, from system admins to patients.
            </p>
          </div>

          {/* Quick actions */}
          <div className="grid w-full grid-cols-1 gap-2 sm:max-w-xs">
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

      {/* ── Stat bar ─────────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          icon={ClipboardList}
          iconClass="bg-accent-50 text-accent-700"
          accentClass="bg-accent-500"
          label="Total cases"
          value={stats.totalCases.toLocaleString()}
          footer="All diseases, all time"
        />
        <StatTile
          icon={AlertTriangle}
          iconClass="bg-red-50 text-red-600"
          accentClass="bg-red-500"
          label="Active hotspots · 30d"
          value={stats.activeHotspots.toLocaleString()}
          footer="DBSCAN clusters in the last 30 days"
        />
        <StatTile
          icon={MapPinned}
          iconClass="bg-brand-50 text-brand-700"
          accentClass="bg-brand-500"
          label="Barangay coverage"
          value={`${stats.barangaysWithCases}/${stats.totalBarangays}`}
          footer={`${coverage}% of barangays have recorded cases`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Users by role ──────────────────────────────────────────── */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
              <UsersIcon className="h-3.5 w-3.5 text-brand-600" />
              Users by role
            </div>
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {stats.totalUsers.toLocaleString()} total
            </span>
          </div>
          <ul className="space-y-3 p-4">
            {ROLE_ORDER.map((r) => {
              const count = stats.byRole[r] ?? 0;
              const pct = (count / maxRole) * 100;
              return (
                <li key={r}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800">
                      {ROLE_LABELS[r]}
                    </span>
                    <span className="font-display font-bold tabular-nums text-slate-900">
                      {count.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* ── Coverage gap ───────────────────────────────────────────── */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <Activity className="h-3.5 w-3.5 text-vigil-500" />
            <span className={MICRO_LABEL}>Coverage gap</span>
          </div>
          <div className="p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
                {uncovered.toLocaleString()}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                of {stats.totalBarangays} barangays · no recorded cases
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              No cases were recorded in these barangays in the last 12 months.
              Either incidence is genuinely zero, or the barangay has no active
              reporter — review user assignments to close coverage gaps.
            </p>
            <Link
              to="/app/users"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
            >
              <UsersIcon className="h-4 w-4" /> Manage users & area assignments
            </Link>
          </div>
        </Card>
      </div>
    </>
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
