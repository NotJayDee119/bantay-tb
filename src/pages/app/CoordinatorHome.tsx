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
  MapPin,
  MapPinned,
  Ticket,
  TrendingDown,
  TrendingUp,
  Upload,
  UserX,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { delay } from "../../lib/stagger";
import {
  yearPhrase,
  type CaseYear,
} from "../../hooks/useCaseYear";
import {
  AttentionCard,
  GlanceStat,
  MainTask,
  SectionTitle,
  SmallTask,
  type Task,
} from "../../components/home/HomeParts";

/**
 * Home screen for the City TB coordinator.
 *
 * Same plain-language pattern as the health worker home, pitched one level
 * up: the coordinator supervises the whole city, so the attention cards are
 * about where the programme is slipping (hotspots, patients dropping out of
 * treatment) and the tools are the oversight ones — map, hotspots, reports,
 * staff invites.
 */

/** Treatment outcomes of the year-filtered cases, tallied by the Dashboard. */
export interface OutcomeStats {
  /** Treatment ended, any way (everything except "ongoing"). */
  finished: number;
  /** Cured + completed. */
  favourable: number;
  lostToFollowUp: number;
  ongoing: number;
}

export function CoordinatorHome({
  year,
  outcomes,
  yoyBaseYear,
  userId,
  firstName,
  totalCases,
  yoyChangePct,
  barangaysWithCases,
  totalBarangays,
  recentCases,
  recentWindowDays,
  activeHotspots,
  lastUpload,
  onOpenHotspots,
  areaTable,
}: {
  year: CaseYear;
  outcomes: OutcomeStats;
  yoyBaseYear: number;
  userId: string;
  firstName: string | null;
  totalCases: number;
  yoyChangePct: number | null;
  barangaysWithCases: number;
  totalBarangays: number;
  recentCases: number;
  recentWindowDays: number;
  activeHotspots: number;
  lastUpload: Date | null;
  onOpenHotspots: () => void;
  areaTable: ReactNode;
}) {
  // Outcomes come from the Dashboard's shared copy of the register, so this
  // screen no longer downloads every case a second time. Only the unread
  // alert count is fetched here.
  const [unreadAlerts, setUnreadAlerts] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("hotspot_alerts")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null)
      .then(({ count }) => {
        if (!cancelled) setUnreadAlerts(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const counts = {
    unreadAlerts: unreadAlerts ?? 0,
    ongoing: outcomes.ongoing,
    lostToFollowUp: outcomes.lostToFollowUp,
    finished: outcomes.finished,
    successRate:
      outcomes.finished === 0
        ? null
        : Math.round((outcomes.favourable / outcomes.finished) * 100),
  };

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateText = now.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const attentionTotal =
    activeHotspots +
    (counts?.unreadAlerts ?? 0) +
    (counts?.lostToFollowUp ?? 0);

  return (
    <div className="space-y-8">
      {/* ── Greeting + city headline ─────────────────────────────────── */}
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
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
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
              {counts == null
                ? "Checking the city's TB situation…"
                : attentionTotal === 0
                  ? "The city looks stable today. Nothing needs urgent action."
                  : "Here is the city's TB situation and what needs action today."}
            </p>
          </div>

          {/* Headline figure, spelled out as a sentence. */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm lg:min-w-[280px]">
            <div className="flex items-center gap-2 text-sm text-brand-200">
              <MapPin className="h-4 w-4 text-accent-300" />
              Davao City
            </div>
            <div className="mt-1 font-display text-5xl font-black tabular-nums tracking-tight">
              {totalCases.toLocaleString()}
            </div>
            <div className="text-sm text-slate-300">TB cases {yearPhrase(year)}</div>
            {yoyChangePct != null && (
              <div
                className={
                  "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold " +
                  (yoyChangePct > 0
                    ? "bg-red-500/15 text-red-200"
                    : "bg-accent-500/15 text-accent-200")
                }
              >
                {yoyChangePct > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {Math.abs(Math.round(yoyChangePct))}%{" "}
                {yoyChangePct > 0 ? "more" : "fewer"} than in {yoyBaseYear}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Needs attention ──────────────────────────────────────────── */}
      <section aria-labelledby="co-attention">
        <SectionTitle
          id="co-attention"
          title="Needs your attention"
          hint="Tap a card to see the details."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AttentionCard
            index={1}
            icon={Flame}
            tone="danger"
            count={activeHotspots}
            one="hotspot area"
            many="hotspot areas"
            sub="Places where cases are close together"
            clear="No hotspot areas"
            action="See the areas"
            onClick={onOpenHotspots}
          />
          <AttentionCard
            index={2}
            icon={Bell}
            tone="warning"
            loading={counts == null}
            count={counts?.unreadAlerts ?? 0}
            one="new alert"
            many="new alerts"
            sub="Not yet read"
            clear="No new alerts"
            action="Read alerts"
            to="/app/alerts"
          />
          <AttentionCard
            index={3}
            icon={UserX}
            tone="danger"
            loading={counts == null}
            count={counts?.lostToFollowUp ?? 0}
            one="patient stopped coming"
            many="patients stopped coming"
            sub={
              year === "all"
                ? "Lost to follow-up during treatment"
                : `Lost to follow-up · ${year} cases`
            }
            clear="No patients lost"
            action="Find these patients"
            to="/app/cases?q=lost_to_followup&closed=1"
          />
          <AttentionCard
            index={4}
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

      {/* ── City at a glance ─────────────────────────────────────────── */}
      <section aria-labelledby="co-glance">
        <SectionTitle id="co-glance" title="City at a glance" />
        <div
          className="rise-in grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          style={delay(5)}
        >
          <GlanceStat
            label="Treatment success"
            value={
              counts == null
                ? "…"
                : counts.successRate == null
                  ? "—"
                  : `${counts.successRate}%`
            }
            sub={
              counts == null || counts.finished === 0
                ? "Cured or completed, of finished treatments"
                : `Cured or completed, of ${counts.finished.toLocaleString()} finished`
            }
          />
          <GlanceStat
            label="Still on treatment"
            value={counts == null ? "…" : counts.ongoing.toLocaleString()}
            sub={
              year === "all"
                ? "Patients currently taking TB medicine"
                : `${year} cases still taking TB medicine`
            }
          />
          <GlanceStat
            label="Barangays with cases"
            value={`${barangaysWithCases} of ${totalBarangays}`}
            sub="How far TB has spread in the city"
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
            sub="Check uploads are up to date"
          />
        </div>
      </section>

      {/* ── Tasks ────────────────────────────────────────────────────── */}
      <section aria-labelledby="co-tasks">
        <SectionTitle
          id="co-tasks"
          title="What would you like to do?"
          hint="Pick a task to get started."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {MAIN_TASKS.map((t, i) => (
            <MainTask key={t.to} task={t} index={6 + i} />
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {MORE_TASKS.map((t, i) => (
            <SmallTask key={t.to} task={t} index={9 + i} />
          ))}
        </div>
      </section>

      {/* ── Barangay ranking ─────────────────────────────────────────── */}
      <section aria-labelledby="co-areas">
        <SectionTitle
          id="co-areas"
          title="Which barangays have the most cases?"
          hint="Most affected first."
        />
        <div className="rise-in" style={delay(14)}>
          {areaTable}
        </div>
      </section>

      <Link
        to="/app/analytics"
        className="rise-in group flex items-center gap-4 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-4 transition-colors duration-200 hover:border-brand-300 hover:bg-brand-50"
        style={delay(15)}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-brand-700 shadow-soft">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">Preparing a report?</div>
          <div className="text-sm text-slate-600">
            Reports &amp; Charts has trends, age and sex breakdowns, and
            outreach suggestions you can export.
          </div>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-brand-400 transition-transform duration-200 group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

const MAIN_TASKS: Task[] = [
  {
    to: "/app/hotspots",
    label: "Review hotspot areas",
    blurb: "See where cases are clustering and plan screening drives.",
    icon: Flame,
    chip: "bg-red-600 text-white",
  },
  {
    to: "/app/map",
    label: "Open the case map",
    blurb: "See every case and DOTS center on the city map.",
    icon: MapPinned,
    chip: "bg-brand-600 text-white",
  },
  {
    to: "/app/analytics",
    label: "Reports & charts",
    blurb: "Trends, breakdowns and outreach suggestions for planning.",
    icon: BarChart3,
    chip: "bg-accent-600 text-white",
  },
];

const MORE_TASKS: Task[] = [
  {
    to: "/app/cases",
    label: "Patients & cases",
    blurb: "Search and update records",
    icon: ClipboardList,
    chip: "bg-sky-50 text-sky-700",
  },
  {
    to: "/app/import",
    label: "Upload records",
    blurb: "Add many cases from Excel",
    icon: Upload,
    chip: "bg-amber-50 text-amber-700",
  },
  {
    to: "/app/invites",
    label: "Invite staff",
    blurb: "Create sign-up codes",
    icon: Ticket,
    chip: "bg-violet-50 text-violet-700",
  },
  {
    to: "/app/chatbot",
    label: "Ask the assistant",
    blurb: "Get answers in your language",
    icon: Bot,
    chip: "bg-rose-50 text-rose-700",
  },
];
