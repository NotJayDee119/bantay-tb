// BANTAY-TB multilingual chatbot Edge Function (self-contained, no shared imports).
//
// Behaviour:
//   • Accepts {session_id, message, language?, user_id?, role?, context?}.
//   • Staff roles (health_worker, barangay_admin, tb_coordinator,
//     system_admin) -> clinical staff prompt; context is injected when present.
//   • context: optional pre-fetched live DB data (case stats/hotspots)
//     injected into the system prompt.
//   • role: "public", "patient" (a sign-up with no staff role yet) or
//     absent -> answerPublic(): the knowledge base
//     (BANTAY-TB platform + eight respiratory diseases, ingested by
//     scripts/ingest-kb.ts) is used before any AI request — small talk,
//     the answer cache, and direct article lookups cost nothing. Only the
//     rest goes to RAG (embeddings + completion, answering only from the
//     retrieved passages), and those answers are cached. A question with no
//     passage above KB_MIN_SIMILARITY gets a fixed out-of-scope reply.
//   • Detects the language if not supplied.
//   • If OPENAI_API_KEY is set, forwards the message to OpenAI Chat Completions.
//   • Otherwise returns a deterministic, locale-aware fallback.
//
// Every reply is persisted to chatbot_messages (and, for public visitors, the
// question too). Signed-in replies are saved under the user verified from the
// request's token; the response's `saved` tells the app whether it must save
// the reply itself.

declare const Deno: any;

// ─── CORS ────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ─── DB helpers ──────────────────────────────────────────────────────────────

interface DbConfig { url: string; key: string; }

function dbFromEnv(): DbConfig | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return { url, key };
}

async function dbInsert(
  cfg: DbConfig,
  table: string,
  row: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${cfg.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify([row]),
  });
  if (!res.ok) {
    throw new Error(`db insert ${table}: ${res.status} ${await res.text()}`);
  }
}

// ─── i18n / locale detection ─────────────────────────────────────────────────

type Locale = "en" | "tl" | "ceb";

// Mirrors src/lib/i18n.ts — this function deploys with `--no-remote` and
// cannot import from src/, so the two copies must be changed together.
//
// Only STRICTLY Tagalog words belong here. Words shared with Cebuano
// (mga, sintomas, impormasyon, anak, alak, mahawa) were removed: a Bisaya
// sentence carrying one decisive marker lost to two shared ones, and the
// tie-break below favours Tagalog. That cost 3 of 20 Cebuano test queries.
const TL_ONLY = new Set([
  "ng","po","opo","naman","lang","lamang","kasi","bakit","kahit",
  "talaga","kailangan","huwag","hindi","ito","iyan","iyon","doon","dito",
  "saan","kailan","paano","ano","ikaw","kayo","tayo","magkano","marami",
  "konti","pakisabi","hika","gamot","tigdas","trangkaso","lagnat",
  "pagod","ubo","dugo","dibdib","bahay","magpasuri","gumaling",
  "uminom","umuubo","umubo","kainin","kain","tulog","tungkol","tatlong",
  "linggo","buwan","katagal","gaano","tatanong","tanong","ginagawa",
  "gagawin","pwede","kong","habang","gumagamot","ninyo","iyong","iyo",
  "nagtatrabaho","trabaho","meron","nakakahawa","ibang",
]);

const CEB_ONLY = new Set([
  "og","ug","kay","naa","asa","ngano","unsa","unsaon","kinsa","diay","lagi",
  "ra","pud","pod","gyud","gud","kaayo","kuyaw","nindot","lami","init",
  "bugnaw","ganahan","duna","imo","akoa","ila","ato","amo","kining","kanang",
  "anang","diha","diri","didto","dinhi","kinahanglan","buhaton","tambal",
  "hilanat","hubak","kapoy","isulti","palihug","maayong","buntag","udto",
  "hapon","gabii","akong","imong","iyang","ilang","atong","among","moinom",
  "muubo","mokaon","moadto","katong","padayon","mahimo","mahimong","buhata",
  "samtang","naga","gihatag","gihilantan","gipangutana","gisulti",
  "pinakaduol","duol","pangutana","kamo","balay","pagkaon","katulog","tuig",
  "parehas","bahin","palihog","tambalan","tulo","duha","napulo","pila","nga",
  "adlaw","dughan","dok","angay",
]);

const EN_STRONG = new Set([
  "the","is","are","was","were","and","or","but","of","in","on","at","for",
  "to","from","with","be","have","has","had","do","does","did","this","that",
  "what","where","when","why","how","who","yes","no","not","can","could",
  "should","would","please","thanks","thank","hello","good","today","tomorrow",
  "symptoms","medicine","doctor","fever","cough","tired","blood","treatment",
  "patient","during","really","free","question","drink","alcohol","while",
  "chest","information","you","always","children","transmitted","prevent",
  "tested",
]);

