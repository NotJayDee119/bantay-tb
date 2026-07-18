import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Frown,
  ListChecks,
  Lock,
  MessageSquareText,
  Pill,
  Smile,
  Sparkles,
  Star,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  ListSkeleton,
  PageHeader,
  Select,
} from "../../components/ui";
import { PatientSheet } from "../../components/PatientSheet";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { formatDate, formatDateTime } from "../../lib/utils";

interface SmsRow {
  id: string;
  to_phone: string;
  body: string;
  status: string;
  provider: string;
  created_at: string;
  sent_at: string | null;
  patient: { full_name: string | null } | null;
}

interface Schedule {
  id: string;
  patient_id: string;
  medication: string;
  dose: string;
  times_per_day: number;
  start_date: string;
  end_date: string;
  patient: { full_name: string | null; email: string };
}

interface Log {
  id: string;
  schedule_id: string;
  patient_id: string;
  scheduled_at: string;
  taken_at: string | null;
  status: "scheduled" | "taken" | "missed" | "late";
  patient: { full_name: string | null };
}

interface NonAdherenceFlag {
  patient_id: string;
  patient_name: string;
  missed: number;
  late: number;
  total: number;
}

const STATUS_TONE = {
  scheduled: "info",
  taken: "success",
  late: "warning",
  missed: "danger",
} as const;

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

// Kid-friendly status treatment for the patient ("nursery") view.
const KID_STATUS: Record<
  Log["status"],
  { label: string; icon: LucideIcon; chip: string; bubble: string }
> = {
  taken: {
    label: "Yay! Taken",
    icon: Smile,
    chip: "border-emerald-200 bg-emerald-100 text-emerald-700",
    bubble: "border-emerald-200 bg-emerald-50 text-emerald-600",
  },
  scheduled: {
    label: "Coming up",
    icon: Clock,
    chip: "border-sky-200 bg-sky-100 text-sky-700",
    bubble: "border-sky-200 bg-sky-50 text-sky-600",
  },
  late: {
    label: "A bit late",
    icon: Clock,
    chip: "border-amber-200 bg-amber-100 text-amber-800",
    bubble: "border-amber-200 bg-amber-50 text-amber-600",
  },
  missed: {
    label: "Oops, missed",
    icon: Frown,
    chip: "border-rose-200 bg-rose-100 text-rose-700",
    bubble: "border-rose-200 bg-rose-50 text-rose-600",
  },
};

