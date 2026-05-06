import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, MessageCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { supabase } from "../lib/supabase";
import { detectLocale, LOCALE_LABEL, type Locale } from "../lib/i18n";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  language: Locale | null;
}

const PLACEHOLDER: Record<Locale, string> = {
  en: "Ask about TB, pneumonia, asthma…",
  tl: "Magtanong tungkol sa TB, pulmonya, hika…",
  ceb: "Pangutan-a bahin sa TB, pulmonya, hubak…",
};

const GREETING: Record<Locale, string> = {
  en: "Hi! I'm BANTAY-TB. Ask me anything about TB or other respiratory diseases — in English, Filipino, or Bisaya.",
  tl: "Kumusta! Ako si BANTAY-TB. Maaari kang magtanong tungkol sa TB at iba pang sakit sa baga — sa English, Filipino, o Bisaya.",
  ceb: "Kumusta! Ako si BANTAY-TB. Pwede ka mangutana bahin sa TB ug uban pang sakit sa baga — sa English, Filipino, o Bisaya.",
};

const SUGGESTIONS = [
  "What are the symptoms of TB?",
  "Ano ang sintomas ng pulmonya?",
  "Unsa ang tambal sa hubak?",
];

const FALLBACK: Record<Locale, string> = {
  en: "I can help with TB, pneumonia, COVID-19, influenza, bronchitis, COPD, and asthma. For diagnosis please visit your nearest DOTS Center. (Local fallback — chatbot service is offline.)",
  tl: "Maaari kitang tulungan tungkol sa TB, pulmonya, COVID-19, trangkaso, bronchitis, COPD, at hika. Para sa diagnosis, bumisita sa pinakamalapit na DOTS Center. (Lokal na fallback — offline ang chatbot service.)",
  ceb: "Makatabang ko bahin sa TB, pulmonya, COVID-19, trangkaso, bronchitis, COPD, ug hubak. Para sa diagnosis adto sa pinaka-suod nga DOTS Center. (Local fallback — offline ang chatbot service.)",
};

export function PublicChatbotFab() {
  const [open, setOpen] = useState(false);
  const [sessionId] = useState<string>(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: GREETING.en,
      language: "en",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setDraft("");
    const language = detectLocale(trimmed);
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      language,
    };
    setMessages((m) => [...m, userMsg]);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("chatbot", {
        body: {
          session_id: sessionId,
          message: trimmed,
          language,
          // user_id intentionally null — public, anonymous chat.
          user_id: null,
        },
      });
      if (error) throw error;
      const reply =
        (data as { reply?: string })?.reply ?? FALLBACK[language];
      const assistantLang =
        (data as { language?: Locale })?.language ?? language;
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply,
          language: assistantLang,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: FALLBACK[language],
          language,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed bottom-24 right-4 z-50 flex h-[min(560px,80vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-6"
            role="dialog"
            aria-label="BANTAY-TB chatbot"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-br from-brand-600 to-accent-600 px-4 py-3 text-white">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
                <Bot className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold leading-tight">
                  BANTAY-TB Health Assistant
                </div>
                <div className="text-xs text-white/80">
                  English · Filipino · Bisaya
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Close chatbot"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    "flex gap-2 " +
                    (m.role === "user" ? "justify-end" : "justify-start")
                  }
                >
                  {m.role === "assistant" && (
                    <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div
                    className={
                      "max-w-[78%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-relaxed " +
                      (m.role === "user"
                        ? "rounded-br-sm bg-brand-600 text-white"
                        : "rounded-bl-sm bg-slate-100 text-slate-900")
                    }
                  >
                    {m.content}
                    {m.language && m.role === "assistant" && (
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                        {LOCALE_LABEL[m.language]}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
                  <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                  Thinking…
                </div>
              )}
              {messages.length <= 1 && (
                <div className="pt-1">
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Try asking
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={PLACEHOLDER.en}
                className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600 text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] leading-snug text-slate-500">
              For information only — not a substitute for medical diagnosis.
              Visit the nearest DOTS Center for screening.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-5 right-4 z-50 flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-brand-600 to-accent-600 px-4 text-white shadow-2xl ring-4 ring-brand-100/60 transition hover:shadow-brand-300/40 sm:right-6"
        aria-expanded={open}
        aria-label={open ? "Close chatbot" : "Open BANTAY-TB chatbot"}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <MessageCircle className="h-5 w-5" />
            <span className="hidden text-sm font-semibold sm:inline">
              Ask BANTAY-TB
            </span>
          </>
        )}
      </motion.button>
    </>
  );
}
