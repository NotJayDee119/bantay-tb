import {
  Activity,
  AlertTriangle,
  Bot,
  ClipboardList,
  Database,
  MapPinned,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: MapPinned,
    title: "Barangay-level GIS Heatmap",
    body: "Live, interactive Leaflet map of TB and respiratory cases across all 182 Davao City barangays — drawn directly from CHO records.",
  },
  {
    icon: AlertTriangle,
    title: "Automated DBSCAN Hotspots",
    body: "Hotspot detection re-runs after every new case and notifies the right barangay frontliners when density crosses the configured threshold.",
  },
  {
    icon: ClipboardList,
    title: "Active Case Finding",
    body: "Frontliners encode presumptive and confirmed cases in seconds — barangay, age, sex, classification, treatment outcome.",
  },
  {
    icon: Stethoscope,
    title: "DOTS Center Locator",
    body: "Public, no-login map that finds the nearest TB-DOTS facility using device GPS or barangay search.",
  },
  {
    icon: Database,
    title: "Bulk Excel Import",
    body: "Upload monthly CHO Excel reports. Auto-mapping, 5-row preview, and client-side PII stripping before any data is sent.",
  },
  {
    icon: Bot,
    title: "Multilingual AI Chatbot",
    body: "Health Q&A in English, Filipino, and Bisaya with automatic language detection (≥90% accuracy target).",
  },
  {
    icon: Pill,
    title: "Medication Adherence",
    body: "Per-patient schedules, dose logs, and SMS reminders so non-adherence is flagged early to BHWs.",
  },
  {
    icon: Activity,
    title: "Health Promotion",
    body: "Plain-language education on TB, pneumonia, COVID-19, and asthma — translated to Tagalog and Bisaya.",
  },
];

const STATS = [
  { value: "8,601", label: "TB cases · Davao City 2024" },
  { value: "182", label: "Barangays mapped" },
  { value: "≥90%", label: "Chatbot language accuracy" },
];

export function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 via-white to-white" />
        <div className="absolute inset-0 -z-10 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,#000,transparent_70%)]" />
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-xs font-medium text-brand-700 shadow-soft backdrop-blur"
          >
            <Sparkles className="h-3 w-3" /> Davao City · Capstone 2026
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="font-display mx-auto mt-5 max-w-4xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl"
          >
            GIS-based spatial surveillance for{" "}
            <span className="bg-gradient-to-r from-brand-600 to-accent-600 bg-clip-text text-transparent">
              Tuberculosis
            </span>{" "}
            in Davao City
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-5 max-w-2xl text-lg text-slate-600"
          >
            BANTAY-TB closes the geographic gap in TB surveillance with
            barangay-level mapping, automated DBSCAN hotspot detection, and
            community-friendly health tools — built on React.js and Supabase.
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
            <Link
              to="/learn"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-soft transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
            >
              <Activity className="h-4 w-4" /> Health Education
            </Link>
          </motion.div>

          {/* Hero stats strip */}
          <motion.dl
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-white/70 p-4 shadow-soft backdrop-blur"
          >
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <dt className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {s.value}
                </dt>
                <dd className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">
                  {s.label}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Eight integrated modules, one platform
            </h2>
            <p className="mt-3 text-slate-600">
              Built around the workflows of barangay frontliners, BHWs, doctors,
              and the Davao City Health Office.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                whileHover={{ y: -3 }}
                className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-soft transition-shadow hover:shadow-lift"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-50 to-accent-50 text-brand-700">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display mt-4 text-base font-semibold tracking-tight text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {f.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing impact section */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 py-16 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="font-display text-3xl font-bold tracking-tight sm:text-4xl"
          >
            8,601 confirmed TB cases in Davao City in 2024.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mt-4 text-slate-300"
          >
            Talomo South recorded the most cases (505), followed by Buhangin
            (463) and Bunawan (459). Working-class adults aged 18–40 carry the
            heaviest burden.{" "}
            <span className="text-slate-400">
              Source: Davao City Health Office (2024).
            </span>
          </motion.p>
        </div>
      </section>
    </>
  );
}
