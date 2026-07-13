import { useEffect, useState } from "react";
import { Activity, Heart, Menu, X } from "lucide-react";
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
  const hideFooter = ["/login", "/register", "/register/staff"].includes(
    location.pathname
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-slate-100 text-slate-900 shadow-soft">
              <Activity className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-display text-lg font-bold tracking-tight text-slate-900">
                BANTAY-TB
              </span>
              <span className="text-xs text-slate-500">Davao City public health</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm lg:flex">
            {NAV.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  "rounded-full px-4 py-2 font-medium transition " +
                  (isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                }
              >
                {l.label}
              </NavLink>
            ))}
            <Link
              to="/login"
              className="ml-2 inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-soft transition hover:border-slate-300 hover:bg-slate-50"
            >
              Sign in
            </Link>
          </nav>

          <div className="flex items-center gap-2 lg:hidden">
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-soft"
            >
              Sign in
            </Link>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100"
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
          <div className="border-t border-slate-200 bg-white lg:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-sm sm:px-6">
              {NAV.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  className={({ isActive }) =>
                    "rounded-xl px-4 py-3 font-medium transition " +
                    (isActive
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1 overflow-x-hidden">{outlet}</main>
      {!hideFooter && (
        <footer className="bg-brand-950">
          {/* Main footer */}
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
              <div>
                <Link to="/" className="inline-flex items-center gap-2.5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-white">
                    <Activity className="h-5 w-5" />
                  </span>
                  <span className="font-display text-lg font-bold tracking-tight text-white">
                    BANTAY-TB
                  </span>
                </Link>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
                  A public health platform for tuberculosis information,
                  navigation, and surveillance in Davao City — designed to help
                  residents, patients, and frontline workers.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  For patients
                </p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {FOOTER_PATIENT_LINKS.map((l) => (
                    <li key={l.to}>
                      <Link
                        to={l.to}
                        className="inline-flex items-center text-slate-300 transition hover:text-white"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  For health workers
                </p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {FOOTER_WORKER_LINKS.map((l) => (
                    <li key={l.to}>
                      <Link
                        to={l.to}
                        className="inline-flex items-center text-slate-300 transition hover:text-white"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
              <p className="text-xs text-slate-500">
                &copy; {new Date().getFullYear()} BANTAY-TB. Tuberculosis
                surveillance for Davao City.
              </p>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                Made with <Heart className="h-3 w-3 text-red-400" /> for Davao City
              </p>
            </div>
          </div>
        </footer>
      )}
      <PublicChatbotFab />
    </div>
  );
}