function detectLocale(text: string): Locale {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s'-]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "en";
  let en = 0, tl = 0, ceb = 0;
  for (const w of words) {
    if (TL_ONLY.has(w)) tl++;
    if (CEB_ONLY.has(w)) ceb++;
    if (EN_STRONG.has(w)) en++;
  }
  if (tl > 0 || ceb > 0) return tl >= ceb ? "tl" : "ceb";
  if (en > 0) return "en";
  const lower = text.toLowerCase();
  if (/\b(mga|po|opo|paano|saan|kailan|bakit|kasi)\b/.test(lower)) return "tl";
  if (/\b(unsa|asa|ngano|kinsa|naa|kay|gyud)\b/.test(lower)) return "ceb";
  return "en";
}

// ─── System prompts ──────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<Locale, string> = {
  en: "You are BANTAY-TB, a clinical health assistant for tuberculosis and respiratory diseases in Davao City. Reply concisely (under 120 words) in clear, plain English. Always recommend visiting the nearest DOTS center for diagnosis. Never give specific drug doses for individual patients.",
  tl: "Ikaw si BANTAY-TB, isang clinical health assistant para sa tuberkulosis at sakit sa baga sa Davao City. Sumagot nang maikli (mas kaunti sa 120 salita) sa simpleng Filipino/Tagalog. Laging irekomenda ang pagpunta sa pinakamalapit na DOTS Center para sa pagsusuri. Huwag magbigay ng partikular na dosage ng gamot.",
  ceb: "Ikaw si BANTAY-TB, usa ka clinical health assistant alang sa tuberkulosis ug sakit sa baga sa Davao City. Tubaga sa mubo (ubos sa 120 ka pulong) sa yano nga Cebuano. Kanunay nga isugyot ang pag-adto sa pinaka-suod nga DOTS Center alang sa eksamen. Ayaw paghatag og piho nga dosage sa tambal.",
};

// Platform knowledge for public visitors — lets the homepage chatbot
// explain how BANTAY-TB works, in any of the three languages.
const SYSTEM_INFO = `

ABOUT THE BANTAY-TB PLATFORM (use this when visitors ask how the system, website, or app works):
- BANTAY-TB is Davao City's tuberculosis surveillance and care platform.
- Public visitors can: use the DOTS Center Locator (a map with directions to free TB treatment centers), read Health Education articles about TB symptoms/treatment/prevention, and chat with this assistant in English, Filipino, or Cebuano.
- Patients do not need an account: their nurse or doctor records their treatment at the DOTS center, and everything for the public is open without signing in.
- Health workers, barangay admins, and TB coordinators sign in to: encode and track TB cases, view the GIS surveillance map and heatmaps, identify hotspots (areas with a high concentration of TB cases), receive alerts when a new high-severity hotspot is found, and view outreach analytics.
- Accounts are for health staff only. Staff use the staff registration page with an invite code.
- TB screening and DOTS treatment are free at DOTS centers in Davao City.

SCOPE: only discuss the BANTAY-TB platform and these diseases: tuberculosis, pneumonia, COVID-19, influenza, bronchitis, COPD, asthma, paragonimiasis. Politely decline anything else.`;

// ─── Public RAG ──────────────────────────────────────────────────────────────

interface KbHit {
  content: string;
  topic: string;
  title: string;
  similarity: number;
}

const LANGUAGE_NAME: Record<Locale, string> = {
  en: "English",
  tl: "Filipino (Tagalog)",
  ceb: "Cebuano (Bisaya)",
};

const OUT_OF_SCOPE: Record<Locale, string> = {
  en: "Sorry, I can only help with questions about BANTAY-TB and these diseases: tuberculosis, pneumonia, COVID-19, influenza, bronchitis, COPD, asthma, and paragonimiasis (lung fluke). For other health concerns, please visit your nearest health center.",
  tl: "Paumanhin, ang maaari ko lamang sagutin ay tungkol sa BANTAY-TB at sa mga sakit na ito: Tuberkulosis, Pulmonya, COVID-19, Trangkaso, Bronchitis, COPD (Malalang Sakit sa Baga), Hika, at Paragonimiasis (Uod sa Baga). Para sa ibang alalahanin sa kalusugan, bumisita sa pinakamalapit na health center.",
  ceb: "Pasayloa, ang matubag ra nako mao ang bahin sa BANTAY-TB ug niining mga sakita: Tuberkulosis, Pulmonya, COVID-19, Trangkaso, Bronchitis, COPD (Dugay nga Sakit sa Baga), Hubak, ug Paragonimiasis (Ulod sa Baga). Para sa ubang kabalaka sa panglawas, adto sa pinaka-duol nga health center.",
};

// Greetings, thanks and goodbyes carry no topic, so retrieval scores them as
// off-topic and they used to get the refusal. They are answered here instead,
// before retrieval, without calling the model.
type SmallTalk = "greet" | "thanks" | "bye";

