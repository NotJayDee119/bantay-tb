import { Link } from "react-router-dom";
import {
  ArrowRight,
  MapPin,
  Users,
  Activity,
  Heart,
  Stethoscope,
  BarChart3,
  Bell,
  BookOpen,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../../components/ui";
import { PublicCaseMap } from "../../components/PublicCaseMap";
import heroImage from "../../assets/davao_city_midnight_blue_20260528_090346.png";
import ctaImage from "../../assets/dots1.jpg";

/* ── Capabilities — labelled by module, not a numbered sequence ──────── */
const CAPABILITIES = [
  {
    tag: "MAP",
    icon: MapPin,
    title: "GIS Mapping & Hotspots",
    body: "Near real-time geospatial view of TB cases with spatial detection of high-risk barangays for targeted response.",
  },
  {
    tag: "CASES",
    icon: Users,
    title: "Case Management",
    body: "Patient registration, treatment tracking, and outcome monitoring across every DOTS facility in the city.",
  },
  {
    tag: "ALERTS",
    icon: Bell,
    title: "Smart SMS Alerts",
    body: "Automated notifications for missed doses, treatment milestones, and outbreak thresholds — over plain SMS.",
  },
  {
    tag: "ADHERE",
    icon: Heart,
    title: "Treatment Adherence",
    body: "Digital observation of the daily dose, with reminders and visual progress across the 6-month course.",
  },
  {
    tag: "CDS",
    icon: Stethoscope,
    title: "Clinical Decision Support",
    body: "Evidence-based treatment guidance and drug-interaction checks at the point of care.",
  },
  {
    tag: "DATA",
    icon: BarChart3,
    title: "Analytics & Reporting",
    body: "Program dashboards and automated reports for monitoring, evaluation, and DOH submission.",
  },
];

const RESIDENT_POINTS = [
  { icon: MapPin, text: "Find the nearest DOTS treatment center" },
  { icon: BookOpen, text: "Read health guides in your language" },
  { icon: MessageSquare, text: "Ask the AI health assistant, any time" },
];

const WORKER_POINTS = [
  { icon: Activity, text: "Monitor TB cases across every barangay" },
  { icon: MapPin, text: "Detect hotspots with spatial analysis" },
  { icon: Bell, text: "Get alerted the moment a threshold is crossed" },
];

const WHY_IT_MATTERS = [
  "Runs on low-cost infrastructure",
  "Minimal training for health workers",
  "Fully usable by residents without an account",
  "Fits alongside existing paper workflows",
];

export function Landing() {
  return (
    <>
      {/* ─── Hero — full-width live case map with barangay filter ──── */}
      <section className="relative overflow-hidden bg-brand-950 text-white">
        {/* midnight-blue city photo + monitoring grid + emerald glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <img src={heroImage} alt="" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-950/70 via-brand-950/40 to-brand-950" />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid" />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 top-[-10%] h-[36rem] w-[36rem] rounded-full bg-accent-500/15 blur-[120px]"
        />

        <div className="relative mx-auto max-w-screen-2xl px-3 py-6 sm:px-5 sm:py-8">
          <PublicCaseMap className="h-[26rem] min-h-[24rem] sm:h-[32rem] md:h-[70vh] lg:h-[78vh] lg:min-h-[30rem]" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
              Live TB case map of Davao City — counts are grouped per barangay, so no
              patient is ever identifiable.
            </p>
            <Link
              to="/dots-locator"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-accent-400 transition hover:text-accent-300"
            >
              Find free treatment near you
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Two doors — the primary fork, elevated cards ─────────── */}
      <section className="border-b border-slate-200 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
              Start here
            </p>
            <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Two ways to use BANTAY-TB
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Residents can find care and answers without an account. Health
              workers sign in for the tools they use every day.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {/* residents */}
            <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-accent-200/70 bg-gradient-to-br from-white via-accent-50/50 to-accent-50 p-7 shadow-soft transition-shadow duration-300 hover:shadow-lift sm:p-9">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-100/80 blur-3xl transition-transform duration-500 group-hover:scale-125"
              />
              <div className="relative flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-600 text-white shadow-soft">
                    <Heart className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-accent-100 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-700">
                    No account needed
                  </span>
                </div>
                <h3 className="font-display mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Davao City residents
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Find treatment, learn about TB, and get answers — all without signing in.
                </p>
                <ul className="mt-6 space-y-2.5">
                  {RESIDENT_POINTS.map((p) => (
                    <li
                      key={p.text}
                      className="flex items-center gap-3 rounded-xl border border-accent-100 bg-white/80 px-3.5 py-2.5 backdrop-blur-sm"
                    >
                      <p.icon className="h-4 w-4 shrink-0 text-accent-600" />
                      <span className="text-sm leading-relaxed text-slate-700">{p.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative mt-8">
                <Link to="/dots-locator">
                  <Button variant="accent" className="w-full justify-center gap-2 sm:w-auto">
                    Find a DOTS center
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* workers */}
            <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-brand-900 bg-brand-950 p-7 text-white shadow-soft transition-shadow duration-300 hover:shadow-lift sm:p-9">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-60" />
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-500/10 blur-3xl transition-transform duration-500 group-hover:scale-125"
              />
              <div className="relative flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-accent-400 ring-1 ring-white/15">
                    <Activity className="h-6 w-6" />
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-200">
                    Account required
                  </span>
                </div>
                <h3 className="font-display mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Health workers
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Operational tools for TB coordinators, barangay admins, and frontline workers.
                </p>
                <ul className="mt-6 space-y-2.5">
                  {WORKER_POINTS.map((p) => (
                    <li
                      key={p.text}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5"
                    >
                      <p.icon className="h-4 w-4 shrink-0 text-accent-400" />
                      <span className="text-sm leading-relaxed text-slate-200">{p.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative mt-8 flex flex-wrap gap-3">
                <Link to="/login">
                  <Button className="gap-2">
                    Sign in
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Button>
                </Link>
                <Link to="/register">
                  <Button
                    variant="secondary"
                    className="border-white/15 bg-white/5 text-white hover:border-white/25 hover:bg-white/10"
                  >
                    Request an account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works — plain numbered steps ───────────────────── */}
      <section className="border-b border-slate-200 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
              How it works
            </p>
            <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              From first visit to a completed course
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Four steps, free of charge, from screening to a documented cure.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Get screened",
                body: "Visit any DOTS center in Davao City for a free TB diagnosis — no appointment needed.",
              },
              {
                step: "02",
                title: "Start treatment",
                body: "Begin the free 6-month medication course, dispensed at your chosen facility.",
              },
              {
                step: "03",
                title: "Daily observation",
                body: "A health worker confirms every dose in person, the core of the DOTS protocol.",
              },
              {
                step: "04",
                title: "Complete the course",
                body: "Finish all 6 months and get documented as cured in the city's TB registry.",
              },
            ].map((s, i, steps) => (
              <div
                key={s.step}
                className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      "grid h-10 w-10 place-items-center rounded-xl font-display text-sm font-extrabold " +
                      (i === steps.length - 1
                        ? "bg-accent-600 text-white"
                        : "bg-brand-950 text-white")
                    }
                  >
                    {s.step}
                  </span>
                  {i === steps.length - 1 ? (
                    <CheckCircle2 className="h-4 w-4 text-accent-500" />
                  ) : (
                    <ArrowRight className="h-4 w-4 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-brand-600" />
                  )}
                </div>
                <h3 className="font-display mt-4 text-lg font-bold tracking-tight text-slate-900">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Capabilities — bento, GIS mapping as the flagship tile ── */}
      <section className="border-b border-slate-200 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className="max-w-2xl"
          >
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
              What the platform does
            </p>
            <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Six modules, built around one goal
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              From detecting a hotspot to logging the final dose of a six-month course.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[repeat(2,minmax(0,1fr))_auto]">
            {CAPABILITIES.map((c, i) => {
              const featured = i === 0;
              return (
                <div
                  key={c.title}
                  className={
                    "group relative overflow-hidden border shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift " +
                    (featured
                      ? "rounded-3xl border-brand-900 bg-brand-950 p-7 text-white lg:col-span-2 lg:row-span-2 lg:p-9"
                      : "rounded-2xl border-slate-200 bg-white p-6")
                  }
                >
                  {featured && (
                    <>
                      <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-60" />
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-500/10 blur-3xl transition-transform duration-500 group-hover:scale-125"
                      />
                    </>
                  )}
                  <div className="relative flex items-start justify-between gap-3">
                    <span
                      className={
                        "grid place-items-center transition-transform duration-300 group-hover:-translate-y-0.5 " +
                        (featured
                          ? "h-14 w-14 rounded-2xl bg-white/10 text-accent-400 ring-1 ring-white/15"
                          : "h-11 w-11 rounded-xl bg-brand-950 text-white")
                      }
                    >
                      <c.icon className={featured ? "h-7 w-7" : "h-5 w-5"} />
                    </span>
                    <span
                      className={
                        "rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] " +
                        (featured
                          ? "border border-white/15 bg-white/10 text-brand-200"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {c.tag}
                    </span>
                  </div>
                  <h3
                    className={
                      "relative font-display mt-4 font-bold tracking-tight " +
                      (featured ? "text-2xl text-white lg:mt-8" : "text-lg text-slate-900")
                    }
                  >
                    {c.title}
                  </h3>
                  <p
                    className={
                      "relative mt-1.5 leading-relaxed " +
                      (featured ? "max-w-sm text-sm text-slate-300" : "text-sm text-slate-600")
                    }
                  >
                    {c.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Why it matters — 8,601 as the moment ──────────────────── */}
      <section className="border-b border-slate-200 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
            <div
            >
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
                Why this matters
              </p>
              <div className="mt-4 flex items-end gap-4">
                <span className="font-display text-6xl font-black leading-none tracking-tight text-brand-950 sm:text-7xl">
                  8,601
                </span>
                <span className="mb-1.5 font-mono text-xs uppercase leading-tight tracking-wider text-slate-500">
                  TB cases in
                  <br />
                  Davao, 2024
                </span>
              </div>
              <div className="mt-3 h-1 w-24 rounded-full bg-vigil-400" />

              <h2 className="font-display mt-6 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                TB is curable. The barrier is access.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                The gap between diagnosis and a completed course comes down to three things:
                awareness, proximity to care, and following through on the 6-month DOTS
                protocol. BANTAY-TB is built to close all three.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {WHY_IT_MATTERS.map((text) => (
                  <div
                    key={text}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-soft transition-shadow duration-300 hover:shadow-lift"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-500" />
                    {text}
                  </div>
                ))}
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-3xl border border-slate-200 shadow-lift">
              <img
                src={ctaImage}
                alt="A DOTS treatment center in Davao City"
                className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
                style={{ maxHeight: 440 }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-brand-950/10 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="inline-flex flex-col rounded-xl border border-white/15 bg-brand-950/70 px-3.5 py-2.5 backdrop-blur">
                  <span className="text-sm font-semibold text-white">
                    A DOTS treatment center in Davao City
                  </span>
                  <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-300">
                    Directly Observed Treatment, Short-course
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-950">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 bottom-[-30%] h-[30rem] w-[30rem] rounded-full bg-accent-500/12 blur-[110px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-[-30%] h-[26rem] w-[26rem] rounded-full bg-brand-500/10 blur-[100px]"
        />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
          <div
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-200 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              Free diagnostics &middot; free medication
            </p>
            <h2 className="font-display mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Need TB treatment? Care is closer than you think.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
              Find the nearest DOTS facility in Davao City and start the 6-month course.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/dots-locator">
                <Button variant="accent" size="lg" className="gap-2 text-base">
                  Find DOTS centers
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/learn">
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-white/15 bg-white/5 text-white backdrop-blur-sm hover:border-white/25 hover:bg-white/10"
                >
                  Learn about TB
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