export function Adherence() {
  const { profile } = useAuth();
  const isPatient = profile?.role === "patient";
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [smsRows, setSmsRows] = useState<SmsRow[]>([]);
  const [flags, setFlags] = useState<NonAdherenceFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    let scheduleQ = supabase
      .from("adherence_schedules")
      .select(
        "id, patient_id, medication, dose, times_per_day, start_date, end_date, patient:profiles!adherence_schedules_patient_id_fkey(full_name, email)"
      )
      .order("start_date", { ascending: false });
    if (isPatient) scheduleQ = scheduleQ.eq("patient_id", profile!.id);

    let logQ = supabase
      .from("adherence_logs")
      .select(
        "id, schedule_id, patient_id, scheduled_at, taken_at, status, patient:profiles!adherence_logs_patient_id_fkey(full_name)"
      )
      .order("scheduled_at", { ascending: false })
      .limit(80);
    if (isPatient) logQ = logQ.eq("patient_id", profile!.id);

    const smsQ = supabase
      .from("sms_outbox")
      .select(
        "id, to_phone, body, status, provider, created_at, sent_at, patient:profiles!sms_outbox_patient_id_fkey(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    // Non-adherence flags: missed/late logs in the last 14 days, per patient.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const flagQ = !isPatient
      ? supabase
          .from("adherence_logs")
          .select(
            "patient_id, status, patient:profiles!adherence_logs_patient_id_fkey(full_name)"
          )
          .in("status", ["missed", "late"])
          .gte("scheduled_at", cutoff.toISOString())
      : null;

    const [s, l, sm, f] = await Promise.all([scheduleQ, logQ, smsQ, flagQ ?? Promise.resolve({ data: [] })]);
    setSchedules((s.data ?? []) as unknown as Schedule[]);
    setLogs((l.data ?? []) as unknown as Log[]);
    setSmsRows((sm.data ?? []) as unknown as SmsRow[]);

    // Aggregate flag rows by patient.
    type FlagRow = { patient_id: string; status: string; patient: { full_name: string | null } | null };
    const flagRows = ((f as { data: unknown[] }).data ?? []) as FlagRow[];
    const byPatient = new Map<string, NonAdherenceFlag>();
    for (const row of flagRows) {
      const existing = byPatient.get(row.patient_id) ?? {
        patient_id: row.patient_id,
        patient_name: row.patient?.full_name ?? row.patient_id,
        missed: 0,
        late: 0,
        total: 0,
      };
      if (row.status === "missed") existing.missed += 1;
      if (row.status === "late") existing.late += 1;
      existing.total += 1;
      byPatient.set(row.patient_id, existing);
    }
    setFlags([...byPatient.values()].sort((a, b) => b.total - a.total));
    setLoading(false);
  }

  async function sendReminders() {
    setSending(true);
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

    const { data: dueLogs } = await supabase
      .from("adherence_logs")
      .select("id, patient_id, schedule_id, scheduled_at")
      .eq("status", "scheduled")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", inOneHour.toISOString())
      .limit(100);

    if (!dueLogs || dueLogs.length === 0) {
      toast.info("No dose reminders due within the next hour.");
      setSending(false);
      return;
    }

    const patientIds = [...new Set(dueLogs.map((d) => d.patient_id))];
    const scheduleIds = [...new Set(dueLogs.map((d) => d.schedule_id))];

    const [{ data: patients }, { data: scheds }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, phone, full_name")
        .in("id", patientIds),
      supabase
        .from("adherence_schedules")
        .select("id, medication, dose")
        .in("id", scheduleIds),
    ]);

    const patientMap = new Map(
      (patients ?? []).map((p) => [p.id, p])
    );
    const schedMap = new Map(
      (scheds ?? []).map((s) => [s.id, s])
    );

    let sent = 0;
    for (const row of dueLogs) {
      const patient = patientMap.get(row.patient_id);
      const sched = schedMap.get(row.schedule_id);
      if (!patient?.phone || !sched) continue;

      const body = `BANTAY-TB: ${
        patient.full_name ? `Hi ${patient.full_name}, ` : ""
      }reminder to take ${sched.dose} of ${sched.medication} now. Reply CONFIRM in the app once taken.`;

      await supabase.from("sms_outbox").insert({
        to_phone: patient.phone,
        body,
        status: "mocked" as const,
        provider: "mock",
        patient_id: row.patient_id,
        schedule_id: row.schedule_id,
        sent_at: new Date().toISOString(),
      });
      sent++;
    }

    toast.success(
      sent > 0
        ? `${sent} SMS reminder(s) queued (mock mode — no real SMS sent without a provider key).`
        : "No patients with phone numbers have doses due. SMS skipped."
    );
    setSending(false);
    load();
  }

  useEffect(() => {
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Optimistic: the dose flips to "taken" immediately so the tap feels
  // instant (especially on the kid-friendly patient view), and rolls back
  // with an error toast if the write fails.
  async function markTaken(logId: string) {
    const previous = logs;
    const now = new Date().toISOString();
    setLogs((ls) =>
      ls.map((l) =>
        l.id === logId ? { ...l, status: "taken" as const, taken_at: now } : l
      )
    );
    const { error } = await supabase
      .from("adherence_logs")
      .update({ status: "taken", taken_at: now })
      .eq("id", logId);
    if (error) {
      setLogs(previous);
      toast.error(`Could not save: ${error.message}`);
    } else {
      toast.success("Marked as taken");
    }
  }

  // ── Patient ("nursery") experience ─────────────────────────────────
  if (isPatient) {
    return (
      <PatientAdherence
        name={profile?.full_name ?? null}
        schedules={schedules}
        logs={logs}
        loading={loading}
        onMarkTaken={markTaken}
      />
    );
  }

  // ── Staff console experience ───────────────────────────────────────
  return (
    <>
      <PageHeader
        title="Medication Adherence"
        subtitle="Schedules, dose logs, and SMS notifications for TB patients."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Close" : "Add schedule"}
            </Button>
            <Button onClick={sendReminders} loading={sending}>
              {sending ? "Sending…" : "Send SMS reminders"}
            </Button>
          </div>
        }
      />

      {showForm && (
        <NewScheduleForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <AdherenceStatRow
        loading={loading}
        activeSchedules={schedules.length}
        takenCount={logs.filter((l) => l.status === "taken").length}
        loggedCount={logs.length}
        flaggedPatients={flags.length}
        smsCount={smsRows.length}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
              <CalendarClock className="h-3.5 w-3.5 text-brand-600" />
              Active schedules
            </div>
            {!loading && schedules.length > 0 && (
              <span className="font-mono text-[10px] tabular-nums text-slate-500">
                {schedules.length}
              </span>
            )}
          </div>
          {loading ? (
            <ListSkeleton rows={3} />
          ) : schedules.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No schedules yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {schedules.map((s) => (
                <li
                  key={s.id}
                  className="px-4 py-3 transition-colors hover:bg-slate-50/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">
                        {s.medication}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {s.patient?.full_name ?? s.patient?.email ?? "—"} ·{" "}
                        {s.dose} × {s.times_per_day}/day
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      {formatDate(s.start_date)} → {formatDate(s.end_date)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
              <ListChecks className="h-3.5 w-3.5 text-accent-600" />
              Recent dose logs · all patients
            </div>
            {!loading && logs.length > 0 && (
              <span className="font-mono text-[10px] tabular-nums text-slate-500">
                {logs.length}
              </span>
            )}
          </div>
          {loading ? (
            <ListSkeleton rows={3} />
          ) : logs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No dose logs yet.
            </p>
          ) : (
            <ul className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {l.patient?.full_name ?? "—"} ·{" "}
                      {formatDateTime(l.scheduled_at)}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {l.taken_at
                        ? `Taken ${formatDateTime(l.taken_at)}`
                        : "Awaiting confirmation"}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <AlertTriangle className="h-3.5 w-3.5 text-vigil-500" />
            Non-adherence flags
          </div>
          <span className="inline-flex items-center rounded-full border border-vigil-400/50 bg-vigil-300/20 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-vigil-600">
            Last 14 days
          </span>
        </div>
        {loading ? (
          <ListSkeleton rows={2} />
        ) : flags.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            No missed or late doses in the last 14 days.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {flags.map((f) => (
              <li
                key={f.patient_id}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">{f.patient_name}</div>
                  <div className="mt-0.5 flex gap-3 font-mono text-[10px] uppercase tracking-wider">
                    {f.missed > 0 && (
                      <span className="font-semibold text-red-600">{f.missed} missed</span>
                    )}
                    {f.late > 0 && (
                      <span className="font-semibold text-amber-600">{f.late} late</span>
                    )}
                  </div>
                </div>
                <Badge tone={f.missed > 0 ? "danger" : "warning"}>
                  {f.total} issue{f.total === 1 ? "" : "s"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <MessageSquareText className="h-3.5 w-3.5 text-brand-600" />
            SMS outbox
          </div>
          {!loading && smsRows.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {smsRows.length}
            </span>
          )}
        </div>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : smsRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No SMS messages yet. Create a schedule and click &ldquo;Send SMS
            reminders&rdquo; to queue messages.
          </p>
        ) : (
          <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
            {smsRows.map((s) => (
              <li
                key={s.id}
                className="px-4 py-3 transition-colors hover:bg-slate-50/70"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {s.patient?.full_name ?? "—"} · {s.to_phone}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                      {s.body}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      tone={
                        s.status === "sent" || s.status === "delivered"
                          ? "success"
                          : s.status === "failed"
                            ? "danger"
                            : s.status === "mocked"
                              ? "warning"
                              : "info"
                      }
                    >
                      {s.status}
                    </Badge>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                      {formatDateTime(s.created_at)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function AdherenceStatRow({
  loading,
  activeSchedules,
  takenCount,
  loggedCount,
  flaggedPatients,
  smsCount,
}: {
  loading: boolean;
  activeSchedules: number;
  takenCount: number;
  loggedCount: number;
  flaggedPatients: number;
  smsCount: number;
}) {
  if (loading) {
    return (
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[104px] animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100"
          />
        ))}
      </div>
    );
  }

  const adherencePct =
    loggedCount > 0 ? Math.round((takenCount / loggedCount) * 100) : null;

  return (
    <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatTile
        icon={<CalendarClock className="h-4.5 w-4.5" />}
        iconClass="bg-brand-50 text-brand-700"
        accentClass="bg-brand-500"
        label="Active schedules"
        value={activeSchedules.toLocaleString()}
      />
      <StatTile
        icon={<ListChecks className="h-4.5 w-4.5" />}
        iconClass="bg-accent-50 text-accent-600"
        accentClass="bg-accent-500"
        label="Dose adherence"
        value={adherencePct === null ? "—" : `${adherencePct}%`}
        footer={
          <span className="text-slate-500">
            {takenCount} of {loggedCount} recent logs
          </span>
        }
      />
      <StatTile
        icon={<AlertTriangle className="h-4.5 w-4.5" />}
        iconClass="bg-vigil-300/20 text-vigil-600"
        accentClass="bg-vigil-500"
        label="Flagged patients"
        value={flaggedPatients.toLocaleString()}
        footer={<span className="text-slate-500">Last 14 days</span>}
      />
      <StatTile
        icon={<MessageSquareText className="h-4.5 w-4.5" />}
        iconClass="bg-sky-50 text-sky-600"
        accentClass="bg-sky-500"
        label="SMS outbox"
        value={smsCount.toLocaleString()}
        footer={<span className="text-slate-500">Recent messages</span>}
      />
    </div>
  );
}

function StatTile({
  icon,
  iconClass,
  accentClass,
  label,
  value,
  footer,
}: {
  icon: React.ReactNode;
  iconClass: string;
  accentClass: string;
  label: string;
  value: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft transition-shadow hover:shadow-lift">
      <span aria-hidden className={"absolute inset-y-0 left-0 w-1 " + accentClass} />
      <span className={"inline-flex rounded-xl p-2 " + iconClass}>{icon}</span>
      <div className="mt-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="font-display mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">
        {value}
      </div>
      {footer && <div className="mt-1 text-xs">{footer}</div>}
    </div>
  );
}

// Dose confirmability, derived against a live clock: patients may only confirm
// a dose once it is actually due, and only on its own day.
function doseState(l: Log, now: Date) {
  const sched = new Date(l.scheduled_at);
  const isToday = sched.toDateString() === now.toDateString();
  const isDue = sched.getTime() <= now.getTime();
  const canTake = l.status !== "taken" && isToday && isDue;
  const isLocked = l.status !== "taken" && !isDue;
  return { isToday, isDue, canTake, isLocked };
}

/**
 * Patient view — a friendly, mobile-first "medicine buddy" experience: pastel
 * cards, stars for progress, and tap-to-open detail sheets. Tapping a dose or a
 * medicine opens a bottom-sheet modal (on phones) / centered dialog (on desktop)
 * with the full details and the big cheerful "I took it!" action.
 */
function PatientAdherence({
  name,
  schedules,
  logs,
  loading,
  onMarkTaken,
}: {
  name: string | null;
  schedules: Schedule[];
  logs: Log[];
  loading: boolean;
  onMarkTaken: (logId: string) => void;
}) {
  const firstName = (name ?? "").trim().split(/\s+/)[0] || "friend";
  const taken = logs.filter((l) => l.status === "taken").length;
  const done = logs.filter((l) => l.status !== "scheduled").length;
  const stars = done === 0 ? 0 : Math.round((taken / done) * 5);

  // Real-time clock so "I took it!" unlocks the moment a dose becomes due.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const scheduleById = useMemo(
    () => new Map(schedules.map((s) => [s.id, s])),
    [schedules]
  );

  // Which detail sheet is open (by id) — dose or medicine.
  const [openDoseId, setOpenDoseId] = useState<string | null>(null);
  const [openMedId, setOpenMedId] = useState<string | null>(null);
  const openDose = logs.find((l) => l.id === openDoseId) ?? null;
  const openMed = schedules.find((s) => s.id === openMedId) ?? null;

  // The next dose the patient can confirm right now — surfaced as a big
  // one-tap card at the top so the main action is never buried in a list.
  const nextDue = useMemo(
    () =>
      [...logs]
        .filter((l) => doseState(l, now).canTake)
        .sort(
          (a, b) =>
            new Date(a.scheduled_at).getTime() -
            new Date(b.scheduled_at).getTime()
        )[0] ?? null,
    [logs, now]
  );

  function confirmDose(id: string) {
    onMarkTaken(id);
    setOpenDoseId(null);
  }

  return (
    <div className="space-y-5">
      {/* ── Hero — big, warm welcome ─────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-100 via-sky-50 to-amber-100 p-5 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-200/50 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-sky-200/50 blur-2xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-emerald-700 shadow-soft">
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              Your medicine buddy
            </span>
            <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Hi, {firstName}!
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-700 sm:text-base">
              Taking your medicine every day makes you stronger and stronger.
              You can do it!
            </p>
          </div>
          <div className="flex items-center gap-4 self-start rounded-2xl border-2 border-white/70 bg-white/70 p-4 shadow-soft backdrop-blur-sm">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500 text-white">
              <Sparkles className="h-6 w-6" />
            </span>
            <div>
              <div className="font-display text-3xl font-extrabold leading-none tracking-tight text-slate-900">
                {taken}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-600">
                {taken === 1 ? "dose taken" : "doses taken"} — great job!
              </div>
              <div
                className="mt-1.5 flex gap-0.5"
                role="img"
                aria-label={`${stars} of 5 stars`}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star
                    key={i}
                    aria-hidden
                    className={
                      "h-4 w-4 " +
                      (i < stars
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300")
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Time-for-your-medicine card — the one big action on mobile ── */}
      {nextDue && (
        <button
          type="button"
          onClick={() => setOpenDoseId(nextDue.id)}
          className="flex w-full items-center gap-4 rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-left text-white shadow-lift transition-transform duration-200 active:scale-[0.99]"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20">
            <Pill className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wide text-emerald-100">
              It&apos;s medicine time!
            </div>
            <div className="mt-0.5 font-display text-lg font-extrabold leading-tight">
              {scheduleById.get(nextDue.schedule_id)?.medication ??
                "Your dose is ready"}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-emerald-50">
              Tap to confirm you took it
            </div>
          </div>
          <ChevronRight className="h-6 w-6 shrink-0 text-white/80" />
        </button>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── My medicines ───────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-3xl border-2 border-sky-200 bg-white shadow-soft">
          <div className="flex items-center gap-2.5 border-b-2 border-sky-100 bg-sky-50/70 px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-sky-500 text-white">
              <Pill className="h-5 w-5" />
            </span>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-slate-900">
              My medicines
            </h2>
          </div>
          {loading ? (
            <ListSkeleton rows={3} />
          ) : schedules.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No medicines listed yet. Your health worker will add them soon!
            </p>
          ) : (
            <ul className="divide-y-2 divide-sky-50">
              {schedules.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setOpenMedId(s.id)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-sky-50/60 active:bg-sky-50"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-600">
                      <Pill className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-slate-900">
                        {s.medication}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-slate-500">
                        {s.dose} · {s.times_per_day}{" "}
                        {s.times_per_day === 1 ? "time" : "times"} a day
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── My doses ───────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-3xl border-2 border-pink-200 bg-white shadow-soft">
          <div className="flex items-center gap-2.5 border-b-2 border-pink-100 bg-pink-50/70 px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-pink-500 text-white">
              <Star className="h-5 w-5" />
            </span>
            <h2 className="font-display text-lg font-extrabold tracking-tight text-slate-900">
              My doses
            </h2>
          </div>
          {loading ? (
            <ListSkeleton rows={3} />
          ) : logs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No doses to show yet. Check back soon!
            </p>
          ) : (
            <ul className="max-h-[480px] divide-y-2 divide-pink-50 overflow-y-auto overscroll-contain">
              {logs.map((l) => {
                const k = KID_STATUS[l.status];
                const StatusIcon = k.icon;
                const { canTake } = doseState(l, now);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setOpenDoseId(l.id)}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-pink-50/60 active:bg-pink-50"
                    >
                      <span
                        className={
                          "grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 " +
                          k.bubble
                        }
                      >
                        <StatusIcon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900">
                          {formatDateTime(l.scheduled_at)}
                        </div>
                        <span
                          className={
                            "mt-1 inline-flex items-center rounded-full border-2 px-2 py-0.5 text-[11px] font-bold " +
                            k.chip
                          }
                        >
                          {k.label}
                        </span>
                      </div>
                      {canTake ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft">
                          <Check className="h-3.5 w-3.5" />
                          Take
                        </span>
                      ) : (
                        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ── Dose detail sheet ────────────────────────────────────────── */}
      <PatientSheet
        open={openDose !== null}
        onClose={() => setOpenDoseId(null)}
        accentClass="border-pink-200"
        icon={
          openDose ? (
            (() => {
              const StatusIcon = KID_STATUS[openDose.status].icon;
              return <StatusIcon className="h-6 w-6" />;
            })()
          ) : null
        }
        iconClass={openDose ? KID_STATUS[openDose.status].bubble : undefined}
        title={openDose ? KID_STATUS[openDose.status].label : ""}
        subtitle={
          openDose
            ? scheduleById.get(openDose.schedule_id)?.medication ?? "Your dose"
            : undefined
        }
        footer={
          openDose &&
          (() => {
            const { canTake, isLocked, isToday } = doseState(openDose, now);
            if (canTake) {
              return (
                <button
                  type="button"
                  onClick={() => confirmDose(openDose.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-base font-extrabold text-white shadow-soft transition hover:bg-emerald-600 active:scale-[0.98]"
                >
                  <Check className="h-5 w-5" />
                  I took it!
                </button>
              );
            }
            if (isLocked) {
              return (
                <div className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-100 px-4 py-3.5 text-sm font-bold text-slate-400">
                  <Lock className="h-4 w-4" />
                  {isToday ? "You can take this later today" : "Not for today"}
                </div>
              );
            }
            return (
              <div className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-bold text-emerald-700">
                <Smile className="h-4 w-4" />
                All done — great job!
              </div>
            );
          })()
        }
      >
        {openDose && (
          <div className="space-y-3">
            <DetailRow
              icon={<CalendarClock className="h-4 w-4" />}
              label="Scheduled for"
              value={formatDateTime(openDose.scheduled_at)}
            />
            {openDose.taken_at && (
              <DetailRow
                icon={<Check className="h-4 w-4" />}
                label="Taken at"
                value={formatDateTime(openDose.taken_at)}
              />
            )}
            {(() => {
              const s = scheduleById.get(openDose.schedule_id);
              if (!s) return null;
              return (
                <DetailRow
                  icon={<Pill className="h-4 w-4" />}
                  label="Medicine"
                  value={`${s.medication} · ${s.dose}`}
                />
              );
            })()}
            <p className="rounded-2xl bg-pink-50 px-4 py-3 text-sm font-medium leading-relaxed text-slate-600">
              {doseState(openDose, now).canTake
                ? "It's time! Tap the button below once you've taken this dose."
                : openDose.status === "taken"
                  ? "You already took this one. Keep up the great work!"
                  : doseState(openDose, now).isToday
                    ? "This dose isn't ready yet — come back when it's time."
                    : "This dose is for another day. Check your medicines list to plan ahead."}
            </p>
          </div>
        )}
      </PatientSheet>

      {/* ── Medicine detail sheet ────────────────────────────────────── */}
      <PatientSheet
        open={openMed !== null}
        onClose={() => setOpenMedId(null)}
        accentClass="border-sky-200"
        icon={<Pill className="h-6 w-6" />}
        iconClass="bg-sky-100 text-sky-700"
        title={openMed?.medication ?? ""}
        subtitle={
          openMed
            ? `${openMed.dose} · ${openMed.times_per_day} ${
                openMed.times_per_day === 1 ? "time" : "times"
              } a day`
            : undefined
        }
      >
        {openMed && (
          <div className="space-y-3">
            <DetailRow
              icon={<Pill className="h-4 w-4" />}
              label="Dose"
              value={openMed.dose}
            />
            <DetailRow
              icon={<Clock className="h-4 w-4" />}
              label="How often"
              value={`${openMed.times_per_day} ${
                openMed.times_per_day === 1 ? "time" : "times"
              } a day`}
            />
            <DetailRow
              icon={<CalendarClock className="h-4 w-4" />}
              label="Start date"
              value={formatDate(openMed.start_date)}
            />
            <DetailRow
              icon={<CalendarClock className="h-4 w-4" />}
              label="Until"
              value={formatDate(openMed.end_date)}
            />
            <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-medium leading-relaxed text-slate-600">
              Take this medicine exactly as your health worker told you. Finishing
              every dose is the best way to get fully better!
            </p>
          </div>
        )}
      </PatientSheet>
    </div>
  );
}

// A simple label/value row used inside the patient detail sheets.
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-white px-4 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="truncate text-sm font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function NewScheduleForm({
  onCreated,
  onClose,
}: {
  onCreated: () => void;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<{ id: string; email: string; full_name: string | null }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    patient_id: "",
    medication: "Isoniazid + Rifampicin (HR)",
    dose: "1 tablet",
    times_per_day: "1",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  });

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "patient")
      .order("full_name")
      .then(({ data }) => setPatients(data ?? []));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { data: scheduleData, error } = await supabase
      .from("adherence_schedules")
      .insert({
        patient_id: form.patient_id,
        medication: form.medication,
        dose: form.dose,
        times_per_day: Number(form.times_per_day),
        start_date: form.start_date,
        end_date: form.end_date,
        created_by: profile?.id ?? null,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    // Generate scheduled dose logs for the full schedule duration (capped at 365
    // days to avoid unbounded inserts). Insert in 500-row chunks to stay within
    // PostgREST body limits.
    const logs: { schedule_id: string; patient_id: string; scheduled_at: string; status: "scheduled" }[] = [];
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    const totalDays = Math.min(
      Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1,
      365
    );
    for (let d = 0; d < totalDays; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + d);
      for (let i = 0; i < Number(form.times_per_day); i++) {
        const at = new Date(day);
        at.setHours(8 + i * 6, 0, 0, 0);
        logs.push({
          schedule_id: scheduleData!.id,
          patient_id: form.patient_id,
          scheduled_at: at.toISOString(),
          status: "scheduled",
        });
      }
    }
    const chunkSize = 500;
    for (let i = 0; i < logs.length; i += chunkSize) {
      await supabase.from("adherence_logs").insert(logs.slice(i, i + chunkSize));
    }

    toast.success(`Schedule created with ${totalDays} days of dose reminders.`);
    setSubmitting(false);
    onCreated();
  }

  return (
    <Card className="mb-6 overflow-hidden p-0">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
        <CalendarClock className="h-3.5 w-3.5 text-brand-600" />
        <span className={MICRO_LABEL}>New adherence schedule</span>
      </div>
      <form onSubmit={onSubmit} className="grid gap-3 p-5 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="patient">Patient</Label>
          <Select
            id="patient"
            required
            value={form.patient_id}
            onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
          >
            <option value="">— select patient —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="med">Medication</Label>
          <Input
            id="med"
            required
            value={form.medication}
            onChange={(e) => setForm({ ...form, medication: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dose">Dose</Label>
          <Input
            id="dose"
            required
            value={form.dose}
            onChange={(e) => setForm({ ...form, dose: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="times">Times per day</Label>
          <Input
            id="times"
            type="number"
            min={1}
            max={4}
            value={form.times_per_day}
            onChange={(e) =>
              setForm({ ...form, times_per_day: e.target.value })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="start">Start</Label>
          <Input
            id="start"
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end">End</Label>
          <Input
            id="end"
            type="date"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />
        </div>
        <div className="sm:col-span-3 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving…" : "Create schedule"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