// Two wordings each, alternated within a conversation (see rotate()).
const SMALL_TALK_REPLIES: Record<SmallTalk, Record<Locale, string[]>> = {
  greet: {
    en: [
      "Good day. How may I assist you? You may ask about the symptoms, treatment, or prevention of tuberculosis and other respiratory diseases, or about how to use BANTAY-TB.",
      "Hello again! What would you like to know — TB symptoms, treatment, prevention, or where to get checked for free?",
    ],
    tl: [
      "Magandang araw po. Paano ko po kayo matutulungan? Maaari po kayong magtanong tungkol sa sintomas, paggamot, o pag-iwas sa tuberkulosis at iba pang sakit sa baga, o kung paano gamitin ang BANTAY-TB.",
      "Kumusta po ulit! Ano po ang nais ninyong malaman — sintomas, paggamot, o pag-iwas sa TB, o kung saan magpasuri nang libre?",
    ],
    ceb: [
      "Maayong adlaw. Unsaon nako pagtabang kaninyo? Mahimo kamong mangutana bahin sa sintomas, tambal, o paglikay sa tuberkulosis ug uban pang sakit sa baga, o unsaon paggamit sa BANTAY-TB.",
      "Kumusta na usab! Unsa ang gusto ninyong mahibal-an — sintomas, tambal, o paglikay sa TB, o asa magpasusi nga libre?",
    ],
  },
  thanks: {
    en: [
      "You're welcome! If you have more questions about TB or other respiratory diseases, just ask. Stay healthy!",
      "Glad I could help! Feel free to ask anything else about TB or other respiratory diseases.",
    ],
    tl: [
      "Walang anuman! Kung may iba ka pang tanong tungkol sa TB o iba pang sakit sa baga, magtanong lang. Ingat palagi!",
      "Ikinagagalak kong makatulong! Magtanong lang po kung may iba pa tungkol sa TB o iba pang sakit sa baga.",
    ],
    ceb: [
      "Walay sapayan! Kung naa pa kay pangutana bahin sa TB o uban pang sakit sa baga, pangutana lang. Amping kanunay!",
      "Nalipay ko nga nakatabang! Pangutana lang kung naa pa moy laing pangutana bahin sa TB o uban pang sakit sa baga.",
    ],
  },
  bye: {
    en: [
      "Take care! Remember, TB screening and treatment are free at DOTS centers in Davao City.",
      "Goodbye, and stay well! You can come back anytime with more questions.",
    ],
    tl: [
      "Ingat! Tandaan, libre ang TB screening at paggamot sa mga DOTS center sa Davao City.",
      "Paalam po, at mag-ingat! Bumalik lang po anumang oras kung may tanong pa kayo.",
    ],
    ceb: [
      "Amping! Hinumdumi, libre ang TB screening ug pagtambal sa mga DOTS center sa Davao City.",
      "Babay, ug amping! Balik lang bisan kanus-a kung naa pa moy pangutana.",
    ],
  },
};

// Said instead of a reply the visitor has already been given in this
// conversation (see avoidRepeat()).
const OUT_OF_SCOPE_AGAIN: Record<Locale, string> = {
  en: "That one is outside what I can answer too. Try asking something like “What are the symptoms of TB?”, “Is TB treatment free?”, or “How is asthma treated?”",
  tl: "Wala rin po iyan sa masasagot ko. Subukan pong itanong ang “Ano ang sintomas ng TB?”, “Libre ba ang gamot sa TB?”, o “Paano ginagamot ang hika?”",
  ceb: "Wala usab na sa akong matubag. Sulayi pangutana ang “Unsa ang sintomas sa TB?”, “Libre ba ang tambal sa TB?”, o “Unsaon pagtambal sa hubak?”",
};

const NEXT_ARTICLE_LEAD: Record<Locale, (title: string) => string> = {
  en: (t) => `I answered that just above, so here is something new — **${t}**:`,
  tl: (t) => `Nasagot ko na po iyan sa itaas, kaya narito ang bagong impormasyon — **${t}**:`,
  ceb: (t) => `Natubag na nako na sa ibabaw, mao nga ania ang bag-ong impormasyon — **${t}**:`,
};

const ALL_COVERED: Record<Locale, string> = {
  en: "I've already shared everything I have on this topic above. For anything more specific, please ask a health worker at your nearest DOTS Center — screening and treatment are free.",
  tl: "Naibahagi ko na po sa itaas ang lahat ng impormasyon ko tungkol dito. Para sa mas tiyak na tanong, magtanong po sa health worker sa pinakamalapit na DOTS Center — libre ang pagsusuri at paggamot.",
  ceb: "Napaambit na nako sa ibabaw ang tanan nakong impormasyon bahin niini. Para sa mas piho nga pangutana, pangutana sa health worker sa pinaka-duol nga DOTS Center — libre ang pagsusi ug pagtambal.",
};

