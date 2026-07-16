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
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Pill,
  Settings,
  Stethoscope,
  Users,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
  Navigate,
  useOutlet,
} from "react-router-dom";
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
  group: string;
}

// Section order for the sidebar; groups with no visible items collapse away.
const NAV_GROUPS = ["Overview", "Surveillance", "Care", "Tools", "Admin"];

// Sidebar visibility per the BANTAY-TB conceptual framework.
//   system_admin    : central admin dashboard, user management, settings.
//   tb_coordinator  : city-wide surveillance — Map, Hotspots, Alerts, Cases,
//                     Analytics, DOTS Centers admin, Bulk Import, Chatbot,
//                     Settings, Users.
//   barangay_admin  : Active Case Finding (encode + trends), GIS Map, Alerts.
//   health_worker   : CDS + Adherence/Alerts + GIS Heatmap + AI Analytics.
//   patient         : Adherence (self-report) + Chatbot + Health Education.
const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: Home, group: "Overview" },
  {
    to: "/app/admin",
    label: "Central Dashboard",
    icon: LayoutDashboard,
    roles: ["system_admin"],
    group: "Overview",
  },
  {
    to: "/app/map",
    label: "GIS Map",
    icon: MapPinned,
    roles: ["tb_coordinator", "barangay_admin", "health_worker", "system_admin"],
    group: "Surveillance",
  },
  {
    to: "/app/hotspots",
    label: "Hotspots",
    icon: AlertTriangle,
    roles: ["tb_coordinator", "system_admin", "barangay_admin", "health_worker"],
    group: "Surveillance",
  },
  {
    to: "/app/alerts",
    label: "Alerts",
    icon: Bell,
    roles: ["tb_coordinator", "barangay_admin", "health_worker", "system_admin"],
    badgeKey: "alerts",
    group: "Surveillance",
  },
  {
    to: "/app/cases",
    label: "Cases (ACF)",
    icon: ClipboardList,
    roles: ["tb_coordinator", "barangay_admin", "health_worker", "system_admin"],
    group: "Surveillance",
  },
  {
    to: "/app/analytics",
    label: "Analytics",
    icon: BarChart3,
    roles: ["tb_coordinator", "barangay_admin", "health_worker", "system_admin"],
    group: "Surveillance",
  },
  {
    to: "/app/cds",
    label: "Decision Support",
    icon: Stethoscope,
    roles: ["health_worker"],
    group: "Care",
  },
  {
    to: "/app/dots-admin",
    label: "DOTS Centers",
    icon: MapPinned,
    roles: ["tb_coordinator", "system_admin"],
    group: "Care",
  },
  {
    to: "/app/adherence",
    label: "Adherence",
    icon: Pill,
    roles: ["health_worker", "patient"],
    group: "Care",
  },
  {
    to: "/app/education",
    label: "Health Education",
    icon: BookOpen,
    roles: ["patient"],
    group: "Care",
  },
  {
    to: "/app/import",
    label: "Bulk Import",
    icon: Upload,
    roles: ["tb_coordinator"],
    group: "Tools",
  },
  {
    to: "/app/chatbot",
    label: "Chatbot",
    icon: Bot,
    roles: ["tb_coordinator", "barangay_admin", "health_worker", "patient"],
    group: "Tools",
  },
  {
    to: "/app/settings",
    label: "Settings",
    icon: Settings,
    roles: ["tb_coordinator", "system_admin"],
    group: "Admin",
  },
  {
    to: "/app/users",
    label: "Users",
    icon: Users,
    roles: ["tb_coordinator", "system_admin"],
    group: "Admin",
  },
];

export function AppLayout() {
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = profile?.role;
  const userId = profile?.id;
  const outlet = useOutlet();
  useEffect(() => {
    if (
      role !== "tb_coordinator" &&
      role !== "barangay_admin" &&
      role !== "health_worker" &&
      role !== "system_admin"
    ) {
      return;
    }
    if (!userId) return;
    const recipient = userId;
    let cancelled = false;
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

  // Close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  const visibleNav = NAV.filter(
    (n) => !n.roles || n.roles.includes(profile.role)
  );

  // The sidebar is rendered twice (desktop + mobile drawer).
  const renderSidebar = (_scope: "desktop" | "mobile") => (
    <>
      <Link
        to="/app"
        className="flex items-center gap-2.5 px-5 py-5"
        onClick={() => setMobileOpen(false)}
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-soft">
          <Activity className="h-5 w-5" />
        </span>
        <div>
          <div className="font-display text-base font-bold tracking-tight text-slate-900">
            BANTAY-TB
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Davao City surveillance
          </div>
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          const items = visibleNav.filter((n) => n.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-1">
              <div className="px-3 pb-1 pt-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {group}
              </div>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/app"}
                      className={({ isActive }) =>
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition " +
                        (isActive
                          ? "bg-gradient-to-r from-brand-600 to-brand-800 text-white shadow-soft"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={
                              "h-4 w-4 transition " +
                              (isActive
                                ? "text-accent-300"
                                : "text-slate-400 group-hover:text-slate-600")
                            }
                          />
                          <span className="flex-1">{item.label}</span>
                          {item.badgeKey === "alerts" && unreadAlerts > 0 && (
                            <span
                              className={
                                "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums " +
                                (isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-red-100 text-red-700")
                              }
                            >
                              {unreadAlerts}
                            </span>
                          )}
                          {isActive && (
                            <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent-500" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="p-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-semibold text-white shadow-soft">
              {(profile.full_name ?? profile.email)
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <div className="truncate font-semibold text-slate-900">
                {profile.full_name ?? profile.email}
              </div>
              <div className="truncate text-slate-500">
                {ROLE_LABELS[profile.role]}
              </div>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-soft transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/app" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white">
            <Activity className="h-4 w-4" />
          </span>
          <span className="font-display text-base font-bold text-slate-900">
            BANTAY-TB
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-2 text-slate-700 transition hover:bg-slate-100"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white md:hidden">
            {renderSidebar("mobile")}
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        {renderSidebar("desktop")}
      </aside>

      {/* Immersive full-bleed views — they fill the content area
          edge-to-edge instead of sitting inside the padded page shell
          (maps go edge-to-edge; the chatbot fills the full height). */}
      {["/app/map", "/app/hotspots", "/app/chatbot"].includes(location.pathname) ? (
        <main className="flex-1 overflow-hidden pt-14 md:pt-0">
          <div key={location.pathname} className="h-full">
            {outlet}
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div key={location.pathname}>{outlet}</div>
          </div>
        </main>
      )}
    </div>
  );
}
