/**
 * scripts/ingest-kb.ts
 *
 * Rebuild the public chatbot's RAG knowledge base (kb_documents + kb_chunks)
 * from two sources already in the repo:
 *   1. src/data/systemKnowledge.ts — how BANTAY-TB works.
 *   2. src/data/healthContent.ts   — the Health Education articles for the
 *      eight diseases, so the chatbot answers from the same reviewed text the
 *      Learn page shows.
 *
 * The rebuild is full, not incremental: every existing document is deleted
 * (chunks cascade) and the whole set is re-embedded. The corpus is small, and
 * this way a deleted or renamed article never lingers as a stale answer.
 *
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY
 * (or EMBEDDING_API_KEY). EMBEDDING_BASE_URL / OPENAI_BASE_URL and
 * EMBEDDING_MODEL are optional. The model must return 1536-dim vectors to
 * match kb_chunks.embedding — and must be the same model the chatbot Edge
 * Function uses for queries.
 *
 * Usage:
 *   npm run kb:ingest
 */

import { createClient } from "@supabase/supabase-js";
import {
  CATEGORY_LABEL,
  DISEASE_LABEL,
  HEALTH_ARTICLES,
  type Disease,
} from "../src/data/healthContent";
import { SYSTEM_KNOWLEDGE } from "../src/data/systemKnowledge";

// healthContent.ts says "tb"; the kb topic whitelist spells it out.
const TOPIC: Record<Disease, string> = {
  tb: "tuberculosis",
  pneumonia: "pneumonia",
  covid19: "covid19",
  asthma: "asthma",
  influenza: "influenza",
  bronchitis: "bronchitis",
  copd: "copd",
  paragonimiasis: "paragonimiasis",
};

interface KbDoc {
  topic: string;
  language: string;
  title: string;
  source: string;
  /** Article category, or the system doc's key — lets the chatbot fetch an
   *  answer directly without spending AI requests. */
  category: string;
  content: string;
}

function buildDocs(): KbDoc[] {
  const system = SYSTEM_KNOWLEDGE.map((d) => ({
    topic: "system",
    language: d.locale,
    title: d.title,
    source: "BANTAY-TB platform guide",
    category: d.slug.replace(/-(en|tl|ceb)$/, ""),
    content: `BANTAY-TB — ${d.title}\n${d.body}`,
  }));
  // Disease and category names go into the chunk text so a short article
  // still embeds near questions that name the disease.
  const articles = HEALTH_ARTICLES.map((a) => ({
    topic: TOPIC[a.disease],
    language: a.locale,
    title: a.title,
    source: "BANTAY-TB Health Education",
    category: a.category,
    content: `${DISEASE_LABEL[a.disease][a.locale]} — ${CATEGORY_LABEL[a.category][a.locale]}: ${a.title}\n${a.summary}\n${a.body_md}`,
  }));
  return [...system, ...articles];
}

async function embed(inputs: string[]): Promise<number[][]> {
  const apiKey =
    process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY (or EMBEDDING_API_KEY).");
  const base = (
    process.env.EMBEDDING_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    "https://api.openai.com"
  )
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "");
  const model = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += 100) {
    const batch = inputs.slice(i, i + 100);
    const res = await fetch(`${base}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: batch }),
    });
    if (!res.ok) {
      throw new Error(`embeddings ${res.status}: ${await res.text()}`);
    }
    const j = (await res.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    for (const d of j.data.sort((a, b) => a.index - b.index)) {
      if (d.embedding.length !== 1536) {
        throw new Error(
          `${model} returned ${d.embedding.length}-dim vectors; kb_chunks expects 1536.`
        );
      }
      out.push(d.embedding);
    }
  }
  return out;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running."
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const docs = buildDocs();
  console.log(`Embedding ${docs.length} documents…`);
  // Embed before deleting anything, so a failed API call leaves the live
  // knowledge base untouched.
  const vectors = await embed(docs.map((d) => d.content));

  // Cached AI answers were written from the old passages.
  console.log("Clearing chatbot answer cache…");
  {
    const { error } = await supabase
      .from("chatbot_answer_cache")
      .delete()
      .not("question_key", "is", null);
    if (error) throw error;
  }

  console.log("Clearing old knowledge base…");
  {
    const { error } = await supabase
      .from("kb_documents")
      .delete()
      .not("id", "is", null);
    if (error) throw error;
  }

  console.log("Inserting documents and chunks…");
  // Ids are minted here rather than read back from the insert, so each chunk
  // is tied to its document without relying on RETURNING order.
  const ids = docs.map(() => crypto.randomUUID());
  {
    const { error } = await supabase.from("kb_documents").insert(
      docs.map(({ topic, language, title, source, category }, i) => ({
        id: ids[i],
        topic,
        language,
        title,
        source,
        category,
      }))
    );
    if (error) throw error;
  }

  // Each article is a single short passage, so one document = one chunk.
  const chunks = docs.map((d, i) => ({
    document_id: ids[i],
    topic: d.topic,
    language: d.language,
    content: d.content,
    embedding: JSON.stringify(vectors[i]),
  }));
  const { error: chunkErr } = await supabase.from("kb_chunks").insert(chunks);
  if (chunkErr) throw chunkErr;

  const byTopic = docs.reduce<Record<string, number>>((acc, d) => {
    acc[d.topic] = (acc[d.topic] ?? 0) + 1;
    return acc;
  }, {});
  console.log("✓ Knowledge base rebuilt:", byTopic);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