const SMALL_TALK_PATTERNS: [SmallTalk, RegExp][] = [
  ["greet", /^(hi+|hello+|hey+|helo|good (morning|afternoon|evening|day)|kumusta|kamusta|musta|magandang (umaga|tanghali|hapon|gabi)|maayong (buntag|udto|hapon|gabii))$/],
  ["thanks", /^(thanks?|thank you( (so|very) much)?|ty|salamat|daghang salamat|maraming salamat)$/],
  ["bye", /^(bye+|goodbye|good ?bye|see you|paalam|babay|ba-bye)$/],
];

/** The kind of small talk a message is, if the whole message is just that.
 *  Courtesy words ("po", "kaayo", the assistant's name) are ignored. */
function smallTalk(message: string): SmallTalk | null {
  const core = message
    .toLowerCase()
    .replace(/[^\p{L}\s-]/gu, " ")
    .replace(/\b(po|kaayo|kayo|ka|bantay-?tb|bot|there|again|din|pud)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [kind, re] of SMALL_TALK_PATTERNS) if (re.test(core)) return kind;
  return null;
}

/** Greeting words that settle the language when the detector cannot. */
function smallTalkLocale(message: string, fallback: Locale): Locale {
  const m = message.toLowerCase();
  if (/\b(magandang|maraming|paalam|walang|po)\b/.test(m)) return "tl";
  if (/\b(maayong|daghang|kaayo|babay)\b/.test(m)) return "ceb";
  if (/\b(hi|hello|hey|good|thanks?|thank|bye|goodbye)\b/.test(m)) return "en";
  return fallback;
}

// Passages can match an off-topic question that merely mentions Davao or the
// Philippines. The model flags those with this token so the visitor gets the
// same fixed refusal as a no-match question — no ad-lib wording, no sources.
const OUT_OF_SCOPE_TOKEN = "OUT_OF_SCOPE";

// ─── Answers without AI requests ─────────────────────────────────────────────
//
// The free AI quota is small, so the public chatbot spends it last:
//   1. small talk            → canned reply
//   2. asked before          → chatbot_answer_cache
//   3. one clear disease + topic, or a system question
//                            → that knowledge-base article, verbatim
//   4. anything else         → embeddings + completion, then cached
//   5. AI unavailable        → closest article for the disease named, if any

