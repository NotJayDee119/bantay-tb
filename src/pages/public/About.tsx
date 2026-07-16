import {
  Activity,
  ArrowRight,
  Bell,
  BookOpenCheck,
  Clock,
  Eye,
  FileSpreadsheet,
  Handshake,
  Heart,
  HeartPulse,
  Lock,
  MapPin,
  MapPinned,
  MessageSquare,
  Shield,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui";
import heroImage from "../../assets/davao_city_midnight_blue_20260528_090346.png";
import ctaImage from "../../assets/dots1.jpg";

const STATS = [
  { value: "8,601", label: "TB cases recorded in 2024", icon: Activity },
  { value: "182", label: "Barangays covered", icon: MapPin },
  { value: "6 months", label: "Standard DOTS treatment", icon: Clock },
];


export function About() {
  return (
    <>
      {/* ─── Hero — matches the landing surveillance styling ───────── */}
      <section className="relative overflow-hidden bg-brand-950">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <img
            src={heroImage}
            alt=""
            className="h-full w-full object-cover object-center opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-950/70 via-brand-950/50 to-brand-950" />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid" />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 top-[-20%] h-[36rem] w-[36rem] rounded-full bg-accent-500/15 blur-[120px]"
        />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
            <Shield className="h-3.5 w-3.5 text-accent-400" />
            About BANTAY-TB
          </div>
          <h1 className="font-display mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Keeping watch over tuberculosis in{" "}
            <span className="text-accent-400">Davao City.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            BANTAY-TB — <span className="italic">"to keep watch"</span> — helps
            the city see TB clearly: where cases are rising, which communities
            need help first, and how every patient can reach free diagnosis and
            finish their treatment.
          </p>

          {/* Stats — glass ticker, mirrors the landing hero */}
          <div className="mt-14 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm sm:flex-row sm:divide-x sm:divide-white/10">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-1 items-center gap-4 px-6 py-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/10 text-accent-400">
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-2xl font-extrabold tracking-tight text-white">
                    {s.value}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-slate-400">
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Mission & Vision ──────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
              Who we are
            </p>
            <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              One goal: a city free of TB
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {/* Mission */}
            <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-brand-900 bg-brand-950 p-7 text-white shadow-soft transition-shadow duration-300 hover:shadow-lift sm:p-9">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-60" />
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-500/10 blur-3xl transition-transform duration-500 group-hover:scale-125"
              />
              <div className="relative">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-accent-400 ring-1 ring-white/15">
                  <Target className="h-6 w-6" />
                </div>
                <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
                  Our mission
                </p>
                <h3 className="font-display mt-2 text-2xl font-bold tracking-tight text-white">
                  Make TB visible — and treatable — in every barangay
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                  To give health workers a clear picture of where tuberculosis is
                  spreading, and to give every resident a clear path to free
                  testing, free medicine, and trustworthy health information — in
                  their own language.
                </p>
              </div>
            </div>

            {/* Vision */}
            <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-accent-200/70 bg-gradient-to-br from-white via-accent-50/50 to-accent-50 p-7 shadow-soft transition-shadow duration-300 hover:shadow-lift sm:p-9">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-100/80 blur-3xl transition-transform duration-500 group-hover:scale-125"
              />
              <div className="relative">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-600 text-white shadow-soft">
                  <Eye className="h-6 w-6" />
                </div>
                <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-700">
                  Our vision
                </p>
                <h3 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-900">
                  No case unseen. No treatment unfinished.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                  A Davao City where every TB case is found early, every patient
                  completes the full six-month cure, and every community has the
                  knowledge and access it needs to end TB for good.
                </p>
              </div>
            </div>
          </div>

          {/* What we stand for */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Heart,
                title: "Free and open to all",
                body: "Residents can use the locator, health guides, and assistant without an account.",
              },
              {
                icon: ShieldCheck,
                title: "Privacy first",
                body: "Only community-level totals are ever shown — never anyone's personal information.",
              },
              {
                icon: MapPin,
                title: "Barangay-level focus",
                body: "Help is directed where it's needed — community by community, not just citywide.",
              },
              {
                icon: Handshake,
                title: "Partnership, not replacement",
                body: "Built to work alongside the City Health Office and its existing systems.",
              },
            ].map((v) => (
              <div
                key={v.title}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-colors duration-300 group-hover:bg-brand-950 group-hover:text-accent-400">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display mt-3.5 text-sm font-bold tracking-tight text-slate-900">
                  {v.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Background ────────────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
              The problem we're solving
            </p>
            <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Why Davao City needs BANTAY-TB
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-soft transition-shadow duration-300 hover:shadow-lift sm:p-9">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-950 text-white">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="font-display mt-5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Why this system was built
              </h3>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                <p>
                  TB remains the world's leading cause of death from a single
                  infectious disease — an estimated{" "}
                  <strong className="text-slate-900">10.8 million people</strong>{" "}
                  fell ill in 2023, and the Philippines is among the five
                  countries carrying more than half the global burden. Davao
                  City's caseload rose from 8,212 confirmed cases in 2023 to{" "}
                  <strong className="text-slate-900">8,601 in 2024</strong>,
                  placing it among the highest-burden urban centers in Mindanao.
                </p>
                <p>
                  Cases are not randomly distributed — they cluster. Talomo
                  South recorded 505 cases in 2024, Buhangin 463, and Bunawan
                  459. Yet existing systems report only numbers and tables, with
                  no way to see <em>where</em> cases concentrate at the barangay
                  level — the operational unit where outreach actually happens.
                </p>
                <p>
                  BANTAY-TB closes that gap with an easy-to-read city map that
                  highlights where cases are concentrating — simple to run,
                  simple to learn, and fully usable by residents without an
                  account.
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-soft transition-shadow duration-300 hover:shadow-lift sm:p-9">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-600 text-white">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-display mt-5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                How it fits into existing workflows
              </h3>
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
            </div>
          </div>
        </div>
      </section>

      {/* ─── Works alongside ITIS — complement, not replacement ────── */}
      <section className="border-b border-slate-200 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
              Working alongside the city
            </p>
            <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              We support the city's health systems — we don't replace them
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              The city's official TB records and reporting stay exactly as they
              are today.{" "}
              <strong className="text-slate-900">
                BANTAY-TB doesn't replace any of it
              </strong>{" "}
              — it works alongside the City Health Office, adding the one thing
              the current tools can't show: a living map of where TB is
              spreading, community by community.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-display mt-4 text-base font-bold tracking-tight text-slate-900">
                Official records stay official
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Nothing changes in how the city records and reports TB cases —
                health workers keep the same process they use today.
              </p>
            </div>
            <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-950 text-accent-400">
                <MapPinned className="h-5 w-5" />
              </div>
              <h3 className="font-display mt-4 text-base font-bold tracking-tight text-slate-900">
                We add the map
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                A clear picture of which communities have rising cases — the
                view that numbers and tables alone can't give.
              </p>
            </div>
            <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-600 text-white">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="font-display mt-4 text-base font-bold tracking-tight text-slate-900">
                No extra work for health staff
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                The reports the city already prepares are simply brought into
                the system — the map updates on its own.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── What the system does — in everyday words ──────────────── */}
      <section className="border-b border-slate-200 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
              In everyday words
            </p>
            <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              What BANTAY-TB does for you
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {/* For residents */}
            <div className="relative overflow-hidden rounded-3xl border border-accent-200/70 bg-gradient-to-br from-white via-accent-50/50 to-accent-50 p-7 shadow-soft sm:p-9">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-100/80 blur-3xl"
              />
              <div className="relative">
                <span className="rounded-full bg-accent-100 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-700">
                  For you and your family
                </span>
                <h3 className="font-display mt-4 text-2xl font-bold tracking-tight text-slate-900">
                  If you or a loved one needs help
                </h3>
                <ul className="mt-6 space-y-2.5">
                  {[
                    { icon: MapPin, text: "Find the nearest treatment center — testing and medicine are free" },
                    { icon: BookOpenCheck, text: "Learn about TB in English, Filipino, or Bisaya" },
                    { icon: MessageSquare, text: "Ask the health assistant any question, any time of day" },
                  ].map((p) => (
                    <li
                      key={p.text}
                      className="flex items-center gap-3 rounded-xl border border-accent-100 bg-white/80 px-3.5 py-2.5 backdrop-blur-sm"
                    >
                      <p.icon className="h-4 w-4 shrink-0 text-accent-600" />
                      <span className="text-sm leading-relaxed text-slate-700">{p.text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm leading-relaxed text-slate-600">
                  No account, no sign-up, and nothing about you is collected.
                </p>
              </div>
            </div>

            {/* For the city */}
            <div className="relative overflow-hidden rounded-3xl border border-brand-900 bg-brand-950 p-7 text-white shadow-soft sm:p-9">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-60" />
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-500/10 blur-3xl"
              />
              <div className="relative">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-200">
                  For the people protecting the city
                </span>
                <h3 className="font-display mt-4 text-2xl font-bold tracking-tight text-white">
                  Helping health workers act early
                </h3>
                <ul className="mt-6 space-y-2.5">
                  {[
                    { icon: MapPinned, text: "See where cases are rising, community by community" },
                    { icon: Bell, text: "Get an early warning when a neighborhood needs attention" },
                    { icon: HeartPulse, text: "Walk with every patient until the full 6-month cure is complete" },
                  ].map((p) => (
                    <li
                      key={p.text}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5"
                    >
                      <p.icon className="h-4 w-4 shrink-0 text-accent-400" />
                      <span className="text-sm leading-relaxed text-slate-200">{p.text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm leading-relaxed text-slate-300">
                  For verified health workers and coordinators of the City
                  Health Office.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Privacy promise ───────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
                <Lock className="h-3.5 w-3.5 text-accent-600" />
                Our privacy promise
              </p>
              <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Your personal information stays private
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                The map only ever shows community totals — never a person, never
                a home address. The system follows the{" "}
                <strong className="text-slate-900">
                  Data Privacy Act of 2012 (Republic Act No. 10173)
                </strong>
                .
              </p>
            </div>

            <ul className="space-y-3">
              {[
                "Names, house numbers, and street addresses are removed before anything is ever saved.",
                "Only what public health work truly needs is kept — the community, age group, and type of TB.",
                "No one can be identified from the data, and health workers only see what their job requires.",
              ].map((text) => (
                <li
                  key={text}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 shadow-soft"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
                  <span className="text-sm leading-relaxed text-slate-700">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-950">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <img
            src={ctaImage}
            alt=""
            className="h-full w-full object-cover object-top opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-950/80 via-brand-950/60 to-brand-950" />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 bottom-[-30%] h-[30rem] w-[30rem] rounded-full bg-accent-500/12 blur-[110px]"
        />

        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-200 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
            Get started
          </p>
          <h2 className="font-display mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Ready to use BANTAY-TB?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
            Residents can access the DOTS locator and health guides right
            now. Health workers can request an account from their supervisor.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/">
              <Button variant="accent" size="lg" className="gap-2 text-base">
                Go to the DOTS map
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/register">
              <Button
                size="lg"
                variant="secondary"
                className="border-white/15 bg-white/5 text-white backdrop-blur-sm hover:border-white/25 hover:bg-white/10"
              >
                Request an account
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
