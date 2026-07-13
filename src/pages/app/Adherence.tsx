import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
  Spinner,
} from "../../components/ui";
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

  async function markTaken(logId: string) {
    const { error } = await supabase
      .from("adherence_logs")
      .update({ status: "taken", taken_at: new Date().toISOString() })
      .eq("id", logId);
    if (error) toast.error(error.message);
    else {
      toast.success("Marked as taken");
      load();
    }
  }

  return (
    <>
      <PageHeader
        title="Medication Adherence"
        subtitle={
          isPatient
            ? "Your TB medication schedule and dose log."
            : "Schedules, dose logs, and SMS notifications for TB patients."
        }
        actions={
          !isPatient && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? "Close" : "Add schedule"}
              </Button>
              <Button onClick={sendReminders} disabled={sending}>
                {sending ? "Sending…" : "Send SMS reminders"}
              </Button>
            </div>
          )
        }
      />

      {showForm && !isPatient && (
        <NewScheduleForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            {isPatient ? "Your schedules" : "Active schedules"}
          </div>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : schedules.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No schedules yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {schedules.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">
                        {s.medication}
                      </div>
                      <div className="text-xs text-slate-500">
                        {s.patient?.full_name ?? s.patient?.email ?? "—"} ·{" "}
                        {s.dose} × {s.times_per_day}/day
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDate(s.start_date)} → {formatDate(s.end_date)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-0">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            {isPatient ? "Recent doses" : "Recent dose logs (all patients)"}
          </div>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : logs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No dose logs yet.
            </p>
          ) : (
            <ul className="max-h-[480px] divide-y divide-slate-200 overflow-y-auto">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {!isPatient && (
                        <span>{l.patient?.full_name ?? "—"} · </span>
                      )}
                      {formatDateTime(l.scheduled_at)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {l.taken_at
                        ? `Taken ${formatDateTime(l.taken_at)}`
                        : "Awaiting confirmation"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge>
                    {isPatient && l.status !== "taken" && (
                      <Button size="sm" onClick={() => markTaken(l.id)}>
                        Mark taken
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {!isPatient && (
        <Card className="mt-4 p-0">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-slate-900">
              Non-adherence flags
            </span>
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Last 14 days
            </span>
          </div>
          {loading ? (
            <div className="flex h-20 items-center justify-center">
              <Spinner />
            </div>
          ) : flags.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              No missed or late doses in the last 14 days.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {flags.map((f) => (
                <li key={f.patient_id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{f.patient_name}</div>
                    <div className="mt-0.5 flex gap-3 text-xs text-slate-500">
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
      )}

      {!isPatient && (
        <Card className="mt-4 p-0">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            SMS outbox
          </div>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : smsRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No SMS messages yet. Create a schedule and click &ldquo;Send SMS
              reminders&rdquo; to queue messages.
            </p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-slate-200 overflow-y-auto">
              {smsRows.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {s.patient?.full_name ?? "—"} · {s.to_phone}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {s.body}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
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
                      <span className="text-[10px] text-slate-400">
                        {formatDateTime(s.created_at)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
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
    <Card className="mb-6 p-5">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
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
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Create schedule"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
