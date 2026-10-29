import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  BookOpen,
  ChevronRight,
  Info,
  MessageCircle,
  RotateCcw,
  ShieldPlus,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { detectLocale, LOCALE_LABEL, type Locale } from "../lib/i18n";
import { SYSTEM_KNOWLEDGE } from "../data/systemKnowledge";

// Platform-guide sources point at the public page that covers them; every
// other source is a Health Education article, opened by title on /learn.
const SYSTEM_DOC_ROUTE: Record<string, string> = {
  about: "/about",
  "public-features": "/about",
  "patient-accounts": "/dots-locator",
  staff: "/about",
  "free-care": "/dots-locator",
};

function sourceHref(title: string): string {
  const doc = SYSTEM_KNOWLEDGE.find((d) => d.title === title);
  if (doc) return SYSTEM_DOC_ROUTE[doc.slug.replace(/-(en|tl|ceb)$/, "")] ?? "/about";
  return `/learn?article=${encodeURIComponent(title)}`;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  language: Locale | null;
  /** Knowledge-base article titles the answer was grounded in. */
  sources?: string[];
  /** True while the reply is still being typed out on screen. */
  typing?: boolean;
}

// Kept short enough to fit one line at the narrowest panel width — a wrapped
// placeholder made the one-row composer overflow.
const PLACEHOLDER = "Ask a question…";

const GREETING: Record<Locale, string> = {
  en: "Welcome to BANTAY-TB. You may ask about tuberculosis and other respiratory diseases, or about how to use this platform, in English, Filipino, or Cebuano.",
  tl: "Maligayang pagdating sa BANTAY-TB. Maaari po kayong magtanong tungkol sa tuberkulosis at iba pang sakit sa baga, o kung paano gamitin ang platapormang ito, sa English, Filipino, o Cebuano.",
  ceb: "Maayong pag-abot sa BANTAY-TB. Mahimo kamong mangutana bahin sa tuberkulosis ug uban pang sakit sa baga, o unsaon paggamit niini nga plataporma, sa English, Filipino, o Cebuano.",
};

// What the knowledge base covers — the same whitelist the chatbot function
// enforces, so every chip leads to an answer rather than a refusal.
const TOPICS = [
  "Tuberculosis",
  "Pneumonia",
  "COVID-19",
  "Influenza",
  "Bronchitis",
  "COPD",
  "Asthma",
  "Paragonimiasis",
];

const SUGGESTIONS = [
  "How does BANTAY-TB work?",
  "Ano ang sintomas ng TB?",
  "Unsa ang tambal sa hubak?",
];

// Curated "how does this website/system work?" answer. System questions are
// normally answered from the knowledge base by the chatbot function; this is
// what they get instead when that service is offline.
const ABOUT_SYSTEM: Record<Locale, string> = {
  en: [
    "BANTAY-TB is Davao City's tuberculosis surveillance and care platform. Here's what you can do:",
    "",
    "🗺️ DOTS Locator — find the nearest free TB treatment center with directions.",
    "📚 Health Education — learn about TB symptoms, treatment, and prevention.",
    "💬 This chatbot — ask health questions in English, Filipino, or Cebuano.",
    "",
    "Patients don’t need an account — your nurse or doctor records your treatment at the DOTS center. Health workers and TB coordinators sign in to report cases, view the GIS surveillance map, and receive hotspot alerts.",
    "",
    "TB screening and DOTS treatment are free!",
  ].join("\n"),
  tl: [
    "Ang BANTAY-TB ay plataporma ng Davao City para sa pagbabantay at pangangalaga sa TB. Narito ang magagawa mo:",
    "",
    "🗺️ DOTS Locator — hanapin ang pinakamalapit na libreng TB treatment center na may direksyon.",
    "📚 Health Education — alamin ang sintomas, paggamot, at pag-iwas sa TB.",
    "💬 Ang chatbot na ito — magtanong sa English, Filipino, o Cebuano.",
    "",
    "Hindi kailangan ng account ang pasyente — ang nars o doktor ang nagtatala ng iyong paggamot sa DOTS center. Ang mga health worker at TB coordinator ay nag-sign in para mag-ulat ng kaso at makita ang surveillance map.",
    "",
    "Libre ang TB screening at DOTS treatment!",
  ].join("\n"),
  ceb: [
    "Ang BANTAY-TB mao ang plataporma sa Davao City alang sa pagbantay ug pag-atiman sa TB. Ania ang imong mahimo:",
    "",
    "🗺️ DOTS Locator — pangitaa ang pinaka-duol nga libre nga TB treatment center nga adunay direksyon.",
    "📚 Health Education — hibaloi ang sintomas, tambal, ug paglikay sa TB.",
    "💬 Kini nga chatbot — pangutana sa English, Filipino, o Cebuano.",
    "",
    "Dili kinahanglan og account ang pasyente — ang nars o doktor ang mo-rekord sa imong pagtambal sa DOTS center. Ang mga health worker ug TB coordinator mo-sign in aron mag-report og kaso ug makita ang surveillance map.",
    "",
    "Libre ang TB screening ug DOTS treatment!",
  ].join("\n"),
};

