import { useEffect, useRef, useState } from "react";
import { Bot, Plus, Send, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Spinner,
  Textarea,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { detectLocale, LOCALE_LABEL, type Locale } from "../../lib/i18n";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  language: Locale | null;
  created_at: string;
}

interface Session {
  id: string;
  preview: string;
  created_at: string;
}

export function Chatbot() {
  const { profile } = useAuth();
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [history, setHistory] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadHistory() {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("chatbot_messages")
      .select("session_id, content, created_at")
      .eq("user_id", profile.id)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(40);
    const seen = new Set<string>();
    const sessions: Session[] = [];
    for (const r of data ?? []) {
      if (seen.has(r.session_id)) continue;
      seen.add(r.session_id);
      sessions.push({
        id: r.session_id,
        preview: r.content.slice(0, 60),
        created_at: r.created_at,
      });
    }
    setHistory(sessions);
  }

  async function loadSession(id: string) {
    setSessionId(id);
    const { data } = await supabase
      .from("chatbot_messages")
      .select("id, role, content, language, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true });
    setMessages(((data ?? []) as Message[]).filter((m) => m.role !== "system"));
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send() {
    if (!draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    const language = detectLocale(text);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      language,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);

    if (profile?.id) {
      await supabase.from("chatbot_messages").insert({
        id: userMsg.id,
        session_id: sessionId,
        user_id: profile.id,
        role: "user",
        content: text,
        language,
      });
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("chatbot", {
        body: {
          session_id: sessionId,
          message: text,
          language,
          user_id: profile?.id,
        },
      });
      if (error) throw error;
      const reply = (data as { reply: string; language: Locale })?.reply;
      const assistantLang =
        (data as { language?: Locale })?.language ?? language;
      if (reply) {
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply,
          language: assistantLang,
          created_at: new Date().toISOString(),
        };
        setMessages((m) => [...m, assistantMsg]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Local fallback so the UI is usable without the Edge Function deployed.
      const fallback = localFallback(text, language);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fallback,
          language,
          created_at: new Date().toISOString(),
        },
      ]);
      toast.message(`Edge Function unavailable — using local fallback. (${message})`);
    } finally {
      setSending(false);
      loadHistory();
    }
  }

  return (
    <>
      <PageHeader
        title="Multilingual Chatbot"
        subtitle="Ask in English, Filipino (Tagalog), or Bisaya. Language is detected automatically."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setSessionId(crypto.randomUUID());
              setMessages([]);
            }}
          >
            <Plus className="h-4 w-4" /> New chat
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="p-0">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            History
          </div>
          {history.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              No previous chats yet.
            </p>
          ) : (
            <ul className="max-h-[480px] overflow-y-auto">
              {history.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => loadSession(s.id)}
                    className={
                      "block w-full px-4 py-2 text-left text-sm transition " +
                      (s.id === sessionId
                        ? "bg-brand-50 text-brand-800"
                        : "text-slate-700 hover:bg-slate-50")
                    }
                  >
                    <div className="line-clamp-1 font-medium">{s.preview}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(s.created_at).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex h-[560px] flex-col">
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">
                Try: <em>"Ano ang sintomas ng TB?"</em>,{" "}
                <em>"Unsa ang tambal sa hubak?"</em>, or{" "}
                <em>"How long is TB treatment?"</em>
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  "flex gap-3 " +
                  (m.role === "user" ? "justify-end" : "justify-start")
                }
              >
                {m.role === "assistant" && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={
                    "max-w-[78%] rounded-lg px-3 py-2 text-sm " +
                    (m.role === "user"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-900")
                  }
                >
                  <div className="whitespace-pre-line">{m.content}</div>
                  {m.language && (
                    <div className="mt-1.5">
                      <Badge tone={m.role === "user" ? "default" : "info"}>
                        {LOCALE_LABEL[m.language]}
                      </Badge>
                    </div>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Spinner className="h-4 w-4" /> Thinking…
              </div>
            )}
          </div>
          <div className="border-t border-slate-200 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!sending) send();
              }}
              className="flex gap-2"
            >
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type in English, Filipino, or Bisaya…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!sending) send();
                  }
                }}
                className="min-h-[44px]"
              />
              <Button type="submit" disabled={sending || !draft.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </>
  );
}

const FALLBACKS: Record<Locale, Record<string, string>> = {
  en: {
    "tb-symptoms":
      "Common TB symptoms: cough lasting 2+ weeks, blood in sputum, chest pain, weight loss, fever, night sweats, fatigue. Visit a DOTS center for free screening.",
    "tb-treatment":
      "Standard drug-sensitive TB treatment is 6 months under DOTS supervision: 4 antibiotics for 2 months, then 2 antibiotics for 4 months. Always complete the full course.",
    default:
      "I can answer questions about TB, pneumonia, COVID-19, and asthma — symptoms, treatment, prevention, and DOTS center information. (Edge Function fallback response.)",
  },
  tl: {
    "tb-symptoms":
      "Karaniwang sintomas ng TB: ubo nang 2+ linggo, ubong may dugo, sakit sa dibdib, pagbaba ng timbang, lagnat, pagpapawis sa gabi, pagkapagod. Magpa-screen sa DOTS Center.",
    "tb-treatment":
      "Ang karaniwang TB treatment ay 6 na buwan sa ilalim ng DOTS: 4 na antibiyotiko sa unang 2 buwan, tapos 2 antibiyotiko sa susunod na 4 na buwan. Kumpletuhin ang gamot.",
    default:
      "Maaari akong sumagot tungkol sa TB, pulmonya, COVID-19, at hika — sintomas, gamot, pag-iwas, at impormasyon ng DOTS Center.",
  },
  ceb: {
    "tb-symptoms":
      "Komon nga sintomas sa TB: ubo nga molabaw 2 ka semana, ubo nga adunay dugo, kasakit sa dughan, pagniwang, hilanat, paghigwaos sa gabii, kakapoy. Adto sa DOTS Center.",
    "tb-treatment":
      "Standard nga TB tambal kay 6 ka bulan sa DOTS: 4 ka antibiotic sulod sa 2 ka bulan, dayon 2 ka antibiotic sulod sa 4 ka bulan. Kompleto ang tambal.",
    default:
      "Makahatag ko og impormasyon bahin sa TB, pulmonya, COVID-19, ug hubak — sintomas, tambal, pag-likay, ug DOTS Center.",
  },
};

function localFallback(text: string, locale: Locale): string {
  const lower = text.toLowerCase();
  const tbWords = ["tb", "tuberkulosis", "tuberculosis"];
  const isTb = tbWords.some((w) => lower.includes(w));
  if (isTb && /(symptom|sintoma)/.test(lower)) return FALLBACKS[locale]["tb-symptoms"];
  if (isTb && /(treat|gamot|tambal)/.test(lower))
    return FALLBACKS[locale]["tb-treatment"];
  return FALLBACKS[locale].default;
}
