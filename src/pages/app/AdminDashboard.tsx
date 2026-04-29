import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  MapPinned,
  Users as UsersIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
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

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const [usersQ, casesQ, hotspotsQ, byBarangayQ, totalBgyQ] =
        await Promise.all([
          supabase.from("profiles").select("role"),
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
        ]);

      if (cancelled) return;

      const byRole: Record<AppRole, number> = {
        system_admin: 0,
        tb_coordinator: 0,
        barangay_admin: 0,
        health_worker: 0,
        patient: 0,
      };
      for (const row of (usersQ.data ?? []) as { role: AppRole }[]) {
        byRole[row.role] = (byRole[row.role] ?? 0) + 1;
      }

      const counts = (byBarangayQ.data ?? []) as BarangayCount[];
      const barangaysWithCases = counts.filter((c) => c.case_count > 0).length;

      setStats({
        totalUsers: (usersQ.data ?? []).length,
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

  return (
    <>
      <PageHeader
        title="Central Admin Dashboard"
        subtitle="System-wide BANTAY-TB monitoring — users, cases, hotspots, and coverage."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          icon={UsersIcon}
          label="Total users"
          value={stats.totalUsers}
          tone="bg-sky-50 text-sky-700"
          delay={0}
        />
        <KPI
          icon={ClipboardList}
          label="Total cases"
          value={stats.totalCases}
          tone="bg-accent-50 text-accent-700"
          delay={0.05}
        />
        <KPI
          icon={AlertTriangle}
          label="Active hotspots (30d)"
          value={stats.activeHotspots}
          tone="bg-amber-50 text-amber-800"
          delay={0.1}
        />
        <KPI
          icon={MapPinned}
          label="Barangay coverage"
          value={`${stats.barangaysWithCases}/${stats.totalBarangays}`}
          subtext={`${coverage}% of barangays have recorded cases`}
          tone="bg-brand-50 text-brand-700"
          delay={0.15}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Activity className="h-4 w-4" /> Users by role
          </div>
          <ul className="space-y-2">
            {ROLE_ORDER.map((r) => {
              const count = stats.byRole[r] ?? 0;
              const pct = stats.totalUsers
                ? (count / stats.totalUsers) * 100
                : 0;
              return (
                <li key={r}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">
                      {ROLE_LABELS[r]}
                    </span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-brand-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Activity className="h-4 w-4" /> Coverage gap
          </div>
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">
              {stats.totalBarangays - stats.barangaysWithCases}
            </span>{" "}
            of {stats.totalBarangays} barangays have <em>no</em> recorded cases
            in the last 12 months. Either incidence is genuinely zero, or the
            barangay has no active reporter — review user assignments below to
            close coverage gaps.
          </p>
          <a
            href="/app/users"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <UsersIcon className="h-4 w-4" /> Manage users & area assignments
          </a>
        </Card>
      </div>
    </>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  subtext,
  tone,
  delay,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  subtext?: string;
  tone: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <span
            className={
              "grid h-10 w-10 place-items-center rounded-lg " + tone
            }
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <div className="text-2xl font-semibold text-slate-900">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        </div>
        {subtext && (
          <p className="mt-3 text-xs text-slate-500">{subtext}</p>
        )}
      </Card>
    </motion.div>
  );
}
