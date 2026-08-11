import { describe, it, expect } from "vitest";
import { parseArticleBody, blockText } from "../lib/articleBlocks";
import { HEALTH_ARTICLES } from "../data/healthContent";

/** Compare on letters and digits only. The renderer legitimately drops the
 *  punctuation that encoded the structure — the semicolons between list items,
 *  the colon after a label, a trailing full stop — so a literal comparison
 *  would fail on articles that parsed perfectly. */
const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

describe("parseArticleBody", () => {
  // The guarantee the Learn page depends on. Anything the patterns don't
  // recognise has to fall through to a plain paragraph rather than vanish —
  // silently dropping a clause from a page about when to go to hospital is the
  // one failure mode that actually matters here.
  it("never loses text, across all articles and languages", () => {
    for (const article of HEALTH_ARTICLES) {
      const rebuilt = parseArticleBody(article.body_md)
        .map(blockText)
        .join(" ");
      expect(norm(rebuilt), `text lost in ${article.slug}`).toBe(
        norm(article.body_md)
      );
    }
  });

  // Items are used as React keys in the checklist.
  it("produces list items that are unique within their block", () => {
    for (const article of HEALTH_ARTICLES) {
      for (const block of parseArticleBody(article.body_md)) {
        if (block.kind !== "checklist" && block.kind !== "topic") continue;
        expect(
          new Set(block.items).size,
          `duplicate item in ${article.slug}`
        ).toBe(block.items.length);
      }
    }
  });

  it("recovers a lead-in and its items from a semicolon list", () => {
    const [block] = parseArticleBody(
      "Common TB symptoms include: cough lasting 2 weeks or longer; chest pain; fever."
    );
    expect(block).toEqual({
      kind: "checklist",
      lead: "Common TB symptoms include",
      items: ["cough lasting 2 weeks or longer", "chest pain", "fever"],
    });
  });

  it("reads an unlabelled semicolon list as a checklist", () => {
    const [block] = parseArticleBody(
      "Wash hands often; avoid smoking; keep rooms well ventilated."
    );
    expect(block).toEqual({
      kind: "checklist",
      lead: null,
      items: ["Wash hands often", "avoid smoking", "keep rooms well ventilated"],
    });
  });

  it("splits two or more labels into topics", () => {
    const blocks = parseArticleBody(
      "Sleep: aim for 7–9 hours per night. Nutrition: eat protein at every meal."
    );
    expect(blocks.map((b) => b.kind)).toEqual(["topic", "topic"]);
    expect(blocks[0]).toMatchObject({ kind: "topic", label: "Sleep" });
    expect(blocks[1]).toMatchObject({ kind: "topic", label: "Nutrition" });
  });

  it("keeps a lone label as a list lead rather than a topic", () => {
    const [block] = parseArticleBody("Watch for: fever; chills; fatigue.");
    expect(block.kind).toBe("checklist");
  });

  it("pulls care-seeking guidance out of the paragraph", () => {
    const blocks = parseArticleBody(
      "Take prescribed antibiotics for the full course. Seek hospital care if breathing is very difficult."
    );
    expect(blocks.map((b) => b.kind)).toEqual(["prose", "alert"]);
  });

  // "agad" and "dayon" mean "promptly" and appear in ordinary advice. Setting
  // "treat a cold early" as an emergency banner would train readers to ignore
  // the banner that matters.
  it("does not treat every urgency word as an emergency", () => {
    const blocks = parseArticleBody("Gamutin agad ang sipon at trangkaso bago ito lumala.");
    expect(blocks.map((b) => b.kind)).toEqual(["prose"]);
  });

  it("keeps two clauses as prose rather than making a one-line list", () => {
    const [block] = parseArticleBody("Rest and drink fluids; take paracetamol for fever.");
    expect(block.kind).toBe("prose");
  });

  it("returns nothing for an empty body", () => {
    expect(parseArticleBody("   ")).toEqual([]);
  });
});
