import {
  ArrowRight,
  BookOpenCheck,
  HeartPulse,
  MapPin,
  MapPinned,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

const STATS = [
  { value: "8,601", label: "TB cases reported in 2024" },
  { value: "182", label: "Barangays in Davao City" },
  { value: "24/7", label: "Public information access" },
];

const PATIENT_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MapPin,
    title: "Find the nearest DOTS center",
    body: "Search accredited TB-DOTS facilities by location and barangay.",
  },
  {
    icon: BookOpenCheck,
    title: "Learn about TB and respiratory illness",
    body: "Plain-language guides in English, Filipino, and Bisaya.",
  },
  {
    icon: HeartPulse,
    title: "Talk to the BANTAY-TB assistant",
    body: "Ask everyday health questions any time — no sign-in required.",
  },
];

const WORKER_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Stethoscope,
    title: "Citywide case surveillance",
    body: "Monitor TB cases at the barangay level with a live operational dashboard.",
  },
  {
    icon: MapPinned,
    title: "Spatial hotspot detection",
    body: "Density-based clustering highlights barangays needing immediate attention.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based, privacy-aware access",
    body: "Coordinator, barangay, and clinic accounts each see only what they should.",
  },
];

export function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:py-24 lg:px-8">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
              Davao City Health Office
            </p>
            <h1 className="font-display mt-5 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Care, knowledge, and{" "}
              <span className="text-brand-700">surveillance</span> for
              tuberculosis in Davao City.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
              BANTAY-TB connects patients to care and equips Davao City health
              workers with the data they need — barangay by barangay.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/dots-locator"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700"
              >
                <MapPinned className="h-4 w-4" /> Find a DOTS Center
              </Link>
              <Link
                to="/login"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50"
              >
                <ShieldCheck className="h-4 w-4" /> Health Worker Sign-in
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-3 -z-10 rounded-3xl bg-gradient-to-br from-brand-100 via-brand-50 to-white" />
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lift">
              <img
                src="/images/hero.jpg"
                alt="Health worker using a mobile device to record patient information"
                className="aspect-[5/4] h-full w-full object-cover"
                loading="eager"
              />
            </div>
            <div className="absolute -bottom-5 -left-5 hidden w-56 rounded-xl border border-slate-200 bg-white p-4 shadow-lift sm:block">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    Public service
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    Free for residents
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-brand-700">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-px overflow-hidden bg-brand-700 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
          {STATS.map((s) => (
            <div key={s.label} className="px-4 py-2 text-center text-white sm:text-left">
              <p className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {s.value}
              </p>
              <p className="mt-2 text-xs uppercase tracking-wider text-brand-100">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* For Patients */}
      <section id="for-patients" className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="order-2 lg:order-1">
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-soft">
                <img
                  src="/images/for-patients.jpg"
                  alt="A community health worker checking a patient at a local clinic"
                  className="aspect-[4/3] h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                For patients &amp; families
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Reliable TB information, close to home.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Tuberculosis is treatable. BANTAY-TB helps Davao City residents
                find care quickly and understand the next steps — in their own
                language.
              </p>
              <ul className="mt-8 space-y-5">
                {PATIENT_POINTS.map((p) => (
                  <li key={p.title} className="flex gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                      <p.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{p.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        {p.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/dots-locator"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700"
                >
                  Open the DOTS locator
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/learn"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                >
                  Read the guides
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Health Workers */}
      <section id="for-workers" className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                For health workers
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                A clearer view of TB across the city.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                BANTAY-TB gives coordinators, barangay teams, and clinic staff a
                single, secure place to track cases, spot emerging clusters,
                and act early.
              </p>
              <ul className="mt-8 space-y-5">
                {WORKER_POINTS.map((p) => (
                  <li key={p.title} className="flex gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                      <p.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{p.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        {p.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700"
                >
                  Sign in to BANTAY-TB
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/register"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                >
                  Request an account
                </Link>
              </div>
            </div>
            <div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-soft">
                <img
                  src="/images/for-workers.jpg"
                  alt="Two health workers reviewing TB case data on a screen"
                  className="aspect-[4/3] h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-12 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Together against tuberculosis in Davao City.
            </h2>
            <p className="mt-2 text-slate-600">
              Built with Davao City frontliners, for Davao City residents.
            </p>
          </div>
          <Link
            to="/dots-locator"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700"
          >
            Find a DOTS Center near you
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
