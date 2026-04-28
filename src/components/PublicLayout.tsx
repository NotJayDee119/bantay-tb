import { Activity } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-brand-600" />
            <span className="text-lg font-bold text-slate-900">BANTAY-TB</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {[
              { to: "/", label: "Home" },
              { to: "/dots-locator", label: "DOTS Center Locator" },
              { to: "/learn", label: "Health Education" },
              { to: "/login", label: "Sign in" },
            ].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  "rounded-md px-3 py-2 font-medium transition " +
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
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-slate-500 sm:px-6 lg:px-8">
          <p>BANTAY-TB · GIS-based TB surveillance for Davao City.</p>
          <p className="mt-1">
            University of the Immaculate Conception · IT Capstone Project 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
