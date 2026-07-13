// BANTAY-TB multilingual chatbot Edge Function (self-contained, no shared imports).
//
// Behaviour:
//   • Accepts {session_id, message, language?, user_id?, role?, context?}.
//   • role: "patient" -> support-only prompt; no case statistics.
//     All other roles (health_worker, barangay_admin, tb_coordinator,
//     system_admin) -> clinical staff prompt; context is injected when present.
//   • context: optional pre-fetched live DB stats (case counts, hotspots, etc.)
//     injected into the system prompt so the AI can answer data queries
//     accurately. Only injected for non-patient roles.
//   • Detects the language if not supplied.
//   • If OPENAI_API_KEY is set, forwards the message to OpenAI Chat Completions.
//   • Otherwise returns a deterministic, locale-aware fallback.
//
// All assistant replies are persisted to the chatbot_messages table.

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

const TL_ONLY = new Set([
  "ng","mga","po","opo","naman","lang","lamang","kasi","bakit","kahit",
  "talaga","kailangan","huwag","hindi","ito","iyan","iyon","doon","dito",
  "saan","kailan","paano","ano","ikaw","kayo","tayo","magkano","marami",
  "konti","pakisabi","hika","gamot","sintomas","tigdas","trangkaso","lagnat",
  "pagod","ubo","dugo","dibdib","bahay","anak","mahawa","magpasuri","gumaling",
  "uminom","umuubo","umubo","kainin","kain","tulog","tungkol","tatlong",
  "linggo","buwan","katagal","gaano","tatanong","tanong","alak","ginagawa",
  "gagawin","pwede","kong","habang","gumagamot","ninyo","iyong","iyo",
  "nagtatrabaho","trabaho","meron","nakakahawa","ibang","impormasyon",
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
  ceb: "Ikaw si BANTAY-TB, usa ka clinical health assistant alang sa tuberkulosis ug sakit sa baga sa Davao City. Tubaga sa mubo (ubos sa 120 ka pulong) sa yano nga Bisaya. Kanunay nga isugyot ang pag-adto sa pinaka-suod nga DOTS Center alang sa eksamen. Ayaw paghatag og piho nga dosage sa tambal.",
};

// Patient support prompts: no surveillance data, focus on care and adherence
const PATIENT_PROMPTS: Record<Locale, string> = {
  en: "You are BANTAY-TB, a supportive health assistant for TB patients and their families in Davao City. Provide general health education, symptom guidance, treatment adherence encouragement, and emotional support. Reply concisely (under 120 words) in plain English. Always recommend consulting the nearest DOTS center for medical concerns. Do NOT provide case statistics, epidemiological data, or surveillance figures.",
  tl: "Ikaw si BANTAY-TB, isang health support assistant para sa mga pasyenteng may TB at kanilang pamilya sa Davao City. Magbigay ng pangkalahatang edukasyon sa kalusugan, gabay sa sintomas, at emosyonal na suporta. Sumagot nang maikli (wala pang 120 salita) sa Filipino. Irekomenda ang DOTS Center para sa medikal na alalahanin. HUWAG magbigay ng estadistika ng kaso o surveillance data.",
  ceb: "Ikaw si BANTAY-TB, usa ka health support assistant para sa mga pasyente sa TB ug ilang pamilya sa Davao City. Maghatag og kinatibuk-ang edukasyon sa kahimsog, giya sa sintomas, ug emosyonal nga suporta. Tubaga sa mubo (ubos sa 120 ka pulong) sa Bisaya. Irekomenda ang DOTS Center para sa medikal nga mga kabalaka. AYAW paghatag og estadistika sa kaso o surveillance data.",
};

const FALLBACKS: Record<Locale, string> = {
  en: "I can answer questions about TB, pneumonia, COVID-19, and asthma -- symptoms, treatment, prevention, and DOTS center information. For diagnosis, please visit the nearest DOTS center. (No AI key configured.)",
  tl: "Maaari akong sumagot tungkol sa TB, pulmonya, COVID-19, at hika -- sintomas, paggamot, pag-iwas, at DOTS Center. Para sa diagnosis, bumisita sa pinakamalapit na DOTS Center.",
  ceb: "Makahatag ko og impormasyon mahitungod sa TB, pulmonya, COVID-19, ug hubak -- sintomas, tambal, pag-likay, ug DOTS Center. Para sa diagnosis, adto sa pinaka-suod nga DOTS Center.",
};

// ─── Request body type ───────────────────────────────────────────────────────

interface Body {
  session_id: string;
  message: string;
  language?: Locale;
  user_id?: string | null;
  role?: string | null;
  context?: string;
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

    const language: Locale = body.language ?? detectLocale(body.message);
    const isPatient = body.role === "patient";
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    let reply: string;
    if (apiKey) {
      const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
      const rawBase =
        (Deno.env.get("OPENAI_BASE_URL") ?? "").replace(/\/+$/, "") ||
        "https://api.openai.com";
      const baseUrl = rawBase.replace(/\/v1$/, "");

      let systemContent = isPatient
        ? PATIENT_PROMPTS[language]
        : SYSTEM_PROMPTS[language];

      if (!isPatient && body.context) {
        systemContent +=
          "\n\nLIVE DATABASE CONTEXT (use this to answer statistics questions):\n" +
          body.context +
          "\nWhen answering questions about case counts or statistics, use only the figures above and state that they come from the live BANTAY-TB database.";
      }

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
            { role: "user", content: body.message },
          ],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI ${res.status}: ${text}`);
      }
      const j = await res.json();
      reply = j?.choices?.[0]?.message?.content?.trim() ?? FALLBACKS[language];
    } else {
      reply = FALLBACKS[language];
    }

    // Persist assistant message (best effort)
    const cfg = dbFromEnv();
    if (cfg) {
      try {
        await dbInsert(cfg, "chatbot_messages", {
          session_id: body.session_id,
          user_id: body.user_id ?? null,
          role: "assistant",
          content: reply,
          language,
        });
      } catch (err) {
        console.error("chatbot persist failed:", err);
      }
    }

    return json({ reply, language });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
