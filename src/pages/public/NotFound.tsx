import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  LayoutDashboard,
  MapPin,
  MapPinOff,
} from "lucide-react";
import { Button } from "../../components/ui";
import heroImage from "../../assets/davao-city-hero.webp";

// Where a lost visitor most likely meant to go. Every one is a public page,
// so the list works whether or not anyone is signed in.
const DESTINATIONS = [
  {
    to: "/dots-locator",
    icon: MapPin,
    title: "Find a DOTS center",
    body: "Free TB testing and treatment near you.",
  },
  {
    to: "/learn",
    icon: BookOpen,
    title: "Health Education",
    body: "TB and other lung diseases, in plain words.",
  },
] as const;

/**
 * Unknown addresses used to bounce silently to the homepage, which looked
 * like a broken link had worked. This says plainly that the page isn't there
 * and offers the likely next step, in the same surveillance styling as the
 * other public heroes.
 */
export function NotFound() {
  const { pathname } = useLocation();
  // A mistyped dashboard link should lead back into the dashboard.
  const inApp = pathname.startsWith("/app");

  return (
    <section className="relative isolate flex min-h-[calc(100vh-4.5rem)] items-center overflow-hidden bg-brand-950">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <img
          src={heroImage}
          alt=""
          className="h-full w-full object-cover object-center opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-950/70 via-brand-950/60 to-brand-950" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-[-10%] h-[32rem] w-[32rem] rounded-full bg-accent-500/10 blur-[120px]"
      />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-200 backdrop-blur-sm">
            <MapPinOff className="h-3.5 w-3.5 text-vigil-400" aria-hidden />
            Error 404 · Page not found
          </div>
          <h1 className="font-display mt-6 max-w-2xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            This page isn&rsquo;t on <span className="text-accent-400">our map.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            The link may be old, or the address may have a typo. Nothing is
            wrong with your device &mdash; the page just doesn&rsquo;t exist.
          </p>
          <p className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-slate-400">
            <span className="shrink-0 text-slate-500">Looked for</span>
            <span className="truncate text-slate-200">{pathname}</span>
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to={inApp ? "/app" : "/"} className="group/cta">
              <Button variant="accent" size="lg" className="w-full justify-center gap-2 sm:w-auto">
                {inApp ? (
                  <>
                    <LayoutDashboard className="h-4 w-4" aria-hidden />
                    Back to dashboard
                  </>
                ) : (
                  "Back to home"
                )}
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
              </Button>
            </Link>
            {inApp && (
              <Link to="/">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full justify-center border-white/15 bg-white/5 text-white hover:border-white/25 hover:bg-white/10 sm:w-auto"
                >
                  Public homepage
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Likely destinations — the "radar" card mirrors the live map's
            panel so the page still feels like part of the instrument. */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5 lg:block"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[18rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07] lg:block"
          />
          <div className="relative rounded-2xl border border-white/10 bg-brand-950/80 p-2 shadow-lift backdrop-blur">
            <p className="px-4 pb-2 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              You might be looking for
            </p>
            <ul className="divide-y divide-white/5">
              {DESTINATIONS.map((d) => (
                <li key={d.to}>
                  <Link
                    to={d.to}
                    className="group flex items-center gap-4 rounded-xl px-4 py-4 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10 text-accent-400">
                      <d.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white">
                        {d.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-slate-400">
                        {d.body}
                      </span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-accent-400"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
