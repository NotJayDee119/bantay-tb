import { describe, expect, it } from "vitest";
import {
  escalationMessage,
  findSilentPatients,
  planEscalations,
  type DoseLog,
} from "../lib/reminders";

const NOW = new Date("2026-08-10T12:00:00Z");
const DAY = 86_400_000;

function at(daysAgo: number): string {
  return new Date(NOW.getTime() - daysAgo * DAY).toISOString();
}

function dose(
  patient_id: string,
  daysAgo: number,
  status: DoseLog["status"] = "scheduled"
): DoseLog {
  return { patient_id, scheduled_at: at(daysAgo), status };
}

describe("findSilentPatients", () => {
  it("flags a patient with a week of unconfirmed doses", () => {
    const logs = [dose("p1", 6), dose("p1", 4), dose("p1", 2)];
    const found = findSilentPatients(logs, NOW);
    expect(found).toHaveLength(1);
    expect(found[0].patientId).toBe("p1");
    expect(found[0].unconfirmed).toBe(3);
  });

  // The whole point of the ruling: a patient who is taking their medicine and
  // confirming it should never receive a message at all.
  it("never flags a patient who confirmed inside the window", () => {
    const logs = [dose("p1", 6), dose("p1", 3, "taken"), dose("p1", 1)];
    expect(findSilentPatients(logs, NOW)).toHaveLength(0);
  });

  it("counts a late confirmation as contact — we heard from them", () => {
    const logs = [dose("p1", 5), dose("p1", 2, "late")];
    expect(findSilentPatients(logs, NOW)).toHaveLength(0);
  });

  it("ignores doses that are not due yet", () => {
    const future: DoseLog = {
      patient_id: "p1",
      scheduled_at: new Date(NOW.getTime() + 2 * DAY).toISOString(),
      status: "scheduled",
    };
    expect(findSilentPatients([future], NOW)).toHaveLength(0);
  });

  it("flags a patient whose last confirmation predates the window", () => {
    const logs = [dose("p1", 20, "taken"), dose("p1", 3)];
    const found = findSilentPatients(logs, NOW);
    expect(found).toHaveLength(1);
    expect(found[0].silentDays).toBe(20);
  });

  it("sorts the longest-silent patient first", () => {
    const logs = [
      dose("recent", 10, "taken"),
      dose("recent", 2),
      dose("old", 30, "taken"),
      dose("old", 2),
    ];
    expect(findSilentPatients(logs, NOW).map((c) => c.patientId)).toEqual([
      "old",
      "recent",
    ]);
  });
});

describe("planEscalations", () => {
  const candidate = { patientId: "p1", unconfirmed: 5, silentDays: 8 };
  const phones = new Map([["p1", "09170000000"]]);

  it("sends when nothing blocks it", () => {
    const [d] = planEscalations([candidate], { phones, sent: [], now: NOW });
    expect(d.send).toBe(true);
    expect(d.skipped).toBeNull();
  });

  // Without a cooldown a silent patient gets texted on every sweep — exactly
  // the "hay sigeg text uy" complaint.
  it("skips a patient texted inside the cooldown", () => {
    const [d] = planEscalations([candidate], {
      phones,
      sent: [{ patient_id: "p1", created_at: at(2) }],
      now: NOW,
    });
    expect(d.send).toBe(false);
    expect(d.skipped).toBe("cooldown");
  });

  it("sends again once the cooldown has passed", () => {
    const [d] = planEscalations([candidate], {
      phones,
      sent: [{ patient_id: "p1", created_at: at(9) }],
      now: NOW,
    });
    expect(d.send).toBe(true);
  });

  it("skips a patient with no phone number", () => {
    const [d] = planEscalations([candidate], {
      phones: new Map([["p1", null]]),
      sent: [],
      now: NOW,
    });
    expect(d.send).toBe(false);
    expect(d.skipped).toBe("no_phone");
  });

  // The bound that answers "who pays" with a number. All four sit inside the
  // month but outside the 7-day cooldown, so the cap is what stops this one
  // rather than the cooldown getting there first.
  it("stops at the monthly cap", () => {
    const sent = [
      { patient_id: "p1", created_at: "2026-08-01T00:00:00Z" },
      { patient_id: "p1", created_at: "2026-08-01T12:00:00Z" },
      { patient_id: "p1", created_at: "2026-08-02T00:00:00Z" },
      { patient_id: "p1", created_at: "2026-08-02T12:00:00Z" },
    ];
    const [d] = planEscalations([candidate], { phones, sent, now: NOW });
    expect(d.send).toBe(false);
    expect(d.skipped).toBe("monthly_cap");
  });

  it("does not count last month's messages against this month's cap", () => {
    const sent = Array.from({ length: 4 }, (_, i) => ({
      patient_id: "p1",
      created_at: `2026-07-0${i + 1}T00:00:00Z`,
    }));
    const [d] = planEscalations([candidate], { phones, sent, now: NOW });
    expect(d.send).toBe(true);
  });

  it("checks no_phone before cooldown, so the reason shown is the real one", () => {
    const [d] = planEscalations([candidate], {
      phones: new Map([["p1", null]]),
      sent: [{ patient_id: "p1", created_at: at(1) }],
      now: NOW,
    });
    expect(d.skipped).toBe("no_phone");
  });
});

describe("escalationMessage", () => {
  it("asks the patient to make contact rather than scolding them", () => {
    const msg = escalationMessage("Maria Dela Cruz", "Mintal DOTS");
    expect(msg).toContain("Maria");
    expect(msg).toContain("Mintal DOTS");
    expect(msg.toLowerCase()).toContain("tawag");
  });

  it("works without a name or a facility", () => {
    const msg = escalationMessage(null, null);
    expect(msg).toContain("BANTAY-TB");
    expect(msg).toContain("DOTS center");
  });

  // Anything longer splits into two billable parts.
  it("fits comfortably inside a single SMS segment", () => {
    const msg = escalationMessage("Bartolome", "Agdao District Health Center");
    expect(msg.length).toBeLessThanOrEqual(160);
  });
});