async function dbGet<T>(cfg: DbConfig, path: string): Promise<T> {
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
  });
  if (!res.ok) throw new Error(`db get ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const DISEASES: [string, RegExp][] = [
  ["tuberculosis", /\b(tb|tuberculosis|tuberkulosis|tisis)\b/],
  ["pneumonia", /\b(pneumonia|pulmonya|pulmonia)\b/],
  ["covid19", /\b(covid(-?19)?|coronavirus)\b/],
  ["influenza", /\b(flu|influenza|trangkaso)\b/],
  ["bronchitis", /\b(bronchitis|brongkitis)\b/],
  ["copd", /\b(copd|emphysema)\b/],
  ["asthma", /\b(asthma|hika|hubak)\b/],
  ["paragonimiasis", /\b(paragonimiasis|paragonimus|lung fluke|u?l?od sa baga)\b/],
];

const CATEGORIES: [string, RegExp][] = [
  ["symptoms", /\b(symptoms?|signs?|sintomas|palatandaan|timailhan)\b/],
  ["treatment", /\b(treat|treated|treatment|cure|cured|curable|medicines?|medication|gamot|gamutin|gamutan|ginagamot|paggamot|tambal|tambalan|pagtambal)\b/],
  ["prevention", /\b(prevent|prevented|prevention|avoid|iwas|iwasan|maiwasan|maiiwasan|makaiwas|pag-?iwas|likay|likayan|malikayan|paglikay|pag-?likay)\b/],
  ["lifestyle", /\b(food|foods|diet|eat|nutrition|exercise|sleep|lifestyle|pagkain|kain|pagkaon|kaon|ehersisyo|tulog|katulog)\b/],
];

// Checked before diseases: "Libre ba ang gamot sa TB?" is a cost question.
const SYSTEM_INTENTS: [string, RegExp][] = [
  ["free-care", /\b(free|libre|cost|costs|bayad|magkano|where can i (get )?(tested|test|checked)|saan (ako )?(pwede |puwede )?magpa-?suri|asa (ko )?(makapa-?susi|magpa-?susi))\b/],
  ["staff", /\b(health workers?|staff|coordinators?|bhw|barangay admin)\b/],
  ["patient-accounts", /\b(account|claim code|sign ?up|register|mag-?sign ?up|log ?in)\b/],
  ["public-features", /\b(website|site|features?|dots locator|locator|learn page)\b/],
];

const OVERVIEW_ASK = /^(what is|what's|whats|what are|ano ang|ano ba ang|unsa ang|unsa ba ang|tell me about|about|explain|define)\b/;
// Questions that need reasoning across facts are left to the model.
const NEEDS_REASONING = /\b(difference|different|vs|versus|compare|kaibahan|pagkakaiba|kalainan|why|bakit|ngano|if i|kung ako)\b/;

function normalise(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Answer { reply: string; sources: string[]; }

/** Pick the one knowledge-base document a question is plainly about.
 *  `loose` (used only when the AI is unavailable) accepts a bare disease
 *  mention and falls back to its overview. */
function pickDocument(message: string, loose: boolean): { topic: string; category: string } | null {
  const q = normalise(message);
  if (!loose && (q.split(" ").length > 12 || NEEDS_REASONING.test(q))) return null;

  for (const [category, re] of SYSTEM_INTENTS) {
    if (re.test(q)) return { topic: "system", category };
  }

  // "BANTAY-TB" contains "tb" — take the brand out before looking for TB.
  const brand = /\bbantay[\s-]?tb\b/g;
  const mentionsBrand = brand.test(q);
  const qd = q.replace(brand, " ");
  const diseases = DISEASES.filter(([, re]) => re.test(qd)).map(([t]) => t);
  if (diseases.length === 0) {
    return mentionsBrand ? { topic: "system", category: "about" } : null;
  }
  if (diseases.length > 1 && !loose) return null;

  const categories = CATEGORIES.filter(([, re]) => re.test(qd)).map(([c]) => c);
  if (categories.length === 1) return { topic: diseases[0], category: categories[0] };
  if (categories.length > 1 && !loose) return null;
  // No category: only a plain "what is X?" (or the bare name) is an overview.
  if (loose || OVERVIEW_ASK.test(q) || q.split(" ").length <= 3) {
    return { topic: diseases[0], category: "overview" };
  }
  return null;
}

/** Chunk text is "<label line>\n<summary>\n<body>"; the label line is for
 *  embeddings, not for people. */
function articleBody(content: string): string {
  return content.split("\n").slice(1).filter(Boolean).join("\n\n");
}

/** Answer straight from the knowledge base — zero AI requests. */
async function directAnswer(
  cfg: DbConfig,
  message: string,
  language: Locale,
  loose = false
): Promise<Answer | null> {
  const pick = pickDocument(message, loose);
  if (!pick) return null;
  try {
    const rows = await dbGet<{ title: string; kb_chunks: { content: string }[] }[]>(
      cfg,
      `kb_documents?select=title,kb_chunks(content)` +
        `&topic=eq.${pick.topic}&language=eq.${language}&category=eq.${pick.category}&limit=1`
    );
    const doc = rows[0];
    const content = doc?.kb_chunks?.[0]?.content;
    if (!doc || !content) return null;
    return { reply: articleBody(content), sources: [doc.title] };
  } catch (err) {
    console.error("direct answer lookup failed:", err);
    return null;
  }
}

async function cacheGet(cfg: DbConfig, key: string, language: Locale): Promise<Answer | null> {
  try {
    const rows = await dbGet<Answer[]>(
      cfg,
      `chatbot_answer_cache?select=reply,sources` +
        `&question_key=eq.${encodeURIComponent(key)}&language=eq.${language}&limit=1`
    );
    return rows[0] ?? null;
  } catch (err) {
    console.error("cache read failed:", err);
    return null;
  }
}

async function cachePut(cfg: DbConfig, key: string, language: Locale, a: Answer): Promise<void> {
  try {
    const res = await fetch(`${cfg.url}/rest/v1/chatbot_answer_cache`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{ question_key: key, language, reply: a.reply, sources: a.sources }]),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  } catch (err) {
    console.error("cache write failed:", err);
  }
}

interface PublicAnswer extends Answer {
  language: Locale;
  /** Where the reply came from — handy when checking AI spend. */
  via: "small-talk" | "cache" | "knowledge-base" | "ai" | "knowledge-base-fallback" | "fallback" | "no-repeat";
}

// ─── Conversation history ────────────────────────────────────────────────────
//
// The homepage chat sends its last few turns so that a follow-up ("how is it
// treated?") keeps its disease, and so the visitor is never handed the same
// reply twice in one conversation. The history comes from the browser, so it
// only ever shapes that visitor's own answers.

interface Turn {
  role: "user" | "assistant";
  content: string;
  /** Article titles an assistant turn was grounded in. */
  sources?: string[];
}

function cleanHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (t) =>
        t && (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string"
    )
    .slice(-8)
    .map((t) => ({
      role: t.role,
      content: t.content.slice(0, 2000),
      sources: Array.isArray(t.sources)
        ? t.sources.filter((s: unknown) => typeof s === "string").slice(0, 5)
        : [],
    }));
}

// A message that leans on an earlier one: a topic word with no disease
// ("what about treatment?") or a pronoun ("is it contagious?").
const FOLLOW_UP = /\b(it|its|this|that|they|them|more|ito|iyan|nito|niyan|naman|kini|kana|niini|ana|usab|pa)\b/;

/** The message with the disease from earlier in the conversation added, when
 *  the message is a follow-up that names none itself. */
function withFollowUpTopic(message: string, history: Turn[]): string {
  const q = normalise(message).replace(/\bbantay[\s-]?tb\b/g, " ");
  if (DISEASES.some(([, re]) => re.test(q))) return message;
  if (SYSTEM_INTENTS.some(([, re]) => re.test(q))) return message;
  if (!FOLLOW_UP.test(q) && !CATEGORIES.some(([, re]) => re.test(q))) return message;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== "user") continue;
    const prev = normalise(history[i].content).replace(/\bbantay[\s-]?tb\b/g, " ");
    const hit = DISEASES.find(([, re]) => re.test(prev));
    if (hit) return `${message} (${hit[0]})`;
  }
  return message;
}

/** Cycles through a set of wordings: each one already said in this
 *  conversation moves the pick along by one. */
function rotate(variants: string[], history: Turn[]): string {
  const said = history.filter(
    (t) => t.role === "assistant" && variants.includes(t.content)
  ).length;
  return variants[said % variants.length];
}

const CATEGORY_ORDER = [
  "overview", "symptoms", "treatment", "prevention", "lifestyle",
  "about", "public-features", "free-care", "staff", "patient-accounts",
];

/** Another article on the same topic as `a` that this conversation has not
 *  shown yet, in reading order. */
async function nextArticle(cfg: DbConfig, a: PublicAnswer, history: Turn[]): Promise<Answer | null> {
  const titles = a.sources.map((s) => `"${s.replace(/["\\]/g, "\\$&")}"`).join(",");
  const owners = await dbGet<{ topic: string }[]>(
    cfg,
    `kb_documents?select=topic&title=in.(${encodeURIComponent(titles)})&limit=1`
  );
  const topic = owners[0]?.topic;
  if (!topic) return null;
  const docs = await dbGet<{ title: string; category: string; kb_chunks: { content: string }[] }[]>(
    cfg,
    `kb_documents?select=title,category,kb_chunks(content)` +
      `&topic=eq.${topic}&language=eq.${a.language}`
  );
  const shown = new Set([...a.sources, ...history.flatMap((t) => t.sources ?? [])]);
  const next = docs
    .sort((x, y) => CATEGORY_ORDER.indexOf(x.category) - CATEGORY_ORDER.indexOf(y.category))
    .find((d) => !shown.has(d.title) && d.kb_chunks?.[0]?.content);
  if (!next) return null;
  return {
    reply: `${NEXT_ARTICLE_LEAD[a.language](next.title)}\n\n${articleBody(next.kb_chunks[0].content)}`,
    sources: [next.title],
  };
}

