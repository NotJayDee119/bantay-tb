import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  ClipboardList,
  Flame,
  HelpCircle,
  MapPin,
  MapPinned,
  Upload,
  UserPlus,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { AreaScope } from "../../lib/areaScope";
import { delay } from "../../lib/stagger";
import { yearPhrase, type CaseYear } from "../../hooks/useCaseYear";
import {
  AttentionCard,
  GlanceStat,
  MainTask,
  SectionTitle,
  SmallTask,
  type Task,
} from "../../components/home/HomeParts";

/**
 * Home screen for health workers (BHWs, nurses, doctors).
 *
 * Written for people who are not comfortable with dashboards: every number
 * is a sentence ("3 new alerts"), every card says what to
 * do next, and the tools are named after the job ("Add a new patient"), not
 * the feature ("Cases (ACF)"). Zero is shown as "All clear" in green rather
 * than as a bare 0, so a quiet day reads as good news, not as missing data.
 */

export function HealthWorkerHome({
  year,
  userId,
  firstName,
  scope,
  totalCases,
  onTreatment,
  recentCases,
  recentWindowDays,
  activeHotspots,
  lastUpload,
  onOpenHotspots,
  areaTable,
}: {
  year: CaseYear;
  userId: string;
  firstName: string | null;
  scope: AreaScope;
  totalCases: number;
  /** Cases whose treatment outcome is still "ongoing". */
  onTreatment: number;
  recentCases: number;
  recentWindowDays: number;
  activeHotspots: number;
  lastUpload: Date | null;
  onOpenHotspots: () => void;
  areaTable: ReactNode;
}) {
  const [unreadAlerts, setUnreadAlerts] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("hotspot_alerts")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null);
      if (!cancelled) setUnreadAlerts(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateText = now.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const areaName = scope.scoped ? scope.name ?? "your area" : "Davao City";

  const attentionTotal = (unreadAlerts ?? 0) + activeHotspots;

  return (
    <div className="space-y-8">
      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <section
        className="rise-in relative overflow-hidden rounded-3xl border border-brand-900 bg-brand-950 p-6 text-white shadow-soft sm:p-8"
        style={delay(0)}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-50"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-500/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm text-brand-200">
              <CalendarDays className="h-4 w-4" />
              {dateText}
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {greeting}
              {firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="mt-2 max-w-xl text-base leading-relaxed text-slate-300">
              {unreadAlerts == null
                ? "Checking what needs your attention…"
                : attentionTotal === 0
                  ? "Everything looks good today. No patient or area needs urgent attention."
                  : "Here is what needs your attention today. Start with the cards below."}
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
            <MapPin className="h-4 w-4 text-accent-300" />
            {scope.scoped ? "Your area: " : ""}
            {areaName}
          </span>
        </div>
      </section>

      {/* ── Needs attention ──────────────────────────────────────────── */}
      <section aria-labelledby="hw-attention">
        <SectionTitle
          id="hw-attention"
          title="Needs your attention"
          hint="Tap a card to see the details."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <AttentionCard
            index={1}
            icon={Bell}
            tone="warning"
            loading={unreadAlerts == null}
            count={unreadAlerts ?? 0}
            one="new alert"
            many="new alerts"
            sub="Not yet read"
            clear="No new alerts"
            action="Read alerts"
            to="/app/alerts"
          />
          <AttentionCard
            index={2}
            icon={Flame}
            tone="danger"
            count={activeHotspots}
            one="area with many cases"
            many="areas with many cases"
            sub="Barangays flagged as TB hotspots"
            clear="No hotspot areas"
            action="See the areas"
            onClick={onOpenHotspots}
          />
          <AttentionCard
            index={3}
            icon={ClipboardList}
            tone="info"
            count={recentCases}
            one="new TB case"
            many="new TB cases"
            sub={`In the last ${recentWindowDays} days`}
            clear="No new cases"
            action="View cases"
            to="/app/cases"
          />
        </div>
      </section>

      {/* ── Tasks ────────────────────────────────────────────────────── */}
      <section aria-labelledby="hw-tasks">
        <SectionTitle
          id="hw-tasks"
          title="What would you like to do?"
          hint="Pick a task to get started."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {MAIN_TASKS.map((t, i) => (
            <MainTask key={t.to} task={t} index={4 + i} />
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MORE_TASKS.map((t, i) => (
            <SmallTask key={t.to} task={t} index={7 + i} />
          ))}
        </div>
      </section>

      {/* ── Area summary ─────────────────────────────────────────────── */}
      <section aria-labelledby="hw-area">
        <SectionTitle
          id="hw-area"
          title={scope.scoped ? "Your area at a glance" : "City at a glance"}
        />
        <div
          className="rise-in mb-4 grid gap-4 sm:grid-cols-3"
          style={delay(13)}
        >
          <GlanceStat
            label="Patients on treatment"
            value={onTreatment.toLocaleString()}
            sub={
              year === "all"
                ? "Patients currently taking TB medicine"
                : `${year} cases still taking TB medicine`
            }
          />
          <GlanceStat
            label={`TB cases ${yearPhrase(year)}`}
            value={totalCases.toLocaleString()}
            sub={`In ${areaName}`}
          />
          <GlanceStat
            label="Last record added"
            value={
              lastUpload
                ? lastUpload.toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "None yet"
            }
            sub="Newest case in the system"
          />
        </div>
        <div className="rise-in" style={delay(14)}>
          {areaTable}
        </div>
      </section>

      {/* ── Help ─────────────────────────────────────────────────────── */}
      <Link
        to="/app/chatbot"
        className="rise-in group flex items-center gap-4 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-4 transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50"
        style={delay(15)}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-soft">
          <HelpCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">Not sure what to do?</div>
          <div className="text-sm text-slate-600">
            Ask the assistant in English, Filipino or Cebuano. It can explain
            TB guidelines and how to use this system.
          </div>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-brand-400 transition-transform duration-200 group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

const MAIN_TASKS: Task[] = [
  {
    to: "/app/cases/new",
    label: "Add a new patient",
    blurb: "Record a new TB case or a person with symptoms.",
    icon: UserPlus,
    chip: "bg-brand-600 text-white",
  },
  {
    to: "/app/cases",
    label: "Update a patient",
    blurb: "Record a test result, start treatment, or close a case.",
    icon: ClipboardList,
    chip: "bg-vigil-500 text-white",
  },
];

const MORE_TASKS: Task[] = [
  {
    to: "/app/map",
    label: "Case map",
    blurb: "See where cases are",
    icon: MapPinned,
    chip: "bg-emerald-50 text-emerald-700",
  },
  {
    to: "/app/analytics",
    label: "Reports & charts",
    blurb: "Trends and summaries",
    icon: BarChart3,
    chip: "bg-violet-50 text-violet-700",
  },
  {
    to: "/app/import",
    label: "Upload records",
    blurb: "Add many cases from Excel",
    icon: Upload,
    chip: "bg-amber-50 text-amber-700",
  },
  {
    to: "/app/chatbot",
    label: "Ask the assistant",
    blurb: "Get answers in your language",
    icon: Bot,
    chip: "bg-rose-50 text-rose-700",
  },
];