function isSystemQuery(text: string): boolean {
  return /\b(bantay[\s-]?tb|this (website|site|app|system|platform)|the (website|site|app|system|platform)|how (does|do) (this|it|the)|paano (gamitin|gumagana)|unsaon (paggamit|paggana)|sign ?in|log ?in|register|account|features?|dots locator)\b/i.test(
    text
  );
}

const FALLBACK: Record<Locale, string> = {
  en: "I can help with TB, pneumonia, COVID-19, influenza, bronchitis, COPD, asthma, and paragonimiasis. For diagnosis please visit your nearest DOTS Center. (Local fallback — chatbot service is offline.)",
  tl: "Maaari kitang tulungan tungkol sa TB, pulmonya, COVID-19, trangkaso, bronchitis, COPD, hika, at paragonimiasis. Para sa diagnosis, bumisita sa pinakamalapit na DOTS Center. (Lokal na fallback — offline ang chatbot service.)",
  ceb: "Makatabang ko bahin sa TB, pulmonya, COVID-19, trangkaso, bronchitis, COPD, hubak, ug paragonimiasis. Para sa diagnosis adto sa pinaka-suod nga DOTS Center. (Local fallback — offline ang chatbot service.)",
};

function greetingMessage(): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: GREETING.en,
    language: "en",
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// ─── Reply rendering ─────────────────────────────────────────────────────────

