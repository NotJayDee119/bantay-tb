import { Link, useLocation } from "react-router-dom";
import { ArrowRight, LayoutDashboard, MapPinOff } from "lucide-react";
import { Card } from "../../components/ui";

/**
 * 404 for a mistyped or outdated `/app/...` address. It renders inside the
 * app shell, so signed-in staff keep their sidebar and can carry on from it
 * instead of being dropped onto the public site's 404.
 */
export function AppNotFound() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg p-6 sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600">
          <MapPinOff className="h-3.5 w-3.5 text-brand-600" aria-hidden />
          Error 404 · Page not found
        </div>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-slate-900">
          This page isn&rsquo;t part of the dashboard
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          The link may be old, or the address may have a typo. Use the menu on
          the left, or go back to your dashboard.
        </p>
        <p className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-500">
          <span className="shrink-0">Looked for</span>
          <span className="truncate text-slate-800">{pathname}</span>
        </p>
        <div className="mt-6">
          <Link
            to="/app"
            className="group inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            Back to dashboard
            <ArrowRight
              className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>
      </Card>
    </div>
  );
}
