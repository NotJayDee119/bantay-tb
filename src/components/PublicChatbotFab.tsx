import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, MessageCircle } from "lucide-react";
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
  "How does BANTAY-TB work?",
  "What are the symptoms of TB?",
  "Ano ang sintomas ng pulmonya?",
  "Unsa ang tambal sa hubak?",
];

// "How does this website/system work?" gets a curated answer built in —
// deterministic, always correct, and available even when the AI service
// is offline.
const ABOUT_SYSTEM: Record<Locale, string> = {
  en: [
    "BANTAY-TB is Davao City's tuberculosis surveillance and care platform. Here's what you can do:",
    "",
    "🗺️ DOTS Locator — find the nearest free TB treatment center with directions.",
    "📚 Health Education — learn about TB symptoms, treatment, and prevention.",
    "💬 This chatbot — ask health questions in English, Filipino, or Bisaya.",
    "",
    "Patients with an account also get medication schedules, dose reminders, and a personal health assistant. Health workers and TB coordinators sign in to report cases, view the GIS surveillance map, and receive hotspot alerts.",
    "",
    "To get started, tap “Sign in” or “Request an account” in the menu. TB screening and DOTS treatment are free!",
  ].join("\n"),
  tl: [
    "Ang BANTAY-TB ay plataporma ng Davao City para sa pagbabantay at pangangalaga sa TB. Narito ang magagawa mo:",
    "",
    "🗺️ DOTS Locator — hanapin ang pinakamalapit na libreng TB treatment center na may direksyon.",
    "📚 Health Education — alamin ang sintomas, paggamot, at pag-iwas sa TB.",
    "💬 Ang chatbot na ito — magtanong sa English, Filipino, o Bisaya.",
    "",
    "Ang mga pasyenteng may account ay may iskedyul ng gamot, paalala sa dose, at personal na health assistant. Ang mga health worker at TB coordinator ay nag-sign in para mag-ulat ng kaso at makita ang surveillance map.",
    "",
    "Para magsimula, pindutin ang “Sign in” o “Request an account”. Libre ang TB screening at DOTS treatment!",
  ].join("\n"),
  ceb: [
    "Ang BANTAY-TB mao ang plataporma sa Davao City alang sa pagbantay ug pag-atiman sa TB. Ania ang imong mahimo:",
    "",
    "🗺️ DOTS Locator — pangitaa ang pinaka-duol nga libre nga TB treatment center nga adunay direksyon.",
    "📚 Health Education — hibaloi ang sintomas, tambal, ug paglikay sa TB.",
    "💬 Kini nga chatbot — pangutana sa English, Filipino, o Bisaya.",
    "",
    "Ang mga pasyente nga adunay account makakuha og iskedyul sa tambal, pahinumdom sa dose, ug personal nga health assistant. Ang mga health worker ug TB coordinator mo-sign in aron mag-report og kaso ug makita ang surveillance map.",
    "",
    "Aron magsugod, i-tap ang “Sign in” o “Request an account”. Libre ang TB screening ug DOTS treatment!",
  ].join("\n"),
};

function isSystemQuery(text: string): boolean {
  return /\b(bantay[\s-]?tb|this (website|site|app|system|platform)|the (website|site|app|system|platform)|how (does|do) (this|it|the)|paano (gamitin|gumagana)|unsaon (paggamit|paggana)|sign ?in|log ?in|register|account|features?|dots locator)\b/i.test(
    text
  );
}

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

    // System questions get the curated built-in answer — shown after a
    // brief typing pause so the reply doesn't pop in robotically.
    if (isSystemQuery(trimmed)) {
      setSending(true);
      setTimeout(() => {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: ABOUT_SYSTEM[language],
            language,
          },
        ]);
        setSending(false);
      }, 700);
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("chatbot", {
        body: {
          session_id: sessionId,
          message: trimmed,
          language,
          user_id: null,
          role: "public",
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
      {/* Chat window — stays mounted so open/close can animate */}
      <div
        className={
          "fixed bottom-24 right-4 z-50 flex h-[min(560px,calc(100dvh-8rem))] w-[min(380px,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl transition-all duration-300 ease-out sm:right-6 " +
          (open
            ? "visible translate-y-0 scale-100 opacity-100"
            : "invisible pointer-events-none translate-y-4 scale-90 opacity-0")
        }
        role="dialog"
        aria-label="BANTAY-TB chatbot"
        aria-hidden={!open}
      >
            {/* Header — dark brand, matching the site's surveillance styling */}
            <div className="relative flex items-center gap-3 overflow-hidden bg-brand-950 px-4 py-3.5 text-white">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-50" />
              <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-accent-400">
                <Bot className="h-5 w-5" />
              </span>
              <div className="relative flex-1">
                <div className="font-display text-sm font-bold leading-tight tracking-tight">
                  BANTAY-TB Assistant
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-wider text-slate-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-400" />
                  </span>
                  Online &middot; EN &middot; FIL &middot; BIS
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="relative grid h-8 w-8 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
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
                    "panel-in flex gap-2 " +
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
                /* Typing indicator — bot bubble with bouncing dots */
                <div className="panel-in flex justify-start gap-2">
                  <div className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                    <Bot className="h-3 w-3" />
                  </div>
                  <div
                    className="flex items-center rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5"
                    aria-label="Assistant is typing"
                  >
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                    </span>
                  </div>
                </div>
              )}
              {messages.length <= 1 && (
                <div className="pt-1">
                  <div className="mb-2 font-mono text-[0.625rem] font-semibold uppercase tracking-wider text-slate-400">
                    Try asking
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs text-slate-600 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-200 hover:bg-accent-50/50 hover:text-slate-900 hover:shadow-lift"
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
                  className="h-10 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-accent-300 focus:bg-white focus:ring-2 focus:ring-accent-100"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-accent-600 text-white shadow-soft transition-all duration-200 hover:bg-accent-700 enabled:hover:scale-105 disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
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
      </div>

      {/* FAB — accent pill; icon cross-fades between chat and close */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "fixed bottom-5 right-4 z-50 flex h-12 items-center gap-2 rounded-full px-4 text-white shadow-lift transition-all duration-300 hover:scale-105 active:scale-95 sm:right-6 " +
          (open ? "bg-brand-950 hover:bg-brand-900" : "bg-accent-600 hover:bg-accent-700")
        }
        aria-expanded={open}
        aria-label={open ? "Close chatbot" : "Open BANTAY-TB chatbot"}
      >
        <span className="relative h-5 w-5">
          <MessageCircle
            className={
              "absolute inset-0 h-5 w-5 transition-all duration-300 " +
              (open ? "-rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")
            }
          />
          <X
            className={
              "absolute inset-0 h-5 w-5 transition-all duration-300 " +
              (open ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0")
            }
          />
        </span>
        <span
          className={
            "hidden overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 sm:inline-block " +
            (open ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100")
          }
        >
          Ask BANTAY-TB
        </span>
      </button>
    </>
  );
}
