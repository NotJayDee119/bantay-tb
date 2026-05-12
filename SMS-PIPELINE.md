# BANTAY-TB SMS Adherence Pipeline

How the medication-reminder SMS feature works end to end, from a barangay health
worker creating a schedule for a patient all the way to a real text message
hitting the patient's phone.

```
┌──────────────────┐   1. create schedule   ┌──────────────────────┐
│ BHW / Coordinator│ ──────────────────────▶│ adherence_schedules  │
│ /app/adherence   │                        │ (one row per regimen)│
└──────────────────┘                        └─────────┬────────────┘
                                                      │ 2. fan-out trigger
                                                      ▼
                                        ┌──────────────────────────┐
                                        │ adherence_logs           │
                                        │ (one row per scheduled   │
                                        │  dose, status='scheduled'│
                                        └─────────┬────────────────┘
                                                  │ 3. cron hourly
                                                  ▼
                                ┌────────────────────────────────────┐
                                │ Edge Function:                     │
                                │ send-adherence-sms                 │
                                │  • picks up doses due ≤ 1 h        │
                                │  • builds localised SMS body       │
                                │  • dispatches via SMS_PROVIDER     │
                                │  • writes audit row to sms_outbox  │
                                │  • marks overdue doses 'missed'    │
                                └─────────┬──────────────────────────┘
                                          │ 4. HTTPS POST
                                          ▼
                                ┌────────────────────────┐
                                │ SMS provider           │
                                │ Twilio / Semaphore /   │
                                │ PhilSMS                │
                                └─────────┬──────────────┘
                                          │ 5. SMS via local telco
                                          ▼
                                  📱 patient receives reminder
```

## Stage by stage

### 1. The schedule

A barangay health worker, nurse, or TB coordinator creates a regimen on
**`/app/adherence`** for one patient. Each row in `adherence_schedules`
captures:

| Column | Meaning |
| --- | --- |
| `patient_id` | Foreign key to `profiles.id` |
| `medication` | e.g. "HRZE", "Salbutamol" |
| `dose` | e.g. "4 tabs", "2 puffs" |
| `frequency` | Daily / weekly cadence |
| `start_date`, `end_date` | Treatment window |

This is row-level-security protected — only the patient and staff in the
patient's barangay can read or write. Patients never see other patients' rows.

### 2. Fan-out into individual doses

The application generates one row in `adherence_logs` per dose during the
schedule window — for a 6-month TB regimen this produces about 180 rows per
patient. Each row starts at `status = 'scheduled'`. The **`scheduled_at`** column
is the exact datetime that dose is due.

This is the work queue the Edge Function reads from.

### 3. The hourly Edge Function

`supabase/functions/send-adherence-sms/index.ts` is meant to run on a cron
schedule:

```bash
supabase functions schedule send-adherence-sms --cron "0 * * * *"
```

…or via the Supabase dashboard. Every hour it does **four** things:

1. **Pick up due doses.** It selects all `adherence_logs` where
   `status = 'scheduled'` and `scheduled_at` is within the next hour.
2. **Hydrate patient + schedule data.** Two batched REST calls fetch the
   matching `profiles` (for phone number + name + preferred language) and
   `adherence_schedules` (for medication name + dose). The function uses the
   service-role key here because patient PII must bypass RLS — there's no
   "current user" in a cron context.
3. **Build the message body.** Per dose:

   ```
   BANTAY-TB: Hi Maria, reminder to take 4 tabs of HRZE now. Reply CONFIRM in
   the app once taken. Continue your full course — kompleto ang gamot,
   pagaling sa TB.
   ```

   The function picks Tagalog / English / Bisaya phrasing automatically based
   on the patient's preferred language.

4. **Dispatch and audit.** Each message is sent through whichever SMS provider
   is configured via the `SMS_PROVIDER` environment variable, then a row is
   inserted into **`sms_outbox`** so staff have an immutable record of what
   went out, when, to which phone number, and how the provider responded.

   The function also marks any dose whose `scheduled_at` is more than 6 hours
   in the past **without** being taken as `status = 'missed'`. That is what
   lights up the red "Missed doses" counter on the Health Worker dashboard.

### 4. The provider switch

`sendSms()` is a small adapter — it looks at one env var and routes to the
right HTTP API.

| `SMS_PROVIDER` | Required env vars | Endpoint |
| --- | --- | --- |
| `twilio` | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | `https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json` |
| `semaphore` | `SEMAPHORE_API_KEY`, optional `SEMAPHORE_SENDER_NAME` | `https://api.semaphore.co/api/v4/messages` |
| `philsms` | `PHILSMS_API_TOKEN`, optional `PHILSMS_SENDER_ID` | `https://app.philsms.com/api/v3/sms/send` |
| _unset / `mock`_ | (none) | No outbound HTTP — writes a `mocked` row to `sms_outbox` only |

This is deliberate: the same code path runs in development without any keys
(everything goes to the mock outbox so you can see exactly what would have
been sent), and switching to live SMS is a one-line env var change.

### 5. Resilience

- **Per-patient try/catch.** A failure to write the audit row for one patient
  does not stop the loop — the function logs the error and continues sending
  to the rest.
- **Idempotency.** A separate `UPDATE` statement at the end of the run flips
  unsent overdue doses to `missed`, so a function failure between the dispatch
  and the status flip will not double-send the next hour (the row's
  `status='scheduled'` window has already closed).
- **No PII in the bundle.** Phone numbers and names are only ever loaded by
  the Edge Function with the service-role key. The browser bundle never gets
  this data, satisfying the Data Privacy Act constraint from the BANTAY-TB
  paper.

## What the patient sees

The patient gets a localized SMS like:

```
BANTAY-TB: Hi Maria, reminder to take 4 tabs of HRZE now. Reply CONFIRM in
the app once taken. Continue your full course — kompleto ang gamot, pagaling
sa TB.
```

They open the BANTAY-TB app, go to **Adherence**, and tap **Mark taken** on
the matching dose. That writes `taken_at = now()` and `status = 'taken'` on
the same `adherence_logs` row.

If they ignore the reminder for more than 6 hours, the next hourly cron pass
flips the row to `missed`, which shows up:

- on the patient's Adherence tab as a red "Missed" badge,
- on the BHW's Adherence page filterable list, and
- on the Health Worker dashboard's "Missed doses" stat card,

so the BHW can follow up directly with the patient.

## Current status

| Component | Status |
| --- | --- |
| Schedule creation UI (`/app/adherence`) | ✅ Live |
| `adherence_logs` fan-out + RLS | ✅ Live |
| Edge Function deployed | ✅ Live |
| `sms_outbox` audit table | ✅ Live |
| Hourly cron schedule | ⚠️ Set this in Supabase dashboard or via `supabase functions schedule` once you go live |
| Real SMS sending | ⚠️ **Mock mode** — set `SMS_PROVIDER` + provider keys in Edge Function secrets to enable real text messages |

When you're ready to flip from mock mode to live, the easiest path is **Semaphore**
(Philippine-based, supports BANTAYTB sender name, ~₱0.50/SMS, top up via GCash).
Set `SMS_PROVIDER=semaphore` and `SEMAPHORE_API_KEY=...` in **Project Settings →
Edge Functions → Secrets**, then schedule the cron — no code change needed.
