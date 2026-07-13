import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  Building2,
  Clock,
  HeartPulse,
  Lock,
  MapPin,
  MapPinned,
  MessageSquare,
  Shield,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Badge, Button, MotionCard } from "../../components/ui";
import heroImage from "../../assets/davao_city_midnight_blue_20260528_090346.png";
import ctaImage from "../../assets/dots1.jpg";

const PUBLIC_FEATURES = [
  {
    icon: MapPin,
    title: "TB-DOTS Facility Locator",
    body: "Interactive map showing all accredited TB-DOTS centers across Davao City's 182 barangays. Search by barangay name or use GPS to find the nearest treatment facility, view contact details, and get directions.",
  },
  {
    icon: BookOpenCheck,
    title: "Health Education",
    body: "Plain-language guides on tuberculosis, symptoms, treatment, and respiratory illness — available in English, Filipino, and Bisaya. Designed for everyday reading, not medical staff.",
  },
  {
    icon: MessageSquare,
    title: "AI Health Assistant",
    body: "A conversational chatbot that answers common TB and health questions any time of day. No account required. Responses are grounded in verified public health information.",
  },
];

const WORKER_FEATURES = [
  {
    icon: Stethoscope,
    title: "Case Surveillance Dashboard",
    body: "Live operational view of TB cases filed across all barangays. Filter by date, status, barangay, and treatment stage. Built for daily use by coordinators and health workers.",
  },
  {
    icon: MapPinned,
    title: "GIS Hotspot Detection",
    body: "Spatial clustering using DBSCAN algorithms automatically identifies barangays with elevated case concentrations. Updated as new cases are encoded — no manual analysis required.",
  },
  {
    icon: Bell,
    title: "Automated Alerts",
    body: "Threshold-based alerts notify TB coordinators when a barangay's case count crosses a configurable limit. SMS delivery via Supabase Edge Functions.",
  },
  {
    icon: HeartPulse,
    title: "Treatment Adherence Tracking",
    body: "Daily adherence logging for patients under DOTS treatment. Health workers can monitor check-in streaks and identify patients at risk of dropping out.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    body: "Citywide trends, barangay-level breakdowns, treatment outcome summaries, and case registration timelines — exportable for health office reporting.",
  },
  {
    icon: Users,
    title: "Bulk Case Import",
    body: "Import large batches of TB case records from Excel files. Validated against the database schema before committing — prevents duplicate or malformed entries.",
  },
];

const ROLES = [
  {
    icon: ShieldCheck,
    role: "TB Coordinator",
    access:
      "Full citywide view — case management, bulk import, hotspot analysis, alerts, analytics, DOTS center admin, and user management.",
  },
  {
    icon: Building2,
    role: "Barangay Admin",
    access:
      "Cases and alerts scoped to their barangay. Can register new cases and view barangay-level analytics.",
  },
  {
    icon: Stethoscope,
    role: "Health Worker",
    access:
      "Adherence tracking for assigned patients, read access to cases and hotspot maps, community dispensing records.",
  },
  {
    icon: HeartPulse,
    role: "Patient",
    access:
      "Personal adherence log and health education content. No access to other patients' data.",
  },
  {
    icon: UserCog,
    role: "System Admin",
    access:
      "Full access including user management, system settings, and all coordinator functions. Assigned by the City Health Office.",
  },
];

const STATS = [
  { value: "8,601", label: "TB cases recorded in 2024", icon: Activity },
  { value: "182", label: "Barangays covered", icon: MapPin },
  { value: "6 months", label: "Standard DOTS treatment", icon: Clock },
];

