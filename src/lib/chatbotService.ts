// Thin wrapper around the `chatbot` Supabase Edge Function. The function
// itself lives at `supabase/functions/chatbot/index.ts` and is responsible
// for prompting OpenAI (or returning a locale-aware fallback). This module
// owns the per-tab session id, language detection, and history shaping so
// UI components can stay focused on rendering.

import { supabase } from "./supabase";
import { detectLocale, type Locale } from "./i18n";

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatbotResponse {
  reply?: string;
  language?: Locale;
}

const FALLBACK_REPLY: Record<Locale, string> = {
  en: "I'm having trouble reaching the chatbot service right now. Please try again, or visit the nearest DOTS center if this is urgent.",
  tl: "Hindi ko maabot ang chatbot service ngayon. Pakisubukan muli o bumisita sa pinakamalapit na DOTS Center kung mahalaga.",
  ceb: "Wala ko makakontak sa chatbot service karon. Palihug sulayi pag-usab, o adto sa pinakaduol nga DOTS Center kung dinalian.",
};

// Persist a single session id per page load so consecutive messages from
// the same user are grouped together in `chatbot_messages`.
let cachedSessionId: string | null = null;
function getSessionId(): string {
  if (!cachedSessionId) {
    cachedSessionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return cachedSessionId;
}

export function resetChatbotSession(): void {
  cachedSessionId = null;
}

export async function sendChatMessage(
  message: string,
  history: ChatHistoryMessage[] = []
): Promise<string> {
  const trimmed = message.trim();
  if (!trimmed) return "";
  const language = detectLocale(trimmed);

  try {
    const { data, error } = await supabase.functions.invoke<ChatbotResponse>(
      "chatbot",
      {
        body: {
          session_id: getSessionId(),
          message: trimmed,
          language,
          user_id: null,
          history,
        },
      }
    );
    if (error) throw error;
    const reply = data?.reply?.trim();
    if (reply) return reply;
    return FALLBACK_REPLY[language];
  } catch (err) {
    console.error("[chatbotService] sendChatMessage failed", err);
    return FALLBACK_REPLY[language];
  }
}
