import {
  Activity,
  ArrowRight,
  MapPinned,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";

const STATS = [
  { value: "8,601", label: "TB cases reported in 2024" },
  { value: "182", label: "Barangays covered" },
  { value: "24/7", label: "Public access" },
];

export function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-white" />
        <div className="absolute inset-0 -z-10 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,#000,transparent_70%)]" />
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-24 text-center sm:px-6 sm:pt-28 lg:px-8">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700"
          >
            Davao City Health Office
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="font-display mx-auto mt-4 max-w-4xl text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl"
          >
            Tuberculosis surveillance for{" "}
            <span className="bg-gradient-to-r from-brand-600 to-accent-600 bg-clip-text text-transparent">
              every barangay
            </span>{" "}
            in Davao City
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600"
          >
            A trusted, privacy-conscious platform that helps health workers and
            residents stay informed about TB across the city.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-9 flex flex-wrap justify-center gap-3"
          >
            <Link
              to="/dots-locator"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 active:scale-[0.98]"
            >
              <MapPinned className="h-4 w-4" /> Find a DOTS Center
            </Link>
            <Link
              to="/login"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-soft transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
            >
              <ShieldCheck className="h-4 w-4" /> Health Worker Sign-in
            </Link>
          </motion.div>

          {/* Hero stats strip */}
          <motion.dl
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4 rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-soft backdrop-blur"
          >
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <dt className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {s.value}
                </dt>
                <dd className="mt-1.5 text-[11px] uppercase tracking-wider text-slate-500">
                  {s.label}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </section>

      {/* Public utilities — two clean entry points, no feature lists */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.35 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-soft transition hover:shadow-lift"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-accent-50 text-brand-700">
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
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition group-hover:gap-2.5"
              >
                Open the locator
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-soft transition hover:shadow-lift"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-accent-50 text-brand-700">
                <Activity className="h-5 w-5" />
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
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition group-hover:gap-2.5"
              >
                Read the guides
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Closing impact section */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 py-20 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="font-display text-balance text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Better information, closer to home.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mt-4 text-pretty leading-relaxed text-slate-300"
          >
            Working alongside Davao City frontliners to make tuberculosis data
            more accessible — barangay by barangay.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-8"
          >
            <Link
              to="/dots-locator"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-slate-900 shadow-soft transition hover:bg-slate-100 active:scale-[0.98]"
            >
              Find a DOTS center near you
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
