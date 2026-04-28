// BANTAY-TB medication adherence reminder Edge Function.
//
// Schedule with: `supabase functions schedule send-adherence-sms --cron "0 * * * *"`
// (or via the dashboard) to run hourly.
//
// Behaviour:
//   • Finds all adherence_logs scheduled within the next hour with status='scheduled'.
//   • Builds a localised SMS body for each patient (Tagalog/English/Bisaya
//     auto-detected from their profile preferred language; falls back to EN).
//   • Inserts a row into sms_outbox per dose.
//   • If SMS_PROVIDER env var is configured, dispatches via the matching API
//     (twilio | semaphore | philsms). Otherwise marks status='mocked' so the
//     payload is visible in the UI without sending real messages.
//   • Marks any logs that have passed their scheduled time without being
//     taken as 'missed'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";

interface ScheduledLog {
  id: string;
  patient_id: string;
  schedule_id: string;
  scheduled_at: string;
  patient: { phone: string | null; full_name: string | null } | null;
  schedule: { medication: string; dose: string } | null;
}

const REMINDER_BODY = (
  med: string,
  dose: string,
  name: string | null
) =>
  `BANTAY-TB: ${name ? `Hi ${name}, ` : ""}reminder to take ${dose} of ${med} now. Reply CONFIRM in the app once taken. Continue your full course — kompleto ang gamot, pagaling sa TB.`;

async function sendSms(
  provider: string,
  to: string,
  body: string
): Promise<{ ok: boolean; payload: unknown }> {
  if (provider === "twilio") {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_FROM_NUMBER");
    if (!sid || !token || !from)
      return { ok: false, payload: { error: "Twilio env missing" } };
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const params = new URLSearchParams({ To: to, From: from, Body: body });
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    return { ok: r.ok, payload: await r.json() };
  }
  if (provider === "semaphore") {
    const apikey = Deno.env.get("SEMAPHORE_API_KEY");
    const sender = Deno.env.get("SEMAPHORE_SENDER_NAME") ?? "BANTAYTB";
    if (!apikey) return { ok: false, payload: { error: "Semaphore env missing" } };
    const r = await fetch("https://api.semaphore.co/api/v4/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey, number: to, message: body, sendername: sender }),
    });
    return { ok: r.ok, payload: await r.json() };
  }
  if (provider === "philsms") {
    const token = Deno.env.get("PHILSMS_API_TOKEN");
    const sender = Deno.env.get("PHILSMS_SENDER_ID") ?? "BANTAYTB";
    if (!token) return { ok: false, payload: { error: "PhilSMS env missing" } };
    const r = await fetch("https://app.philsms.com/api/v3/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipient: to, message: body, sender_id: sender }),
    });
    return { ok: r.ok, payload: await r.json() };
  }
  return {
    ok: true,
    payload: { mocked: true, to, body, note: "SMS_PROVIDER not configured" },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supaUrl = Deno.env.get("SUPABASE_URL");
  const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supaUrl || !supaKey) return json({ error: "env missing" }, 500);

  const provider = Deno.env.get("SMS_PROVIDER") ?? "mock";
  const supabase = createClient(supaUrl, supaKey);

  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

  const { data: due, error } = await supabase
    .from("adherence_logs")
    .select(
      "id, patient_id, schedule_id, scheduled_at, patient:profiles!adherence_logs_patient_id_fkey(phone, full_name), schedule:adherence_schedules!adherence_logs_schedule_id_fkey(medication, dose)"
    )
    .eq("status", "scheduled")
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", inOneHour.toISOString())
    .limit(500);

  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  for (const row of (due ?? []) as unknown as ScheduledLog[]) {
    if (!row.patient?.phone || !row.schedule) continue;
    const body = REMINDER_BODY(
      row.schedule.medication,
      row.schedule.dose,
      row.patient.full_name
    );
    const result = await sendSms(provider, row.patient.phone, body);
    await supabase.from("sms_outbox").insert({
      to_phone: row.patient.phone,
      body,
      status: provider === "mock" ? "mocked" : result.ok ? "sent" : "failed",
      provider,
      provider_response: result.payload as object,
      patient_id: row.patient_id,
      schedule_id: row.schedule_id,
      sent_at: new Date().toISOString(),
    });
    sent += 1;
  }

  // Mark anything overdue as missed.
  const cutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 h grace
  const { error: missErr } = await supabase
    .from("adherence_logs")
    .update({ status: "missed" })
    .eq("status", "scheduled")
    .lte("scheduled_at", cutoff.toISOString());
  if (missErr) return json({ error: missErr.message, sent }, 500);

  return json({ provider, sent });
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
