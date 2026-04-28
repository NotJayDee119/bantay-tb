import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

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

    const [s, l] = await Promise.all([scheduleQ, logQ]);
    setSchedules((s.data ?? []) as unknown as Schedule[]);
    setLogs((l.data ?? []) as unknown as Log[]);
    setLoading(false);
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
            <Button
              variant="secondary"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Close" : "Add schedule"}
            </Button>
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

    // Generate scheduled dose logs for the first 14 days as a starter set.
    const logs: { schedule_id: string; patient_id: string; scheduled_at: string; status: "scheduled" }[] = [];
    const start = new Date(form.start_date);
    for (let d = 0; d < 14; d++) {
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
    await supabase.from("adherence_logs").insert(logs);

    toast.success("Schedule created with 14 days of dose reminders.");
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
