import { useEffect, useState } from "react";
import { Activity, Menu, X } from "lucide-react";
import { Link, NavLink, useLocation, useOutlet } from "react-router-dom";
import { PublicChatbotFab } from "./PublicChatbotFab";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/dots-locator", label: "DOTS Locator" },
  { to: "/learn", label: "Health Education" },
];

const FOOTER_PATIENT_LINKS = [
  { to: "/dots-locator", label: "DOTS Locator" },
  { to: "/learn", label: "Health Education" },
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

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white shadow-soft">
              <Activity className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900">
              BANTAY-TB
            </span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            {NAV.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  "rounded-md px-3 py-2 font-medium " +
                  (isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-700 hover:bg-slate-100")
                }
              >
                {l.label}
              </NavLink>
            ))}
            <Link
              to="/login"
              className="ml-2 inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-soft hover:bg-brand-700"
            >
              Sign in
            </Link>
          </nav>
          <div className="flex items-center gap-2 sm:hidden">
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-3 text-sm font-medium text-white shadow-soft"
            >
              Sign in
            </Link>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-md p-2 text-slate-700 hover:bg-slate-100"
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
          <div className="border-t border-slate-200 bg-white sm:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm sm:px-6">
              {NAV.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  className={({ isActive }) =>
                    "rounded-md px-3 py-2 font-medium " +
                    (isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-700 hover:bg-slate-100")
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1">{outlet}</main>
      <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
                <Activity className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-white">
                BANTAY-TB
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              A public-information and surveillance platform for tuberculosis
              in Davao City — connecting residents to care and supporting
              frontline health workers.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              For patients
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {FOOTER_PATIENT_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-slate-400 transition hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              For health workers
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {FOOTER_WORKER_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-slate-400 transition hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
            <p>
              &copy; {new Date().getFullYear()} BANTAY-TB. Tuberculosis
              surveillance for Davao City.
            </p>
            <p>All rights reserved.</p>
          </div>
        </div>
      </footer>
      <PublicChatbotFab />
    </div>
  );
}
