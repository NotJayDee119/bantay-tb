import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Pill,
  TrendingUp,
} from "lucide-react";
import { Card, PageHeader, Spinner } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import type { AppRole } from "../../lib/supabase";

interface Stats {
  totalCases: number;
  casesThisMonth: number;
  activeHotspots: number;
  pendingAdherence: number;
  topBarangays: { name: string; count: number }[];
}

const ZERO: Stats = {
  totalCases: 0,
  casesThisMonth: 0,
  activeHotspots: 0,
  pendingAdherence: 0,
  topBarangays: [],
};

export function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const [
        totalQ,
        monthQ,
        hotspotQ,
        adherenceQ,
        byBarangayQ,
      ] = await Promise.all([
        supabase
          .from("cases")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("cases")
          .select("id", { count: "exact", head: true })
          .gte("reported_at", since.toISOString()),
        supabase
          .from("hotspots")
          .select("id", { count: "exact", head: true })
          .gte("window_end", since.toISOString()),
        supabase
          .from("adherence_logs")
          .select("id", { count: "exact", head: true })
          .eq("status", "missed"),
        supabase
          .from("cases")
          .select("barangay_psgc, barangays!inner(name)")
          .gte("reported_at", since.toISOString())
          .limit(1000),
      ]);

      if (cancelled) return;

      const top: Record<string, number> = {};
      for (const row of (byBarangayQ.data ?? []) as {
        barangays: { name: string };
      }[]) {
        const n = row.barangays?.name ?? "Unknown";
        top[n] = (top[n] ?? 0) + 1;
      }
      const topBarangays = Object.entries(top)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      setStats({
        totalCases: totalQ.count ?? 0,
        casesThisMonth: monthQ.count ?? 0,
        activeHotspots: hotspotQ.count ?? 0,
        pendingAdherence: adherenceQ.count ?? 0,
        topBarangays,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const s = stats ?? ZERO;

  return (
    <>
      <PageHeader
        title={`Welcome${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        subtitle="Davao City TB surveillance overview — last 30 days."
      />

      {!stats && (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Total cases"
          value={s.totalCases}
          tone="bg-sky-50 text-sky-700"
        />
        <StatCard
          icon={TrendingUp}
          label="New cases (30d)"
          value={s.casesThisMonth}
          tone="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          icon={AlertTriangle}
          label="Active hotspots"
          value={s.activeHotspots}
          tone="bg-amber-50 text-amber-800"
        />
        <StatCard
          icon={Pill}
          label="Missed doses"
          value={s.pendingAdherence}
          tone="bg-red-50 text-red-700"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Activity className="h-4 w-4" /> Top barangays (last 30 days)
          </div>
          {s.topBarangays.length === 0 ? (
            <p className="text-sm text-slate-500">No cases recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {s.topBarangays.map((b) => {
                const max = s.topBarangays[0]?.count || 1;
                return (
                  <li key={b.name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{b.name}</span>
                      <span className="text-slate-500">{b.count}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-brand-500"
                        style={{ width: `${(b.count / max) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <div className="mb-3 text-sm font-semibold text-slate-900">
            Quick actions
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {quickActionsFor(profile?.role).map((q) => (
              <QuickLink key={q.to} to={q.to} label={q.label} />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card className="p-5">
      <div className={`inline-flex rounded-md p-2 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-3xl font-bold text-slate-900">
        {value.toLocaleString()}
      </div>
      <div className="text-sm text-slate-500">{label}</div>
    </Card>
  );
}

interface QuickAction {
  to: string;
  label: string;
  roles?: AppRole[];
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    to: "/app/cases/new",
    label: "Encode new case",
    roles: ["tb_coordinator", "barangay_admin", "health_worker"],
  },
  {
    to: "/app/map",
    label: "Open GIS map",
    roles: ["tb_coordinator", "barangay_admin", "health_worker"],
  },
  {
    to: "/app/import",
    label: "Bulk import (CHO Excel)",
    roles: ["tb_coordinator", "barangay_admin"],
  },
  { to: "/app/chatbot", label: "Ask the multilingual chatbot" },
  { to: "/app/adherence", label: "Adherence dashboard" },
  {
    to: "/app/alerts",
    label: "Hotspot alerts",
    roles: ["tb_coordinator", "barangay_admin"],
  },
  { to: "/app/education", label: "Health education" },
];

function quickActionsFor(role: AppRole | undefined): QuickAction[] {
  if (!role) return [];
  return QUICK_ACTIONS.filter((q) => !q.roles || q.roles.includes(role));
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
    >
      {label}
    </Link>
  );
}
