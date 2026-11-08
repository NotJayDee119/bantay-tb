import { describe, expect, it } from "vitest";
import {
  canReset,
  temporaryPassword,
  TEMP_PASSWORD_ALPHABET,
  type StaffRole,
} from "../../supabase/functions/_shared/staffPassword.ts";

const ROLES: StaffRole[] = [
  "system_admin",
  "tb_coordinator",
  "barangay_admin",
  "health_worker",
  "patient",
];

describe("canReset", () => {
  it("lets the system admin reset any account", () => {
    for (const target of ROLES) expect(canReset("system_admin", target)).toBe(true);
  });

  it("limits coordinators to field staff", () => {
    expect(canReset("tb_coordinator", "health_worker")).toBe(true);
    expect(canReset("tb_coordinator", "barangay_admin")).toBe(true);
    expect(canReset("tb_coordinator", "tb_coordinator")).toBe(false);
    expect(canReset("tb_coordinator", "system_admin")).toBe(false);
    expect(canReset("tb_coordinator", "patient")).toBe(false);
  });

  it("refuses everyone else", () => {
    for (const actor of ["barangay_admin", "health_worker", "patient"] as StaffRole[]) {
      for (const target of ROLES) expect(canReset(actor, target)).toBe(false);
    }
  });
});

describe("temporaryPassword", () => {
  it("is three groups of four unambiguous characters with every class present", () => {
    for (let i = 0; i < 200; i++) {
      const p = temporaryPassword();
      expect(p).toMatch(/^[^-]{4}-[^-]{4}-[^-]{4}$/);
      const raw = p.replace(/-/g, "");
      for (const ch of raw) expect(TEMP_PASSWORD_ALPHABET).toContain(ch);
      expect(raw).toMatch(/[a-z]/);
      expect(raw).toMatch(/[A-Z]/);
      expect(raw).toMatch(/[0-9]/);
      expect(raw).not.toMatch(/[0O1lI]/);
    }
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 500 }, temporaryPassword));
    expect(seen.size).toBe(500);
  });
});
