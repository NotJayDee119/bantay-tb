import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  ClipboardList,
  MapPinned,
  Pill,
  Stethoscope,
  TrendingUp,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { Card, PageHeader, Spinner } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import type { AppRole } from "../../lib/supabase";

interface Stats {
  totalCases: number;
  casesThisMonth: number;
  activeHotspots: number;
  pendingAdherence: number;
  unreadAlerts: number;
  topBarangays: { name: string; count: number }[];
}

const ZERO: Stats = {
  totalCases: 0,
  casesThisMonth: 0,
  activeHotspots: 0,
  pendingAdherence: 0,
  unreadAlerts: 0,
  topBarangays: [],
};

export function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  const role = profile?.role;
  const userId = profile?.id;

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const baseQueries = [
        supabase.from("cases").select("id", { count: "exact", head: true }),
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
      ] as const;

      const alertsQuery =
        userId && (role === "tb_coordinator" || role === "barangay_admin")
          ? supabase
              .from("hotspot_alerts")
              .select("id", { count: "exact", head: true })
              .eq("recipient_id", userId)
              .is("read_at", null)
          : null;

      const [totalQ, monthQ, hotspotQ, adherenceQ, byBarangayQ, alertsQ] =
        await Promise.all([
          ...baseQueries,
          alertsQuery ?? Promise.resolve({ count: 0 }),
        ]);

      if (cancelled) return;

      const top: Record<string, number> = {};
      for (const row of (byBarangayQ.data ?? []) as unknown as {
        barangays: { name: string } | null;
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
        unreadAlerts: (alertsQ as { count: number | null }).count ?? 0,
        topBarangays,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [role, userId]);

  const s = stats ?? ZERO;

  return (
    <>
      <PageHeader
        title={`Welcome${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        subtitle={SUBTITLE[role ?? "patient"]}
      />

      {!stats && (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      )}

      {/* Framework tiles — match the BANTAY-TB conceptual framework per role. */}
      <FrameworkTiles role={role} stats={s} />

      {/* Stat cards: relevant for all staff. Patients don't see them
          because the framework tiles for patients don't include surveillance.
          Missed doses is only relevant to health_worker (they own adherence
          per the framework); barangay_admin and tb_coordinator don't see it. */}
      {role && role !== "patient" && (
        <div
          className={
            "mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 " +
            (role === "health_worker" ? "lg:grid-cols-4" : "lg:grid-cols-3")
          }
        >
          <StatCard
            icon={ClipboardList}
            label="Total cases"
            value={s.totalCases}
            tone="bg-sky-50 text-sky-700"
            delay={0.0}
          />
          <StatCard
            icon={TrendingUp}
            label="New cases (30d)"
            value={s.casesThisMonth}
            tone="bg-accent-50 text-accent-700"
            delay={0.05}
          />
          <StatCard
            icon={AlertTriangle}
            label="Active hotspots"
            value={s.activeHotspots}
            tone="bg-amber-50 text-amber-800"
            delay={0.1}
          />
          {role === "health_worker" && (
            <StatCard
              icon={Pill}
              label="Missed doses"
              value={s.pendingAdherence}
              tone="bg-red-50 text-red-700"
              delay={0.15}
            />
          )}
        </div>
      )}

      {role && role !== "patient" && (
        <div className="mt-6">
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
                        <span className="font-medium text-slate-800">
                          {b.name}
                        </span>
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
        </div>
      )}
    </>
  );
}

const SUBTITLE: Record<AppRole, string> = {
  tb_coordinator:
    "City-wide TB surveillance overview — last 30 days.",
  barangay_admin:
    "Frontline tools for case finding, monitoring trends, and acting on hotspot alerts.",
  health_worker:
    "Clinical decision support, adherence and alert monitoring, GIS heatmap, and outreach analytics.",
  patient:
    "Welcome to BANTAY-TB. Track your medication, learn about TB, and chat with our health assistant.",
};

interface FrameworkTile {
  to: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  badge?: number;
}

function tilesFor(role: AppRole | undefined, s: Stats): FrameworkTile[] {
  if (!role) return [];
  const ALERTS: FrameworkTile = {
    to: "/app/alerts",
    title: "Hotspot alerts",
    blurb: "Review DBSCAN-detected clusters that need follow-up.",
    icon: Bell,
    badge: s.unreadAlerts,
  };
  const ADHERENCE: FrameworkTile = {
    to: "/app/adherence",
    title: "Adherence & alerts",
    blurb: "Monitor patient dose logs and missed-dose patterns.",
    icon: Pill,
    badge: s.pendingAdherence,
  };
  const GIS: FrameworkTile = {
    to: "/app/map",
    title: "GIS heatmap",
    blurb: "Live, interactive Leaflet map of TB cases across all 182 barangays.",
    icon: MapPinned,
  };
  const CDS: FrameworkTile = {
    to: "/app/cds",
    title: "Clinical decision support",
    blurb: "Rule-based presumptive TB screening (NTP + WHO).",
    icon: Stethoscope,
  };
  const ANALYTICS: FrameworkTile = {
    to: "/app/analytics",
    title: "AI analytics for outreach",
    blurb:
      "Demographic and trend insights to focus screening campaigns.",
    icon: BarChart3,
  };
  const ACF: FrameworkTile = {
    to: "/app/cases/new",
    title: "Active case finding",
    blurb: "Encode a presumptive or confirmed TB case in seconds.",
    icon: ClipboardList,
  };
  const TRENDS: FrameworkTile = {
    to: "/app/cases",
    title: "Monitor case trends",
    blurb: "Browse the case ledger with filters by barangay, age, sex, outcome.",
    icon: TrendingUp,
  };
  const IMPORT: FrameworkTile = {
    to: "/app/import",
    title: "Bulk import",
    blurb: "Upload CHO Excel monthlies — auto-mapping, PII stripped client-side.",
    icon: Upload,
  };

  switch (role) {
    case "health_worker":
      return [CDS, ADHERENCE, GIS, ANALYTICS];
    case "barangay_admin":
      return [ACF, TRENDS, ALERTS, GIS];
    case "tb_coordinator":
      return [TRENDS, GIS, ALERTS, ANALYTICS, IMPORT];
    case "patient":
      return [];
  }
}

function FrameworkTiles({
  role,
  stats,
}: {
  role: AppRole | undefined;
  stats: Stats;
}) {
  const tiles = tilesFor(role, stats);
  if (tiles.length === 0) {
    if (role === "patient") {
      const patientTiles = [
        {
          to: "/app/adherence",
          label: "Mark today's dose",
          blurb: "Log your medication and track streaks.",
          icon: Pill,
        },
        {
          to: "/app/chatbot",
          label: "Ask the health chatbot",
          blurb: "English, Filipino, or Bisaya — anytime.",
          icon: Bot,
        },
        {
          to: "/app/education",
          label: "Read health education",
          blurb: "Plain-language guides on TB and respiratory care.",
          icon: BookOpen,
        },
      ];
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          {patientTiles.map((t, i) => (
            <motion.div
              key={t.to}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
            >
              <Link
                to={t.to}
                className="group block rounded-xl border border-slate-200/80 bg-gradient-to-br from-white to-brand-50/40 p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-soft">
                  <t.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 font-display text-base font-semibold tracking-tight text-slate-900">
                  {t.label}
                </div>
                <div className="mt-1 text-sm text-slate-600">{t.blurb}</div>
              </Link>
            </motion.div>
          ))}
        </div>
      );
    }
    return null;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t, i) => (
        <motion.div
          key={t.to}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.05 }}
          whileHover={{ y: -2 }}
        >
          <Link
            to={t.to}
            className="group relative block overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-soft transition hover:shadow-lift"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 via-accent-500 to-brand-400 opacity-0 transition group-hover:opacity-100" />
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-50 to-accent-50 text-brand-700 transition group-hover:from-brand-500 group-hover:to-accent-500 group-hover:text-white">
                <t.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-semibold tracking-tight text-slate-900">
                    {t.title}
                  </span>
                  {t.badge != null && t.badge > 0 && (
                    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">
                      {t.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {t.blurb}
                </p>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  delay = 0,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  tone: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: "easeOut" }}
    >
      <Card className="p-5 transition hover:shadow-lift">
        <div className={`inline-flex rounded-lg p-2 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="font-display mt-3 text-3xl font-bold tracking-tight text-slate-900">
          {value.toLocaleString()}
        </div>
        <div className="text-sm text-slate-500">{label}</div>
      </Card>
    </motion.div>
  );
}
