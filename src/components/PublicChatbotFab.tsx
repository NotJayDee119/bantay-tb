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
      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed bottom-20 right-4 z-50 flex h-[min(560px,80vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl sm:right-6"
            role="dialog"
            aria-label="BANTAY-TB chatbot"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-accent-700/20 bg-accent-600 px-4 py-3 text-white">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
                <Bot className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold leading-tight">
                  BANTAY-TB
                </div>
                <div className="text-[0.6875rem] text-white/60">
                  English · Filipino · Bisaya
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Close chatbot"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
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
                    <div className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                      <Bot className="h-3 w-3" />
                    </div>
                  )}
                  <div
                    className={
                      "max-w-[78%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[0.8125rem] leading-relaxed " +
                      (m.role === "user"
                        ? "rounded-br-md bg-brand-950 text-white"
                        : "rounded-bl-md bg-slate-100 text-slate-800")
                    }
                  >
                    {m.content}
                    {m.language && m.role === "assistant" && (
                      <div className="mt-1.5 text-[0.625rem] uppercase tracking-wider text-slate-400">
                        {LOCALE_LABEL[m.language]}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-300 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-200 [animation-delay:300ms]" />
                  </span>
                  Thinking…
                </div>
              )}
              {messages.length <= 1 && (
                <div className="pt-1">
                  <div className="mb-2 text-[0.6875rem] font-medium text-slate-400">
                    Try asking
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-lg border border-slate-150 bg-white px-3 py-2 text-left text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 bg-white px-3 py-2.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(draft);
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={PLACEHOLDER.en}
                  className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:bg-white focus:ring-1 focus:ring-brand-200"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-accent-600 text-white transition hover:bg-accent-700 disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>

            {/* Disclaimer */}
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
              <p className="text-[0.625rem] leading-snug text-slate-400">
                For information only — not a substitute for medical diagnosis.
                Visit the nearest DOTS Center for screening.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB — accent green pill */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="fixed bottom-5 right-4 z-50 flex h-12 items-center gap-2 rounded-full bg-accent-600 px-4 text-white shadow-lg transition hover:bg-accent-700 sm:right-6"
        aria-expanded={open}
        aria-label={open ? "Close chatbot" : "Open BANTAY-TB chatbot"}
      >
        {open ? (
          <X className="h-4 w-4" />
        ) : (
          <>
            <MessageCircle className="h-4 w-4" />
            <span className="hidden text-sm font-medium sm:inline">
              Ask BANTAY-TB
            </span>
          </>
        )}
      </motion.button>
    </>
  );
}
