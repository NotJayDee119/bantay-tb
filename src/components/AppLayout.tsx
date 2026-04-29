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
  useOutlet,
} from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
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
//                     Settings, Users.
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
      role !== "health_worker"
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
    navigate("/login", { replace: true });
    return null;
  }

  const visibleNav = NAV.filter(
    (n) => !n.roles || n.roles.includes(profile.role)
  );

  // The sidebar is rendered twice (desktop + mobile drawer). We scope the
  // active-nav layoutId per instance with LayoutGroup so framer-motion does
  // not try to share-layout-animate across the two simultaneously-mounted
  // copies (the desktop one is hidden via display:none on mobile but still
  // mounted in the DOM).
  const renderSidebar = (scope: "desktop" | "mobile") => (
    <LayoutGroup id={`sidebar-${scope}`}>
      <Link
        to="/app"
        className="flex items-center gap-2.5 px-5 py-5"
        onClick={() => setMobileOpen(false)}
      >
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-soft">
          <Activity className="h-5 w-5" />
        </span>
        <div>
          <div className="font-display text-base font-bold tracking-tight text-slate-900">
            BANTAY-TB
          </div>
          <div className="text-xs text-slate-500">Davao City surveillance</div>
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="flex flex-col gap-0.5">
          {visibleNav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/app"}
                className={({ isActive }) =>
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition " +
                  (isActive
                    ? "text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="active-nav"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 32,
                        }}
                        className="absolute inset-0 -z-10 rounded-lg bg-brand-50"
                      />
                    )}
                    <item.icon
                      className={
                        "h-4 w-4 transition " +
                        (isActive ? "text-brand-600" : "text-slate-500")
                      }
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.badgeKey === "alerts" && unreadAlerts > 0 && (
                      <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">
                        {unreadAlerts}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-accent-100 text-sm font-semibold text-brand-700">
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
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </LayoutGroup>
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
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white md:hidden"
            >
              {renderSidebar("mobile")}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        {renderSidebar("desktop")}
      </aside>

      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Page-transition fade-in. We deliberately omit `exit` + `mode="wait"`:
              React Router's Outlet (and even useOutlet's element) reads from a
              context that updates immediately on navigation, so an exit
              animation would cause the *new* page content to flash out before
              fading back in. A simple fade-in keyed by pathname avoids the
              double-flash while still feeling smooth. */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {outlet}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
