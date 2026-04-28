import {
  Activity,
  AlertTriangle,
  Bot,
  ClipboardList,
  Database,
  MapPinned,
  Pill,
  Stethoscope,
} from "lucide-react";
import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: MapPinned,
    title: "Barangay-level GIS Heatmap",
    body: "Live, interactive Leaflet map of TB and respiratory disease cases across all 182 Davao City barangays, drawn directly from CHO data.",
  },
  {
    icon: AlertTriangle,
    title: "Automated DBSCAN Hotspots",
    body: "Hotspot detection re-runs after every new case and notifies TB Coordinators when barangay density exceeds the configured threshold.",
  },
  {
    icon: ClipboardList,
    title: "Active Case Finding",
    body: "Frontliners encode presumptive and confirmed cases in seconds — barangay, age, sex, classification, treatment outcome.",
  },
  {
    icon: Stethoscope,
    title: "DOTS Center Locator",
    body: "Public, no-login map that finds the nearest TB-DOTS treatment facility using device GPS or barangay search.",
  },
  {
    icon: Database,
    title: "Bulk Excel Import",
    body: "Upload monthly CHO Excel reports. Auto-mapping, 5-row preview, and client-side PII stripping before any data is sent.",
  },
  {
    icon: Bot,
    title: "Multilingual AI Chatbot",
    body: "Health Q&A in English, Filipino, and Bisaya with automatic language detection (target ≥90% accuracy).",
  },
  {
    icon: Pill,
    title: "Medication Adherence",
    body: "Per-patient schedules, dose logs, and SMS reminders so non-adherence is flagged early to BHWs.",
  },
  {
    icon: Activity,
    title: "Health Promotion",
    body: "Plain-language education on TB, pneumonia, COVID-19, and asthma in Tagalog and Bisaya.",
  },
];

export function Landing() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
            <Activity className="h-3 w-3" /> Davao City · Capstone 2026
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            GIS-based spatial surveillance for{" "}
            <span className="text-brand-600">Tuberculosis</span> in Davao City
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            BANTAY-TB closes the geographic gap in TB surveillance with
            barangay-level mapping, automated hotspot detection, and
            community-friendly health tools — built on React.js and Supabase.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/dots-locator"
              className="rounded-md bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700"
            >
              Find a DOTS Center
            </Link>
            <Link
              to="/login"
              className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Health Worker Sign-in
            </Link>
            <Link
              to="/learn"
              className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Health Education
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900">
              Eight integrated modules, one platform
            </h2>
            <p className="mt-2 text-slate-600">
              Built around the workflows of barangay frontliners, BHWs, doctors,
              and the Davao City Health Office.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <f.icon className="h-8 w-8 text-brand-600" />
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900 py-12 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold">
            8,601 confirmed TB cases in Davao City in 2024.
          </h2>
          <p className="mt-2 text-slate-300">
            Talomo South recorded the most cases (505), followed by Buhangin
            (463) and Bunawan (459). Working-class adults aged 18–40 carry the
            heaviest burden.{" "}
            <span className="text-slate-400">
              Source: Davao City Health Office (2024).
            </span>
          </p>
        </div>
      </section>
    </>
  );
}
