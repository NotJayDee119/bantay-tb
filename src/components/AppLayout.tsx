import { Suspense, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  ClipboardList,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Pill,
  Settings,
  Stethoscope,
  Ticket,
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
} from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { usePageTransition } from "../hooks/usePageTransition";
import { preloadRoute } from "../lib/lazyPages";
import { ROLE_LABELS, type AppRole } from "../lib/supabase";
import { supabase } from "../lib/supabase";
import { LazyFallback } from "./LazyFallback";
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
    roles: ["system_admin"],
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
    roles: ["tb_coordinator", "barangay_admin", "health_worker", "system_admin"],
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
    roles: ["system_admin"],
    group: "Admin",
  },
  {
    to: "/app/invites",
    label: "Invite Codes",
    icon: Ticket,
    roles: ["tb_coordinator", "system_admin"],
    group: "Admin",
  },
  {
    // Sits under Care, not Admin: this is a counter task a nurse does with a
    // patient in front of them, not account administration.
    to: "/app/patient-codes",
    label: "Patient Codes",
    icon: KeyRound,
    roles: ["health_worker", "tb_coordinator", "system_admin"],
    group: "Care",
  },
  {
    to: "/app/users",
    label: "Users",
    icon: Users,
    roles: ["system_admin"],
    group: "Admin",
  },
];

export function AppLayout() {
  const { profile, profileError, reloadProfile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = profile?.role;
  const userId = profile?.id;
  const { containerRef: pageRef, pathname: pageKey, element: pageElement } = usePageTransition();
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

  // Close the mobile drawer the instant navigation starts. The content
  // scroll reset waits for `pageKey` (the page transition's committed
  // route) instead — the scrollable <main> persists across navigations, so
  // resetting it immediately would yank the outgoing page to the top
  // mid-exit-fade instead of after the incoming page has landed.
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pageKey]);

  // Escape closes the mobile drawer, like any modal surface.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Spinner />
      </div>
    );
  }

  // A profile that failed to LOAD is not a signed-out user. Redirecting here
  // would bounce a valid session to /login, where signing in again hits the
  // same failure — the loop reads as "the app logs me straight back out" and
  // hides the actual cause. Say what broke and offer a retry instead.
  if (!profile && profileError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-soft">
          <p className="text-base font-semibold text-slate-900">
            Signed in, but your profile couldn&apos;t be loaded
          </p>
          <p className="mt-1.5 text-sm text-slate-600">
            Your session is still valid — the app just can&apos;t read who you
            are, so it doesn&apos;t know what to show you.
          </p>
          <p className="mt-3 rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-800">
            {profileError}
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => void reloadProfile()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
            >
              Sign out
            </button>
          </div>
        </div>
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
  const renderSidebar = (scope: "desktop" | "mobile") => (
    <>
      <div className="flex items-center justify-between pr-3">
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
        {scope === "mobile" && (
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
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
                      onMouseEnter={() => preloadRoute(item.to)}
                      onFocus={() => preloadRoute(item.to)}
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
          className="rounded-md p-2 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="app-mobile-drawer"
        >
          {/* Burger ↔ X cross-fade with a quarter turn. */}
          <span className="relative grid h-5 w-5 place-items-center">
            <Menu
              className={
                "absolute h-5 w-5 transition-all duration-200 " +
                (mobileOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100")
              }
            />
            <X
              className={
                "absolute h-5 w-5 transition-all duration-200 " +
                (mobileOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0")
              }
            />
          </span>
        </button>
      </div>

      {/* Mobile drawer — always mounted so both open and close animate.
          `visibility` rides along with the transition: it stays visible
          while sliding out, then goes hidden (unfocusable) at the end. */}
      <div
        className={
          "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 md:hidden " +
          (mobileOpen ? "opacity-100" : "pointer-events-none opacity-0")
        }
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <aside
        id="app-mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-2xl transition-[transform,visibility] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden " +
          (mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full")
        }
      >
        {renderSidebar("mobile")}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        {renderSidebar("desktop")}
      </aside>

      {/* Immersive full-bleed views — they fill the content area
          edge-to-edge instead of sitting inside the padded page shell
          (maps go edge-to-edge; the chatbot fills the full height).
          Branches on `pageKey` (the transition's committed route) rather
          than the live location, so a nav crossing into/out of this set
          doesn't swap the shell out from under the page mid-exit-fade. */}
      {["/app/map", "/app/hotspots", "/app/chatbot"].includes(pageKey) ? (
        <main className="flex-1 overflow-hidden pt-14 md:pt-0">
          {/* Suspense inside the keyed transition container: a cold page
              chunk falls back to the route-progress bar while the sidebar
              stays mounted, and pageRef stays stable for the GSAP tweens. */}
          <div key={pageKey} ref={pageRef} className="h-full">
            <Suspense fallback={<LazyFallback />}>{pageElement}</Suspense>
          </div>
        </main>
      ) : (
        <main ref={mainRef} className="flex-1 overflow-y-auto pt-14 md:pt-0">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div key={pageKey} ref={pageRef}>
              <Suspense fallback={<LazyFallback />}>{pageElement}</Suspense>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
