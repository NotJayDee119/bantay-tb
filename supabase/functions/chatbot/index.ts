// BANTAY-TB multilingual chatbot Edge Function.
//
// Behaviour:
//   • Accepts {session_id, message, language?, user_id?}.
//   • Detects the language if not supplied.
//   • If OPENAI_API_KEY is set, forwards the message to OpenAI Chat Completions
//     with a system prompt that constrains the assistant to Davao City TB &
//     respiratory disease topics, instructing it to reply in the detected
//     language.
//   • Otherwise returns a deterministic, locale-aware fallback so the UI is
//     functional in development.
//
// All assistant replies are persisted to the chatbot_messages table.

import { corsHeaders } from "../_shared/cors.ts";
import { dbFromEnv, dbInsert } from "../_shared/db.ts";
import { detectLocale, type Locale } from "../_shared/i18n.ts";

interface Body {
  session_id: string;
  message: string;
  language?: Locale;
  user_id?: string | null;
}

const SYSTEM_PROMPTS: Record<Locale, string> = {
  en:
    "You are BANTAY-TB, a clinical health assistant for tuberculosis and respiratory diseases in Davao City. Reply concisely (under 120 words) in clear, plain English. Always recommend visiting the nearest DOTS center for diagnosis. Never give specific drug doses for individual patients.",
  tl:
    "Ikaw si BANTAY-TB, isang clinical health assistant para sa tuberkulosis at sakit sa baga sa Davao City. Sumagot nang maikli (mas kaunti sa 120 salita) sa simpleng Filipino/Tagalog. Laging irekomenda ang pagpunta sa pinakamalapit na DOTS Center para sa pagsusuri. Huwag magbigay ng partikular na dosage ng gamot.",
  ceb:
    "Ikaw si BANTAY-TB, usa ka clinical health assistant alang sa tuberkulosis ug sakit sa baga sa Davao City. Tubaga sa mubo (ubos sa 120 ka pulong) sa yano nga Bisaya. Kanunay nga isugyot ang pag-adto sa pinaka-suod nga DOTS Center alang sa eksamen. Ayaw paghatag og piho nga dosage sa tambal.",
};

const FALLBACKS: Record<Locale, string> = {
  en:
    "I can answer questions about TB, pneumonia, COVID-19, and asthma — symptoms, treatment, prevention, and DOTS center information. For diagnosis, please visit the nearest DOTS center. (Local fallback — set OPENAI_API_KEY to enable AI replies.)",
  tl:
    "Maaari akong sumagot tungkol sa TB, pulmonya, COVID-19, at hika — sintomas, paggamot, pag-iwas, at DOTS Center. Para sa diagnosis, bumisita sa pinakamalapit na DOTS Center. (Lokal na fallback — i-set ang OPENAI_API_KEY para sa AI replies.)",
  ceb:
    "Makahatag ko og impormasyon mahitungod sa TB, pulmonya, COVID-19, ug hubak — sintomas, tambal, pag-likay, ug DOTS Center. Para sa diagnosis, adto sa pinaka-suod nga DOTS Center. (Local fallback — i-set ang OPENAI_API_KEY alang sa AI nga tubag.)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as Body;
    if (!body?.message || !body?.session_id) {
      return json({ error: "session_id and message are required" }, 400);
    }
    const language: Locale = body.language ?? detectLocale(body.message);
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    let reply: string;
    if (apiKey) {
      const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
      const baseUrl =
        Deno.env.get("OPENAI_BASE_URL")?.replace(/\/+$/, "") ??
        "https://api.openai.com";
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
            { role: "system", content: SYSTEM_PROMPTS[language] },
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

    // Persist the assistant message (best effort).
    const cfg = dbFromEnv();
    if (cfg) {
      try {
        await dbInsert(
          cfg,
          "chatbot_messages",
          {
            session_id: body.session_id,
            user_id: body.user_id ?? null,
            role: "assistant",
            content: reply,
            language,
          },
          { returning: false }
        );
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
