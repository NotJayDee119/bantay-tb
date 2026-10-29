import { describe, it, expect } from "vitest";
import { findMentionedBarangays } from "../lib/barangayMention";

const names = (text: string) => findMentionedBarangays(text).map((b) => b.name);

describe("findMentionedBarangays", () => {
  it("matches hyphenated names typed without the hyphen", () => {
    expect(names("How many cases in Maa?")).toEqual(["Ma-a"]);
    expect(names("ilan ang kaso sa ma-a")).toEqual(["Ma-a"]);
  });

  it("does not treat the word 'barangay' as a barangay name", () => {
    expect(names("How many cases in barangay Maa?")).toEqual(["Ma-a"]);
    expect(names("how many cases per barangay")).toEqual([]);
  });

  it("finds numbered poblacion barangays by their code", () => {
    expect(names("cases in brgy 19-B")).toEqual(["Barangay 19-B (Pob.)"]);
    expect(names("pila ang kaso sa 19b")).toEqual(["Barangay 19-B (Pob.)"]);
  });

  it("finds a barangay by its parenthetical alias", () => {
    expect(names("cases in Lasang")).toEqual(["Alejandra Navarro (Lasang)"]);
    expect(names("cases in Toril")).toEqual(["Toril (Pob.)"]);
  });

  it("prefers a whole name over a shared word", () => {
    expect(names("cases in Matina Crossing")).toEqual(["Matina Crossing"]);
  });

  it("falls back to a distinctive word when no full name is given", () => {
    expect(names("cases in matina").length).toBeGreaterThan(1);
  });

  it("ignores accents", () => {
    expect(names("cases in santo nino")).toEqual(["Santo Niño"]);
  });

  it("does not match a name inside a longer word", () => {
    expect(names("how many cases total")).toEqual([]);
  });
});
