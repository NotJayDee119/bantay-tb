/** Turns an article's `body_md` into structured blocks the reader can skim.
 *
 *  The health content is authored as flowing prose, but a lot of it is really a
 *  list wearing a paragraph's clothes: "Common TB symptoms include: cough
 *  lasting 2 weeks or longer; cough with blood or sputum; chest pain; …". Set
 *  as one run-on sentence, a worried reader has to parse eight symptoms out of
 *  a wall of text. Set as eight lines with a mark against each, they can find
 *  themselves in it in a second.
 *
 *  So rather than rewrite 105 articles in three languages, we recover the
 *  structure the punctuation already encodes:
 *
 *    - `Sleep: … Nutrition: … Exercise: …`  → labelled topics
 *    - `Watch for: a; b; c.`                → a lead-in plus a checklist
 *    - `a; b; c.`                           → a bare checklist
 *    - "Seek hospital care if …"            → pulled out as an alert
 *    - anything else                        → a paragraph, untouched
 *
 *  Two rules this module holds itself to:
 *
 *  1. **Nothing is ever dropped.** Every character of the source ends up in
 *     some block. Anything the patterns don't recognise falls through to
 *     `prose`, which is exactly how the page rendered before. `blockText()`
 *     exists so a test can assert this.
 *  2. **No lookbehind.** Safari only got `(?<=…)` in 16.4, and this page is
 *     read on cheap, old phones over mobile data. A regex that throws at parse
 *     time takes the whole page down with it.
 */

/** A paragraph, left exactly as written. */
export interface ProseBlock {
  kind: "prose";
  text: string;
}

/** A checklist: an optional lead-in sentence, then the items. */
export interface ChecklistBlock {
  kind: "checklist";
  lead: string | null;
  items: string[];
}

/** A named sub-section — "Sleep", "Nutrisyon", "Mga trigger". */
export interface TopicBlock {
  kind: "topic";
  label: string;
  /** Prose under the label when it isn't a list. */
  text: string | null;
  /** List items under the label, when the label introduces one. */
  items: string[];
}

/** "Seek hospital care if breathing is very difficult." — guidance that must
 *  not read like the sentence before it. */
export interface AlertBlock {
  kind: "alert";
  text: string;
}

export type ArticleBlock =
  | ProseBlock
  | ChecklistBlock
  | TopicBlock
  | AlertBlock;

/** Splits prose into sentences.
 *
 *  Naive on purpose: the corpus has no abbreviations that end in a period, and
 *  its numbers ("94%", "38°C", "7–9 hours", "2 months") carry no decimal
 *  points. If content later breaks that assumption the worst case is a
 *  paragraph splitting a sentence early — no text is lost. */
function sentencesOf(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A sentence that opens with a short `Label:` prefix. Capped at 34 characters
 *  so a colon inside real prose ("…symptoms are often missed at first: …")
 *  isn't mistaken for a heading. */
const LABELLED = /^([^:;.!?]{1,34}):\s+(.+)$/s;

/** Care-seeking guidance, in all three languages.
 *
 *  Deliberately keyed on the *action* — "seek", "kumonsulta", "pakonsulta" —
 *  and not on urgency words alone. Tagalog "agad" and Cebuano "dayon" both
 *  mean "promptly" and appear in ordinary advice ("Gamutin agad ang sipon" —
 *  treat a cold early), which is not an emergency instruction and shouldn't be
 *  set as one. */
const SEEK_CARE =
  /\b(?:seek|see a doctor|visit the nearest|go to the nearest|emergency|hospital|DOTS|magpatingin|magpa-?ospital|magpa-?emergency|kumonsulta|bumisita|tumawag|(?:pag)?pakonsulta|(?:pag)?patan-aw|adto(?:\s+dayon)?\s+sa|ospital)\b/i;

/** Splits a run of semicolon-separated clauses into list items. */
function itemsOf(text: string): string[] {
  return text
    .split(";")
    .map((s) => s.trim().replace(/[.]+$/, "").trim())
    .filter(Boolean);
}

/** True when a sentence is a list rather than a statement. Two items is not a
 *  list — "rest, drink fluids; take paracetamol" reads better as prose — so
 *  three clauses is the floor. */
function isList(text: string): boolean {
  return itemsOf(text).length >= 3;
}

/** Builds the block for one sentence that carries no label. */
function blockForSentence(sentence: string): ArticleBlock {
  if (isList(sentence)) {
    // "Watch for: a; b; c." — the colon splits lead-in from items.
    const colon = sentence.indexOf(":");
    const semicolon = sentence.indexOf(";");
    if (colon > -1 && colon < semicolon) {
      return {
        kind: "checklist",
        lead: sentence.slice(0, colon).trim(),
        items: itemsOf(sentence.slice(colon + 1)),
      };
    }
    return { kind: "checklist", lead: null, items: itemsOf(sentence) };
  }
  if (SEEK_CARE.test(sentence)) return { kind: "alert", text: sentence };
  return { kind: "prose", text: sentence };
}

/**
 * Parses one article body into blocks, in source order.
 *
 * @param body The article's `body_md`.
 */
export function parseArticleBody(body: string): ArticleBlock[] {
  const trimmed = body.trim();
  if (!trimmed) return [];

  const sentences = sentencesOf(trimmed);
  const labelled = sentences
    .map((s) => s.match(LABELLED))
    .filter((m): m is RegExpMatchArray => m !== null);

  // Two or more labels means the author wrote sub-sections ("Sleep: …
  // Nutrition: … Exercise: …"). A single label is just a lead-in to a list,
  // which `blockForSentence` already handles better.
  const asTopics = labelled.length >= 2;

  const blocks: ArticleBlock[] = [];
  let paragraph: string[] = [];

  /** Prose accumulates so consecutive plain sentences stay one paragraph. */
  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: "prose", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (const sentence of sentences) {
    const match = asTopics ? sentence.match(LABELLED) : null;

    if (match) {
      flush();
      const [, label, rest] = match;
      blocks.push(
        isList(rest)
          ? { kind: "topic", label: label.trim(), text: null, items: itemsOf(rest) }
          : { kind: "topic", label: label.trim(), text: rest.trim(), items: [] }
      );
      continue;
    }

    const block = blockForSentence(sentence);
    if (block.kind === "prose") {
      paragraph.push(block.text);
      continue;
    }
    flush();
    blocks.push(block);
  }

  flush();
  return blocks;
}

/** Every piece of text a block will render, for round-trip checking. */
export function blockText(block: ArticleBlock): string {
  switch (block.kind) {
    case "prose":
    case "alert":
      return block.text;
    case "checklist":
      return [block.lead, ...block.items].filter(Boolean).join(" ");
    case "topic":
      return [block.label, block.text, ...block.items].filter(Boolean).join(" ");
  }
}
