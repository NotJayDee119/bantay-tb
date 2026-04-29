import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  ClipboardList,
  Home,
  LogOut,
  MapPinned,
  Pill,
  Settings,
  Stethoscope,
  Users,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ROLE_LABELS, type AppRole } from "../lib/supabase";
import { supabase } from "../lib/supabase";
import { Spinner } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: AppRole[];
  badgeKey?: "alerts";
}

// Sidebar visibility per the BANTAY-TB conceptual framework.
//   tb_coordinator  : city-wide surveillance — Map, Hotspots, Alerts, Cases,
//                     Analytics, DOTS Centers admin, Bulk Import, Chatbot,
//                     Settings, Users. (CDS, Adherence, and Health Education
//                     are explicitly excluded; those are for clinicians and
//                     patients respectively.)
//   barangay_admin  : Active Case Finding (encode + trends), GIS Map, Alerts.
//   health_worker   : CDS + Adherence/Alerts + GIS Heatmap + AI Analytics.
//   patient         : Adherence (self-report) + Chatbot + Health Education.
const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: Home },
  {
    to: "/app/map",
    label: "GIS Map",
    icon: MapPinned,
    roles: ["tb_coordinator", "barangay_admin", "health_worker"],
  },
  {
    to: "/app/hotspots",
    label: "Hotspots",
    icon: AlertTriangle,
    roles: ["tb_coordinator"],
  },
  {
    to: "/app/alerts",
    label: "Alerts",
    icon: Bell,
    roles: ["tb_coordinator", "barangay_admin", "health_worker"],
    badgeKey: "alerts",
  },
  {
    to: "/app/cases",
    label: "Cases (ACF)",
    icon: ClipboardList,
    roles: ["tb_coordinator", "barangay_admin"],
  },
  {
    to: "/app/cds",
    label: "Decision Support",
    icon: Stethoscope,
    roles: ["health_worker"],
  },
  {
    to: "/app/analytics",
    label: "Analytics",
    icon: BarChart3,
    roles: ["tb_coordinator", "health_worker"],
  },
  {
    to: "/app/dots-admin",
    label: "DOTS Centers",
    icon: MapPinned,
    roles: ["tb_coordinator"],
  },
  {
    to: "/app/import",
    label: "Bulk Import",
    icon: Upload,
    roles: ["tb_coordinator"],
  },
  {
    to: "/app/adherence",
    label: "Adherence",
    icon: Pill,
    roles: ["health_worker", "patient"],
  },
  {
    to: "/app/chatbot",
    label: "Chatbot",
    icon: Bot,
    roles: ["tb_coordinator", "patient"],
  },
  {
    to: "/app/education",
    label: "Health Education",
    icon: BookOpen,
    roles: ["patient"],
  },
  {
    to: "/app/settings",
    label: "Settings",
    icon: Settings,
    roles: ["tb_coordinator"],
  },
  {
    to: "/app/users",
    label: "Users",
    icon: Users,
    roles: ["tb_coordinator"],
  },
];

export function AppLayout() {
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  const role = profile?.role;
  const userId = profile?.id;
  useEffect(() => {
    if (
      role !== "tb_coordinator" &&
      role !== "barangay_admin" &&
      role !== "health_worker"
    ) {
      return;
    }
    if (!userId) return;
    const recipient = userId;
    let cancelled = false;
    // Scope to the current user's alerts; staff RLS would otherwise inflate
    // the badge with other recipients' unread rows.
    async function refresh() {
      const { count } = await supabase
        .from("hotspot_alerts")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", recipient)
        .is("read_at", null);
      if (!cancelled) setUnreadAlerts(count ?? 0);
    }
    refresh();
    const ch = supabase
      .channel("alerts-badge")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hotspot_alerts" },
        refresh
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [role, userId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!profile) {
    navigate("/login", { replace: true });
    return null;
  }

  const visibleNav = NAV.filter(
    (n) => !n.roles || n.roles.includes(profile.role)
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <Link to="/app" className="flex items-center gap-2 px-5 py-5">
          <Activity className="h-7 w-7 text-brand-600" />
          <div>
            <div className="text-lg font-bold text-slate-900">BANTAY-TB</div>
            <div className="text-xs text-slate-500">Davao City</div>
          </div>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              className={({ isActive }) =>
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition " +
                (isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.badgeKey === "alerts" && unreadAlerts > 0 && (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">
                  {unreadAlerts}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 text-xs">
            <div className="font-semibold text-slate-900">
              {profile.full_name ?? profile.email}
            </div>
            <div className="text-slate-500">{ROLE_LABELS[profile.role]}</div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