/** Swaps a reply the visitor has already been given in this conversation for
 *  something new: the next unseen article on the topic, or a different
 *  wording. Costs no AI requests. */
async function avoidRepeat(cfg: DbConfig | null, a: PublicAnswer, history: Turn[]): Promise<PublicAnswer> {
  const said = new Set(
    history.filter((t) => t.role === "assistant").map((t) => normalise(t.content))
  );
  if (!said.has(normalise(a.reply))) return a;

  if (a.reply === OUT_OF_SCOPE[a.language]) {
    const variants = [OUT_OF_SCOPE[a.language], OUT_OF_SCOPE_AGAIN[a.language]];
    return { ...a, reply: rotate(variants, history), via: "no-repeat" };
  }
  // Nothing to move on to without an article behind the reply.
  if (!cfg || a.sources.length === 0) return a;
  try {
    const next = await nextArticle(cfg, a, history);
    if (next) return { ...a, ...next, via: "no-repeat" };
  } catch (err) {
    console.error("next article lookup failed:", err);
  }
  return { ...a, reply: ALL_COVERED[a.language], sources: [], via: "no-repeat" };
}

async function answerPublic(message: string, detected: Locale, history: Turn[]): Promise<PublicAnswer> {
  let language = detected;

  const talk = smallTalk(message);
  if (talk) {
    language = smallTalkLocale(message, language);
    const reply = rotate(SMALL_TALK_REPLIES[talk][language], history);
    return { reply, sources: [], language, via: "small-talk" };
  }

  const cfg = dbFromEnv();
  const question = withFollowUpTopic(message, history);
  return avoidRepeat(cfg, await findAnswer(cfg, question, language, history), history);
}

