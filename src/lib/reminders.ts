/**
 * SMS policy.
 *
 * The panel's ruling, in one line: do not text per dose. Two reasons were
 * given — spam ("hay sigeg text uy") and cost, nobody had said who pays — and
 * one fact behind both: **medicines are dispensed weekly or monthly, not
 * observed daily.** A patient who walked home with 28 days of tablets has
 * nothing to be reminded of tonight; they already have the pills.
 *
 * So the trigger changes from "a dose is due" to "we have not heard from this
 * patient in a week". That is a follow-up signal, not a nag, and it is rare by
 * construction: a patient taking their medicine and confirming it is never
 * texted at all.
 *
 * Three guards keep the volume honest, and each answers a different half of
 * the objection:
 *
 *   SILENCE_DAYS  — how long before a patient counts as out of contact.
 *                   He first said 3 days, then revised to about a week.
 *   COOLDOWN_DAYS — never text the same patient twice inside this window.
 *                   Without it, a silent patient is texted on every sweep,
 *                   which is precisely the spam complained about.
 *   MONTHLY_CAP   — hard ceiling per patient per month. Answers "who pays"
 *                   with an arithmetic bound rather than an assurance.
 *
 * After the escalation the next step is a person, not another message: the
 * patient moves onto the follow-up list for a call or a home visit.
 */

export const SILENCE_DAYS = 7;
export const COOLDOWN_DAYS = 7;
export const MONTHLY_CAP = 4;

const DAY_MS = 86_400_000;

export interface DoseLog {
  patient_id: string;
  scheduled_at: string;
  status: "scheduled" | "taken" | "missed" | "late";
}

export interface SentMessage {
  patient_id: string | null;
  created_at: string;
}

export type SkipReason = "no_phone" | "cooldown" | "monthly_cap";

export interface EscalationCandidate {
  patientId: string;
  /** Doses that came and went unconfirmed since we last heard from them. */
  unconfirmed: number;
  /** Days since the last confirmed dose, or since the window opened. */
  silentDays: number;
}

export interface EscalationDecision extends EscalationCandidate {
  send: boolean;
  skipped: SkipReason | null;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * Patients whose doses came due and were never confirmed for SILENCE_DAYS.
 *
 * A dose still in the future proves nothing either way, so only doses whose
 * scheduled time has passed are counted. One confirmation anywhere in the
 * window is enough to clear a patient — the question is contact, not
 * perfection.
 */
export function findSilentPatients(
  logs: DoseLog[],
  now: Date = new Date(),
  silenceDays: number = SILENCE_DAYS
): EscalationCandidate[] {
  const windowStart = new Date(now.getTime() - silenceDays * DAY_MS);
  const byPatient = new Map<
    string,
    { unconfirmed: number; lastTaken: Date | null }
  >();

  for (const log of logs) {
    const due = new Date(log.scheduled_at);
    if (due > now) continue;

    const entry = byPatient.get(log.patient_id) ?? {
      unconfirmed: 0,
      lastTaken: null,
    };

    if (log.status === "taken" || log.status === "late") {
      if (!entry.lastTaken || due > entry.lastTaken) entry.lastTaken = due;
    } else if (due >= windowStart) {
      entry.unconfirmed += 1;
    }

    byPatient.set(log.patient_id, entry);
  }

  const candidates: EscalationCandidate[] = [];
  for (const [patientId, entry] of byPatient) {
    // Heard from them inside the window — nothing to chase.
    if (entry.lastTaken && entry.lastTaken >= windowStart) continue;
    if (entry.unconfirmed === 0) continue;

    candidates.push({
      patientId,
      unconfirmed: entry.unconfirmed,
      silentDays: entry.lastTaken
        ? daysBetween(entry.lastTaken, now)
        : silenceDays,
    });
  }

  return candidates.sort((a, b) => b.silentDays - a.silentDays);
}

/**
 * Applies the three guards to a candidate list, returning a decision per
 * patient so the UI can explain what it is about to do — and what it isn't —
 * before a single message is queued.
 */
export function planEscalations(
  candidates: EscalationCandidate[],
  context: {
    phones: Map<string, string | null>;
    /** Every message already sent to each patient, newest order irrelevant. */
    sent: SentMessage[];
    now?: Date;
    cooldownDays?: number;
    monthlyCap?: number;
  }
): EscalationDecision[] {
  const now = context.now ?? new Date();
  const cooldownDays = context.cooldownDays ?? COOLDOWN_DAYS;
  const monthlyCap = context.monthlyCap ?? MONTHLY_CAP;
  const cooldownStart = new Date(now.getTime() - cooldownDays * DAY_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const recent = new Map<string, number>();
  const thisMonth = new Map<string, number>();
  for (const msg of context.sent) {
    if (!msg.patient_id) continue;
    const at = new Date(msg.created_at);
    if (at >= cooldownStart) {
      recent.set(msg.patient_id, (recent.get(msg.patient_id) ?? 0) + 1);
    }
    if (at >= monthStart) {
      thisMonth.set(msg.patient_id, (thisMonth.get(msg.patient_id) ?? 0) + 1);
    }
  }

  return candidates.map((c) => {
    let skipped: SkipReason | null = null;
    if (!context.phones.get(c.patientId)) {
      skipped = "no_phone";
    } else if ((recent.get(c.patientId) ?? 0) > 0) {
      skipped = "cooldown";
    } else if ((thisMonth.get(c.patientId) ?? 0) >= monthlyCap) {
      skipped = "monthly_cap";
    }
    return { ...c, send: skipped === null, skipped };
  });
}

/** One GSM-7 segment. Past this, a single reminder is billed as two. */
export const SMS_SEGMENT = 160;

/**
 * The message itself. Deliberately not a scolding: it asks the patient to get
 * in touch, because at this point the clinic does not know whether they have
 * stopped treatment, run out of tablets, or simply never used the app.
 *
 * Kept inside one SMS segment on purpose. A long facility name would otherwise
 * push an ordinary reminder into two billable parts, quietly doubling the cost
 * this policy exists to control — so the message sheds detail rather than
 * spilling over.
 */
export function escalationMessage(
  patientName: string | null,
  facilityName: string | null
): string {
  const first = patientName?.trim().split(/\s+/)[0];
  const who = first ? `Hi ${first}, ` : "";
  const where = facilityName?.trim() || "imong DOTS center";
  const body = `BANTAY-TB: ${who}wala pa mi update sa imong tambal. Palihug tawag o duaw sa `;

  const full = `${body}${where} para padayon ang pagtambal. Salamat!`;
  if (full.length <= SMS_SEGMENT) return full;

  // Drop the closing clause before dropping the facility — knowing where to go
  // is worth more to the patient than the sign-off.
  const trimmed = `${body}${where}. Salamat!`;
  if (trimmed.length <= SMS_SEGMENT) return trimmed;

  return `BANTAY-TB: ${who}wala pa mi update sa imong tambal. Palihug tawag sa imong DOTS center. Salamat!`;
}
