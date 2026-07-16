import { useEffect, useState } from "react";
import { Activity, ArrowRight, Heart, Menu, X } from "lucide-react";
import { Link, NavLink, useLocation, useOutlet } from "react-router-dom";
import { PublicChatbotFab } from "./PublicChatbotFab";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/dots-locator", label: "DOTS Locator" },
  { to: "/learn", label: "Health Education" },
  { to: "/about", label: "About" },
];

const FOOTER_PATIENT_LINKS = [
  { to: "/dots-locator", label: "DOTS Locator" },
  { to: "/learn", label: "Health Education" },
  { to: "/about", label: "About" },
];

const FOOTER_WORKER_LINKS = [
  { to: "/login", label: "Sign in" },
  { to: "/register", label: "Request an account" },
];

export function PublicLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Check if current page should hide footer
  const hideFooter = [
    "/login",
    "/register",
    "/register/staff",
    "/dots-locator",
  ].includes(location.pathname);

  // The DOTS Locator's full-screen map already has its own floating panels
  // (search/list top-left, route summary bottom-right) — the chatbot FAB
  // would overlap them.
  const hideChatbot = location.pathname === "/dots-locator";

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-950 text-white shadow-soft">
              <Activity className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-vigil-400" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">
                BANTAY-TB
              </span>
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                Davao City &middot; public health
              </span>
            </span>
          </Link>

          {/* Segmented pill nav */}
          <nav className="hidden items-center lg:flex">
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100/70 p-1">
              {NAV.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  className={({ isActive }) =>
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 " +
                    (isActive
                      ? "bg-brand-950 text-white shadow-soft"
                      : "text-slate-600 hover:bg-white hover:text-slate-900")
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
            <Link
              to="/login"
              className="ml-4 inline-flex h-10 items-center gap-2 rounded-full bg-brand-950 px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-900"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>

          <div className="flex items-center gap-2 lg:hidden">
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded-full bg-brand-950 px-4 text-sm font-medium text-white shadow-soft transition hover:bg-brand-900"
            >
              Sign in
            </Link>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-soft transition hover:bg-slate-100"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="border-t border-slate-200/70 bg-white/95 backdrop-blur-xl lg:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-1.5 px-4 py-4 text-sm sm:px-6">
              {NAV.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  className={({ isActive }) =>
                    "flex items-center justify-between rounded-xl px-4 py-3 font-medium transition " +
                    (isActive
                      ? "bg-brand-950 text-white shadow-soft"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                  }
                >
                  {({ isActive }) => (
                    <>
                      {l.label}
                      {isActive && <ArrowRight className="h-4 w-4" />}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1 overflow-x-hidden">{outlet}</main>
      {!hideFooter && (
        <footer className="relative overflow-hidden bg-brand-950">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-40" />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 top-[-40%] h-[26rem] w-[26rem] rounded-full bg-accent-500/10 blur-[100px]"
          />
          {/* Main footer */}
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
              <div>
                <Link to="/" className="inline-flex items-center gap-3">
                  <span className="relative grid h-11 w-11 place-items-center rounded-xl border border-white/15 bg-white/10 text-white">
                    <Activity className="h-5 w-5" />
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-950 bg-vigil-400" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="font-display text-lg font-extrabold tracking-tight text-white">
                      BANTAY-TB
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      Davao City &middot; public health
                    </span>
                  </span>
                </Link>
                <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-400">
                  A public health platform for tuberculosis information,
                  navigation, and surveillance in Davao City — designed to help
                  residents, patients, and frontline workers.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-400" />
                  </span>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    Surveillance active &middot; 182 barangays
                  </span>
                </div>
              </div>

              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
                  For patients
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {FOOTER_PATIENT_LINKS.map((l) => (
                    <li key={l.to}>
                      <Link
                        to={l.to}
                        className="group inline-flex items-center gap-1.5 py-1 text-slate-300 transition hover:text-white"
                      >
                        {l.label}
                        <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-accent-400 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
                  For health workers
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {FOOTER_WORKER_LINKS.map((l) => (
                    <li key={l.to}>
                      <Link
                        to={l.to}
                        className="group inline-flex items-center gap-1.5 py-1 text-slate-300 transition hover:text-white"
                      >
                        {l.label}
                        <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-accent-400 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-vigil-400" />
                &copy; {new Date().getFullYear()} BANTAY-TB &middot; Davao City
              </p>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                Made with <Heart className="h-3 w-3 text-red-400" /> for Davao City
              </p>
            </div>
          </div>
        </footer>
      )}
      {!hideChatbot && <PublicChatbotFab />}
    </div>
  );
}