export function About() {
  return (
    <>
      {/* ─── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200 min-h-[480px] sm:min-h-[540px]">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Davao City"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-900/75 to-brand-900/85" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
              <Shield className="h-4 w-4" />
              About BANTAY-TB
            </div>
            <h1 className="font-display max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              A public health platform for TB surveillance in Davao City.
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            className="mt-5 max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg"
          >
            BANTAY-TB is a web-based system developed for the Davao City Health
            Office that serves two audiences — Davao City residents who need
            information and access to care, and health workers who need
            operational tools to monitor, track, and respond to tuberculosis
            across the city.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link to="/">
              <Button size="lg" className="gap-2">
                Find a DOTS Center
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="secondary"
                className="border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
              >
                Sign in — health workers
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── Stats Bar ─────────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-brand-900">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * i, ease: "easeOut" }}
                className="flex items-center gap-4"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10">
                  <s.icon className="h-5 w-5 text-white/80" />
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-white">
                    {s.value}
                  </p>
                  <p className="text-sm text-slate-300">{s.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Background ────────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-slate-50 bg-grid">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Why this system was built
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                <p>
                  Davao City recorded{" "}
                  <strong className="text-slate-900">8,601 TB cases</strong> in
                  2024 across 182 barangays. Managing that caseload requires
                  more than a spreadsheet — it requires a system that can show
                  where cases are clustering, flag patients at risk of dropping
                  out of treatment, and give residents a reliable way to find
                  care.
                </p>
                <p>
                  TB is curable with proper treatment. The main barriers are
                  awareness, proximity to care, and consistent follow-through on
                  the 6-month DOTS treatment protocol. BANTAY-TB addresses all
                  three.
                </p>
                <p>
                  The system was designed to run on low-cost infrastructure,
                  require minimal training for health workers, and be fully
                  accessible to residents without an account.
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            >
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                How it fits into existing workflows
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                <p>
                  BANTAY-TB is designed to complement — not replace — existing
                  paper-based recording and manual reporting processes used by
                  the City Health Office. Data encoded into the system mirrors
                  the National TB Program's standard case classification and
                  treatment outcome categories.
                </p>
                <p>
                  Health workers can import existing Excel records in bulk,
                  eliminating double-entry for facilities already maintaining
                  spreadsheets. New cases can be registered directly in the
                  system at the point of diagnosis.
                </p>
                <p>
                  Automatic spatial analysis runs in the background — no manual
                  GIS work required from coordinators.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Public Features ───────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Badge tone="accent" className="mb-3">
              No account required
            </Badge>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Public-facing features
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              All three of these are available to anyone — resident, patient, or
              family member — with no sign-in and no personal data collected.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {PUBLIC_FEATURES.map((f, i) => (
              <MotionCard key={f.title} delay={0.08 * i} className="p-6">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-base font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {f.body}
                </p>
              </MotionCard>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Worker Features ───────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-slate-50 bg-grid">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Badge tone="info" className="mb-3">
              Account required
            </Badge>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Operational tools
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              These features are restricted to verified health workers,
              coordinators, and administrators. Access is role-gated — each
              account only sees what is relevant to their function.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WORKER_FEATURES.map((f, i) => (
              <MotionCard key={f.title} delay={0.06 * i} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-brand-50 text-brand-600">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                      {f.body}
                    </p>
                  </div>
                </div>
              </MotionCard>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Access Roles ──────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex items-start gap-4"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-100">
              <Lock className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
                Privacy &amp; access control
              </p>
              <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Role-based, need-to-know access
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
                Every account is assigned a role at registration. The system
                enforces access boundaries at both the API and UI layer — no
                role can see data outside its scope.
              </p>
            </div>
          </motion.div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r, i) => (
              <MotionCard key={r.role} delay={0.06 * i} className="p-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <r.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">
                  {r.role}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {r.access}
                </p>
              </MotionCard>
            ))}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-slate-500">
            Patient records are linked to an anonymised case ID within the
            system. Health workers see case data but not personally identifying
            information beyond what is operationally necessary. All data is
            stored on Supabase (PostgreSQL) with row-level security enforced at
            the database layer.
          </p>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={ctaImage}
            alt="DOTS Centers"
            className="h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/85 to-brand-900/90" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Ready to use BANTAY-TB?
            </h2>
            <p className="mt-3 text-base text-slate-200">
              Residents can access the DOTS locator and health guides right
              now. Health workers can request an account from their supervisor.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/">
                <Button size="lg" className="gap-2">
                  Go to the DOTS map
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/register">
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                >
                  Request an account
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
