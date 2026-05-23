import { ArrowRight, MapPinned, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const STATS = [
  { value: "8,601", label: "TB cases reported in 2024" },
  { value: "182", label: "Barangays covered" },
  { value: "24/7", label: "Public access" },
];

export function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 pb-20 pt-24 text-center sm:px-6 sm:pt-28 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            Davao City Health Office
          </p>
          <h1 className="font-display mx-auto mt-4 max-w-3xl text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Tuberculosis surveillance for every barangay in Davao City
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
            A trusted, privacy-conscious platform that helps health workers and
            residents stay informed about TB across the city.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              to="/dots-locator"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
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
      </section>

      {/* Stats strip */}
      <section className="border-b border-slate-200 bg-slate-50">
        <dl className="mx-auto grid max-w-5xl grid-cols-1 gap-px overflow-hidden bg-slate-200 sm:grid-cols-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="bg-white px-6 py-8 text-center"
            >
              <dt className="font-display text-3xl font-bold tracking-tight text-slate-900">
                {s.value}
              </dt>
              <dd className="mt-2 text-xs uppercase tracking-wider text-slate-500">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Public utilities */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-7">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <MapPinned className="h-5 w-5" />
              </div>
              <h3 className="font-display mt-5 text-xl font-semibold tracking-tight text-slate-900">
                Find the nearest DOTS center
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Locate accredited TB-DOTS facilities across the city. No
                sign-in required.
              </p>
              <Link
                to="/dots-locator"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                Open the locator
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-7">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-display mt-5 text-xl font-semibold tracking-tight text-slate-900">
                Learn about TB and related illnesses
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Plain-language guides on Tuberculosis, pneumonia, COVID-19, and
                asthma — written for patients and families.
              </p>
              <Link
                to="/learn"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                Read the guides
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