/** `**bold**` → <strong>; everything else stays plain text. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}

const LIST_ITEM = /^\s*(?:[-•*]|\d+[.)])\s+/;

/** Paragraphs plus bulleted / numbered lists — the shapes the model and the
 *  curated answers actually produce. */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={blocks.length}
        className={
          "space-y-1 pl-5 marker:text-slate-400 " +
          (list.ordered ? "list-decimal" : "list-disc")
        }
      >
        {list.items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </Tag>
    );
    list = null;
  };
  for (const line of text.split("\n")) {
    if (LIST_ITEM.test(line)) {
      const ordered = /^\s*\d/.test(line);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push(line.replace(LIST_ITEM, ""));
      continue;
    }
    flush();
    if (line.trim()) {
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

/** Types a reply out over ~1.5s regardless of length, then hands over to the
 *  formatted version. Instant under reduced motion. */
function TypedReply({
  text,
  animate,
  onTick,
  onDone,
}: {
  text: string;
  animate: boolean;
  onTick: () => void;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  // Latest callbacks without restarting the animation on every render.
  const cb = useRef({ onTick, onDone });
  cb.current = { onTick, onDone };

  useEffect(() => {
    if (!animate) return;
    if (prefersReducedMotion()) {
      setShown(text.length);
      cb.current.onDone();
      return;
    }
    const step = Math.max(2, Math.ceil(text.length / 90));
    let i = 0;
    let raf = 0;
    const tick = () => {
      i = Math.min(text.length, i + step);
      setShown(i);
      cb.current.onTick();
      if (i < text.length) raf = requestAnimationFrame(tick);
      else cb.current.onDone();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, animate]);

  return shown >= text.length ? (
    <RichText text={text} />
  ) : (
    <p className="typing-caret whitespace-pre-line">{text.slice(0, shown)}</p>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function AssistantAvatar({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={
        "grid flex-shrink-0 place-items-center rounded-lg bg-brand-950 text-accent-400 " +
        (size === "md" ? "h-9 w-9" : "h-7 w-7")
      }
    >
      <ShieldPlus className={size === "md" ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} />
    </span>
  );
}

function TypingIndicator() {
  return (
    <div
      className="panel-in flex items-end gap-2"
      role="status"
      aria-label="BANTAY-TB is typing"
    >
      <AssistantAvatar />
      <div className="flex items-center rounded-2xl rounded-bl-md border border-slate-200/80 bg-white px-3.5 py-3.5 shadow-soft">
        <span className="flex items-center gap-1" aria-hidden>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </span>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PublicChatbotFab() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>(() => [greetingMessage()]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  const revealing = messages.some((m) => m.typing);
  const busy = sending || revealing;
  const isFresh = messages.length <= 1;

  // Escape closes the chat, as it does every other surface on the site, and
  // hands focus back to the button — otherwise it stays on a control that just
  // went invisible and the next Tab starts from nowhere.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      fabRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Opening the chat puts the cursor in the composer once the panel has
  // finished scaling in.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 250);
    return () => window.clearTimeout(t);
  }, [open]);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior,
    });
  }

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages.length, sending, open]);

  function resizeInput() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    // Scrollbar only once the composer has hit its max height.
    el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
  }

  function resetConversation() {
    setMessages([greetingMessage()]);
    setSessionId(crypto.randomUUID());
    setDraft("");
    requestAnimationFrame(() => {
      resizeInput();
      inputRef.current?.focus();
    });
  }

  function pushAssistant(m: Omit<Message, "id" | "role">) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", typing: true, ...m },
    ]);
  }

  function finishTyping(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, typing: false } : m))
    );
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setDraft("");
    requestAnimationFrame(resizeInput);
    const language = detectLocale(trimmed);
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", content: trimmed, language },
    ]);

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
      const d = data as { reply?: string; language?: Locale; sources?: string[] };
      pushAssistant({
        content: d?.reply ?? FALLBACK[language],
        language: d?.language ?? language,
        sources: d?.sources ?? [],
      });
    } catch {
      pushAssistant({
        content: isSystemQuery(trimmed)
          ? ABOUT_SYSTEM[language]
          : FALLBACK[language],
        language,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Chat window — stays mounted so open/close can animate */}
      <div
        data-open={open}
        className="chat-panel fixed bottom-24 right-4 z-50 flex h-[min(620px,calc(100dvh-8rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 sm:right-6"
        role="dialog"
        aria-label="BANTAY-TB assistant"
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="relative flex items-center gap-3 overflow-hidden bg-brand-950 px-4 py-3.5 text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid opacity-60" />
          <span className="relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.08] text-accent-400">
            <ShieldPlus className="h-5 w-5" />
          </span>
          <div className="relative min-w-0 flex-1">
            <h2 className="font-display text-[0.9375rem] font-semibold leading-tight tracking-tight">
              BANTAY-TB Assistant
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-400" />
              </span>
              <span aria-live="polite">{busy ? "Typing…" : "Online"}</span>
              <span aria-hidden className="text-slate-600">·</span>
              <span className="truncate">English, Filipino, Cebuano</span>
            </p>
          </div>
          {!isFresh && (
            <button
              type="button"
              onClick={resetConversation}
              disabled={busy}
              className="relative grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-40"
              aria-label="Start a new conversation"
              title="New conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="relative grid h-8 w-8 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            aria-label="Close chatbot"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages. `data-lenis-prevent` hands the wheel back to this
            list: the site-wide smooth scroller in PublicLayout otherwise
            takes it first, so wheeling over a long answer scrolled the
            page behind the chat and left the answer where it was.
            `overscroll-contain` stops it chaining out at either end. */}
        <div
          ref={scrollRef}
          data-lenis-prevent
          aria-busy={busy}
          className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-5"
        >
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="panel-in flex justify-end">
                <div className="max-w-[82%] whitespace-pre-line rounded-2xl rounded-br-md bg-brand-950 px-3.5 py-2.5 text-sm leading-relaxed text-white">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="panel-in flex items-start gap-2">
                <AssistantAvatar />
                <div className="min-w-0 max-w-[85%]">
                  <div className="rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-700 shadow-soft">
                    <TypedReply
                      text={m.content}
                      animate={!!m.typing}
                      onTick={() => scrollToBottom("auto")}
                      onDone={() => finishTyping(m.id)}
                    />
                  </div>
                  {!m.typing && m.sources && m.sources.length > 0 && (
                    <div className="panel-in mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="flex items-center gap-1 font-mono text-[0.625rem] font-medium uppercase tracking-wider text-slate-400">
                        <BookOpen className="h-3 w-3" aria-hidden />
                        Sources
                      </span>
                      {m.sources.map((s) => (
                        <Link
                          key={s}
                          to={sourceHref(s)}
                          onClick={() => setOpen(false)}
                          title={s}
                          className="max-w-full truncate rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.6875rem] text-slate-500 underline-offset-2 transition-colors hover:border-brand-300 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          {s}
                        </Link>
                      ))}
                    </div>
                  )}
                  {m.language && !m.typing && (
                    <div className="mt-1.5 font-mono text-[0.625rem] uppercase tracking-wider text-slate-400">
                      BANTAY-TB · {LOCALE_LABEL[m.language]}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {sending && <TypingIndicator />}

          {isFresh && (
            <div className="panel-in space-y-4 pl-9">
              <div>
                <div className="mb-2 font-mono text-[0.625rem] font-medium uppercase tracking-wider text-slate-400">
                  Topics I can help with
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TOPICS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => send(`What is ${t}?`)}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors duration-150 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 font-mono text-[0.625rem] font-medium uppercase tracking-wider text-slate-400">
                  Try asking
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className={
                        "group flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[0.8125rem] text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900 focus-visible:bg-slate-50 focus-visible:outline-none " +
                        (i > 0 ? "border-t border-slate-100" : "")
                      }
                    >
                      {s}
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition-colors group-hover:text-accent-600" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-slate-200 bg-white p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 pl-3.5 transition focus-within:border-accent-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-accent-100"
          >
            <label htmlFor="public-chat-input" className="sr-only">
              Message BANTAY-TB
            </label>
            <textarea
              id="public-chat-input"
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                resizeInput();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder={PLACEHOLDER}
              className="max-h-[120px] min-h-[36px] flex-1 resize-none overflow-y-hidden bg-transparent py-2 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-accent-600 text-white transition-colors duration-150 hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-1 disabled:bg-slate-200 disabled:text-slate-400"
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-2 flex items-start gap-1.5 px-1 text-[0.6875rem] leading-snug text-slate-400">
            <Info className="mt-px h-3 w-3 flex-shrink-0" aria-hidden />
            For information only — not a medical diagnosis. Screening and
            treatment are free at DOTS Centers.
          </p>
        </div>
      </div>

      {/* FAB — accent pill; icon cross-fades between chat and close */}
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "fixed bottom-5 right-4 z-50 flex h-12 items-center gap-2 rounded-full px-4 text-white shadow-lift transition-colors duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2 sm:right-6 " +
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