async function findAnswer(
  cfg: DbConfig | null,
  message: string,
  language: Locale,
  history: Turn[]
): Promise<PublicAnswer> {
  const key = normalise(message);
  if (cfg) {
    const cached = await cacheGet(cfg, key, language);
    if (cached) return { ...cached, language, via: "cache" };
    const direct = await directAnswer(cfg, message, language);
    if (direct) return { ...direct, language, via: "knowledge-base" };
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { reply: FALLBACKS[language], sources: [], language, via: "fallback" };

  try {
    const hits = await retrieve(message);
    let answer: Answer;
    if (hits !== null && hits.length === 0) {
      answer = { reply: OUT_OF_SCOPE[language], sources: [] };
    } else {
      const system = hits
        ? publicRagPrompt(language, hits)
        : SYSTEM_PROMPTS[language] + SYSTEM_INFO;
      const reply = (await complete(apiKey, system, message, history)) ?? FALLBACKS[language];
      answer = reply.includes(OUT_OF_SCOPE_TOKEN)
        ? { reply: OUT_OF_SCOPE[language], sources: [] }
        : { reply, sources: hits ? [...new Set(hits.map((h) => h.title))] : [] };
    }
    // Only answers grounded in the knowledge base are worth repeating.
    if (cfg && hits !== null) await cachePut(cfg, key, language, answer);
    return { ...answer, language, via: "ai" };
  } catch (err) {
    // Quota used up or provider down: an article beats "offline".
    if (cfg) {
      const loose = await directAnswer(cfg, message, language, true);
      if (loose) return { ...loose, language, via: "knowledge-base-fallback" };
    }
    throw err;
  }
}

/** Embed the question and fetch the closest knowledge-base passages.
 *  Returns null when retrieval itself is unavailable (so the caller can fall
 *  back), and [] when it worked but nothing was relevant enough. */
async function retrieve(question: string): Promise<KbHit[] | null> {
  const cfg = dbFromEnv();
  const apiKey =
    Deno.env.get("EMBEDDING_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
  if (!cfg || !apiKey) return null;
  // Embeddings may live on a different provider than chat completions
  // (e.g. chat via an OpenAI-compatible host that has no /v1/embeddings).
  // Must be the same model scripts/ingest-kb.ts used.
  const base = (
    Deno.env.get("EMBEDDING_BASE_URL") ??
    Deno.env.get("OPENAI_BASE_URL") ??
    "https://api.openai.com"
  )
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "");
  const model = Deno.env.get("EMBEDDING_MODEL") ?? "text-embedding-3-small";
  const minSim = Number(Deno.env.get("KB_MIN_SIMILARITY") ?? "0.3");

  try {
    const embRes = await fetch(`${base}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: question }),
    });
    if (!embRes.ok) {
      throw new Error(`embeddings ${embRes.status}: ${await embRes.text()}`);
    }
    const embedding = (await embRes.json())?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) throw new Error("no embedding returned");

    const rpcRes = await fetch(`${cfg.url}/rest/v1/rpc/match_kb_chunks`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: JSON.stringify(embedding),
        k: 5,
        min_sim: minSim,
      }),
    });
    if (!rpcRes.ok) {
      throw new Error(`match_kb_chunks ${rpcRes.status}: ${await rpcRes.text()}`);
    }
    const hits = (await rpcRes.json()) as KbHit[];
    if (hits.length > 0) return hits;

    // No match is only "out of scope" if there was something to match —
    // an un-ingested knowledge base must not turn every question away.
    const anyRes = await fetch(`${cfg.url}/rest/v1/kb_chunks?select=id&limit=1`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!anyRes.ok) throw new Error(`kb_chunks ${anyRes.status}`);
    if (((await anyRes.json()) as unknown[]).length === 0) {
      throw new Error("knowledge base is empty — run npm run kb:ingest");
    }
    return [];
  } catch (err) {
    console.error("kb retrieval failed, using built-in prompt:", err);
    return null;
  }
}

function publicRagPrompt(language: Locale, hits: KbHit[]): string {
  const sources = hits
    .map((h, i) => `[${i + 1}] ${h.title} (${h.topic})\n${h.content}`)
    .join("\n\n");
  return `You are BANTAY-TB, the public assistant on Davao City's tuberculosis surveillance website. You may ONLY talk about the BANTAY-TB platform and these eight diseases: tuberculosis, pneumonia, COVID-19, influenza, bronchitis, COPD, asthma, and paragonimiasis.

Rules:
- Answer ONLY from the SOURCES below. If they do not contain the answer, say you do not have that information and suggest asking at the nearest DOTS center. Never add outside facts or invent details.
- If the question is about anything else, reply with exactly ${OUT_OF_SCOPE_TOKEN} and nothing more.
- Never diagnose, and never give drug doses for an individual. When someone describes symptoms, recommend the nearest DOTS center (screening and treatment are free).
- Reply in ${LANGUAGE_NAME[language]}, concisely (under 120 words), in plain words. Sources may be written in another language; translate as needed.
- Earlier turns of the conversation are included. Do not repeat what you already said: if the visitor asks the same thing again, explain it more simply or add details you have not given yet. Write each answer so it stands on its own, without phrases like "as I mentioned".

SOURCES:
${sources}`;
}

const FALLBACKS: Record<Locale, string> = {
  en: "I can answer questions about TB, pneumonia, COVID-19, influenza, bronchitis, COPD, asthma, and paragonimiasis -- symptoms, treatment, prevention, and DOTS center information. For diagnosis, please visit the nearest DOTS center. (No AI key configured.)",
  tl: "Maaari akong sumagot tungkol sa TB, pulmonya, COVID-19, trangkaso, bronchitis, COPD, hika, at paragonimiasis -- sintomas, paggamot, pag-iwas, at DOTS Center. Para sa diagnosis, bumisita sa pinakamalapit na DOTS Center.",
  ceb: "Makahatag ko og impormasyon mahitungod sa TB, pulmonya, COVID-19, trangkaso, bronchitis, COPD, hubak, ug paragonimiasis -- sintomas, tambal, pag-likay, ug DOTS Center. Para sa diagnosis, adto sa pinaka-suod nga DOTS Center.",
};

// ─── Request body type ───────────────────────────────────────────────────────

interface Body {
  session_id: string;
  message: string;
  language?: Locale;
  user_id?: string | null;
  /** Id the signed-in app gives the reply, so it can save the reply itself
   *  when this function could not (and never save it twice). */
  reply_id?: string;
  role?: string | null;
  context?: string;
  /** Public chat only: the last few turns, oldest first. */
  history?: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in user behind the request, checked against Supabase Auth.
 *  The function is deployed without JWT verification (public visitors call
 *  it too), so the body's user_id is never trusted: saving under it would
 *  let anyone write into someone else's chat history. */
async function verifiedUserId(req: Request): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const auth = req.headers.get("Authorization");
  if (!url || !anon || !auth?.startsWith("Bearer ")) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: auth },
    });
    if (!res.ok) return null; // the anon key, or an expired session
    const id = (await res.json())?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as Body;
    if (!body?.message || !body?.session_id) {
      return json({ error: "session_id and message are required" }, 400);
    }

    let language: Locale = body.language ?? detectLocale(body.message);
    // `patient` is a sign-up that never received a staff role; it gets the
    // same answers as an anonymous visitor.
    const isPublicRole =
      !body.role || body.role === "public" || body.role === "patient";

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    let reply: string;
    let sources: string[] = [];
    let via: PublicAnswer["via"] | undefined;
    if (isPublicRole) {
      // Public visitors: knowledge base first, AI only when needed.
      const a = await answerPublic(body.message, language, cleanHistory(body.history));
      ({ reply, sources, language, via } = a);
    } else if (apiKey) {
      let systemContent = SYSTEM_PROMPTS[language];

      if (body.context) {
        systemContent +=
          "\n\nLIVE DATABASE CONTEXT (use this to answer statistics questions):\n" +
          body.context +
          "\nWhen answering questions about case counts or statistics, use only the figures above and state that they come from the live BANTAY-TB database. If a figure the user asks for is not listed, say it is not available rather than guessing. When a line says a barangay is outside the user's assigned area, tell them plainly that their account only covers their assigned area. The user is health staff, not a patient: do not tell them to visit a DOTS center when they ask about data.";
      }

      reply =
        (await complete(apiKey, systemContent, body.message)) ??
        FALLBACKS[language];
    } else {
      reply = FALLBACKS[language];
    }

    // Persist the exchange (best effort). Signed-in users' questions are saved
    // by the app before it calls here; public visitors have no app-side save,
    // so their question is stored here, ahead of the reply.
    const cfg = dbFromEnv();
    let saved = false;
    if (cfg) {
      const userId = isPublicRole ? null : await verifiedUserId(req);
      try {
        if (isPublicRole) {
          await dbInsert(cfg, "chatbot_messages", {
            session_id: body.session_id,
            user_id: null,
            role: "user",
            content: body.message,
            language,
          });
        }
        // A signed-in reply saved without its owner would never show in their
        // history, so when the session can't be verified it is left unsaved
        // here and the app saves it under their account instead.
        if (isPublicRole || userId !== null) {
          await dbInsert(cfg, "chatbot_messages", {
            ...(body.reply_id && UUID.test(body.reply_id) ? { id: body.reply_id } : {}),
            session_id: body.session_id,
            user_id: userId,
            role: "assistant",
            content: reply,
            language,
          });
          saved = true;
        }
      } catch (err) {
        console.error("chatbot persist failed:", err);
      }
    }

    return json({ reply, language, sources, via, saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

async function complete(
  apiKey: string,
  systemContent: string,
  message: string,
  history: Turn[] = []
): Promise<string | undefined> {
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
  const rawBase =
    (Deno.env.get("OPENAI_BASE_URL") ?? "").replace(/\/+$/, "") ||
    "https://api.openai.com";
  const baseUrl = rawBase.replace(/\/v1$/, "");
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemContent },
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: "user", content: message },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }
  const j = await res.json();
  return j?.choices?.[0]?.message?.content?.trim();
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
