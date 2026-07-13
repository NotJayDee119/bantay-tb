import { Link } from "react-router-dom";
import {
  ArrowRight,
  Shield,
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
import { motion } from "motion/react";
import { Badge, Button, MotionCard } from "../../components/ui";
import heroImage from "../../assets/davao_city_midnight_blue_20260528_090346.png";
import ctaImage from "../../assets/dots1.jpg";

const FEATURES = [
  {
    icon: MapPin,
    title: "GIS Mapping & Hotspots",
    body: "Real-time geospatial visualization of TB cases and identification of high-risk areas for targeted interventions.",
  },
  {
    icon: Users,
    title: "Case Management",
    body: "Streamlined patient registration, treatment tracking, and outcome monitoring across all DOTS facilities.",
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    body: "Automated notifications for missed doses, treatment milestones, and outbreak detection via SMS.",
  },
  {
    icon: Heart,
    title: "Treatment Adherence",
    body: "Digital adherence monitoring with SMS reminders and visual progress tracking for patients.",
  },
  {
    icon: Stethoscope,
    title: "Clinical Decision Support",
    body: "Evidence-based treatment recommendations and drug interaction alerts for healthcare providers.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reporting",
    body: "Comprehensive dashboards and automated reports for program monitoring and evaluation.",
  },
];

const RESIDENT_POINTS = [
  { icon: MapPin, text: "Find the nearest DOTS treatment center" },
  { icon: BookOpen, text: "Read health guides in your language" },
  { icon: MessageSquare, text: "Ask questions to the AI health assistant" },
];

const WORKER_POINTS = [
  { icon: Activity, text: "Monitor TB cases across all barangays" },
  { icon: MapPin, text: "Detect hotspots with spatial analysis" },
  { icon: Bell, text: "Receive automated alerts when thresholds are crossed" },
];

export function Landing() {
  return (
    <>
      {/* ─── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200 min-h-[600px] sm:min-h-[700px] lg:min-h-[750px]">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Davao City"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-900/75 to-brand-900/85" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8 lg:py-40">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm"
            >
              <Shield className="h-4 w-4" />
              Davao City Health Office
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="font-display mb-6 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
            >
              BANTAY-TB
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-slate-100 sm:text-xl"
            >
              Comprehensive tuberculosis surveillance and management system for Davao City.
              Empowering healthcare workers and communities to end TB.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <Link to="/login">
                <Button size="lg" className="gap-2 text-base">
                  Access System
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/about">
                <Button size="lg" variant="secondary" className="border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20">
                  Learn More
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mb-12 text-center"
          >
            <Badge tone="info" className="mb-3">
              Platform capabilities
            </Badge>
            <h2 className="font-display mb-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Comprehensive TB Management
            </h2>
            <p className="mx-auto max-w-2xl text-base text-slate-600">
              Integrated tools for surveillance, case management, and community health
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <MotionCard key={f.title} delay={0.06 * i} className="p-6">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  {f.body}
                </p>
              </MotionCard>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Who is this for? ──────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-slate-50 bg-grid py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mb-10 text-center"
          >
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Built for two audiences
            </h2>
            <p className="mt-3 mx-auto max-w-2xl text-base text-slate-600">
              BANTAY-TB serves both the public and health professionals with purpose-built tools for each
            </p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-2">
            <MotionCard className="p-6 sm:p-8">
              <Badge tone="accent" className="mb-4">
                No account required
              </Badge>
              <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                For Davao City Residents
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Access TB information, find treatment facilities, and get health guidance — all without signing in.
              </p>
              <ul className="mt-5 space-y-3">
                {RESIDENT_POINTS.map((p) => (
                  <li key={p.text} className="flex items-start gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-50 text-accent-600">
                      <p.icon className="h-4 w-4" />
                    </div>
                    <span className="pt-1 text-sm leading-relaxed text-slate-700">{p.text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Link to="/dots-locator">
                  <Button variant="accent" className="gap-2">
                    Find a DOTS Center
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </MotionCard>

            <MotionCard delay={0.1} className="p-6 sm:p-8">
              <Badge tone="info" className="mb-4">
                Account required
              </Badge>
              <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                For Health Workers
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Operational tools for TB coordinators, barangay admins, and frontline health workers.
              </p>
              <ul className="mt-5 space-y-3">
                {WORKER_POINTS.map((p) => (
                  <li key={p.text} className="flex items-start gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <p.icon className="h-4 w-4" />
                    </div>
                    <span className="pt-1 text-sm leading-relaxed text-slate-700">{p.text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Link to="/login">
                  <Button className="gap-2">
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </MotionCard>
          </div>
        </div>
      </section>

      {/* ─── Why BANTAY-TB ─────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <Badge tone="default" className="mb-3">
                Why this matters
              </Badge>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                TB is curable. The barrier is access.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Davao City recorded <strong className="text-slate-900">8,601 TB cases</strong> in 2024.
                The main barriers to treatment completion are awareness, proximity to care, and
                follow-through on the 6-month DOTS protocol. BANTAY-TB addresses all three.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Designed for low-cost infrastructure",
                  "Minimal training required for health workers",
                  "Fully accessible to residents without an account",
                  "Compatible with existing paper-based workflows",
                ].map((text) => (
                  <li key={text} className="flex items-center gap-3 text-sm text-slate-700">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-500" />
                    {text}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="relative overflow-hidden rounded-2xl"
            >
              <img
                src={ctaImage}
                alt="DOTS center in Davao City"
                className="h-full w-full object-cover object-top"
                style={{ maxHeight: 400 }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-900/40 to-transparent" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-900/85 to-brand-900/90" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="font-display mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Need TB Treatment?
            </h2>
            <p className="mb-8 text-lg text-slate-200">
              Find the nearest DOTS facility in Davao City. Free diagnostics and medication available.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/dots-locator">
                <Button size="lg" className="gap-2 text-base">
                  Find DOTS Centers
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/learn">
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                >
                  Learn about TB
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
