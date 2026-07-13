import { useEffect, useRef, useState } from "react";
import { Bot, Database, Plus, Send, Trash2, User as UserIcon } from "lucide-react";
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
import barangays from "../../data/barangays.json";

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

// Roles that can access live surveillance data
const DATA_ROLES = new Set(["health_worker", "barangay_admin", "tb_coordinator", "system_admin"]);

export function Chatbot() {
  const { profile } = useAuth();
  const isPatient = profile?.role === "patient";
  const canAccessData = !isPatient && DATA_ROLES.has(profile?.role ?? "");

  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [history, setHistory] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  async function deleteSession(id: string) {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("chatbot_messages")
        .delete()
        .eq("session_id", id);
      if (error) throw error;
      setHistory((h) => h.filter((s) => s.id !== id));
      // If the deleted session is currently open, start fresh
      if (id === sessionId) {
        setSessionId(crypto.randomUUID());
        setMessages([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not delete session: ${msg}`);
    } finally {
      setDeletingId(null);
    }
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

  // Only staff roles fetch live surveillance data; patients never get case stats.
  async function fetchDataContext(text: string): Promise<string | null> {
    if (!canAccessData) return null;

    const lower = text.toLowerCase();
    const isDataQuery =
      /\b(how many|cases|count|total|stats|statistics|hotspot|recent|ilan|kaso|pila|data|infected|reported|area|barangay)\b/i.test(
        lower
      );
    if (!isDataQuery) return null;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const isoThirty = thirtyDaysAgo.toISOString();
    const now = new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Run each query independently — a permission error on one table
    // should not block the rest of the context from being built.
    const safeCount = async (
      query: PromiseLike<{ count: number | null }>
    ): Promise<number> => {
      try {
        const { count } = await query;
        return count ?? 0;
      } catch {
        return 0;
      }
    };

    const [totalCount, recentCount, hotspotCount] = await Promise.all([
      safeCount(
        supabase
          .from("cases")
          .select("*", { count: "exact", head: true })
          .eq("disease", "tb")
      ),
      safeCount(
        supabase
          .from("cases")
          .select("*", { count: "exact", head: true })
          .eq("disease", "tb")
          .gte("reported_at", isoThirty)
      ),
      safeCount(
        supabase.from("hotspots").select("*", { count: "exact", head: true })
      ),
    ]);

    const lines: string[] = [
      `LIVE DATA from BANTAY-TB database (as of ${now}):`,
      `- Davao City TB cases (all-time): ${totalCount}`,
      `- TB cases in the last 30 days: ${recentCount}`,
      `- Active hotspot clusters on record: ${hotspotCount}`,
    ];

    // Assigned-area stats for health_worker / barangay_admin
    if (profile?.barangay_psgc) {
      const bgyName =
        (barangays as { psgc: number; name: string }[]).find(
          (b) => b.psgc === profile.barangay_psgc
        )?.name ?? "your assigned area";
      const [areaTotal, areaRecent] = await Promise.all([
        safeCount(
          supabase
            .from("cases")
            .select("*", { count: "exact", head: true })
            .eq("disease", "tb")
            .eq("barangay_psgc", profile.barangay_psgc)
        ),
        safeCount(
          supabase
            .from("cases")
            .select("*", { count: "exact", head: true })
            .eq("disease", "tb")
            .eq("barangay_psgc", profile.barangay_psgc)
            .gte("reported_at", isoThirty)
        ),
      ]);
      lines.push(
        `- ${bgyName} (assigned area): ${areaTotal} total cases, ${areaRecent} in last 30 days`
      );
    }

    // If a specific barangay name appears in the query, fetch its stats too
    const mentionedBgy = (barangays as { psgc: number; name: string }[]).find(
      (b) => lower.includes(b.name.toLowerCase())
    );
    if (mentionedBgy && mentionedBgy.psgc !== profile?.barangay_psgc) {
      const [bgyTotal, bgyRecent] = await Promise.all([
        safeCount(
          supabase
            .from("cases")
            .select("*", { count: "exact", head: true })
            .eq("disease", "tb")
            .eq("barangay_psgc", mentionedBgy.psgc)
        ),
        safeCount(
          supabase
            .from("cases")
            .select("*", { count: "exact", head: true })
            .eq("disease", "tb")
            .eq("barangay_psgc", mentionedBgy.psgc)
            .gte("reported_at", isoThirty)
        ),
      ]);
      lines.push(
        `- ${mentionedBgy.name}: ${bgyTotal} total cases, ${bgyRecent} in last 30 days`
      );
    }

    return lines.join("\n");
  }

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
      const context = await fetchDataContext(text);
      const { data, error } = await supabase.functions.invoke("chatbot", {
        body: {
          session_id: sessionId,
          message: text,
          language,
          user_id: profile?.id,
          role: profile?.role ?? null,
          context: context ?? undefined,
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
      const fallback = localFallback(text, language, isPatient);
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

  // Quick-reply suggestions differ by role
  const quickReplies = isPatient
    ? [
        "What are the symptoms of TB?",
        "How long is TB treatment?",
        "What should I do if I miss a dose?",
        "Ano ang sintomas ng TB?",
        "Kumusta ang aking paggamot sa TB?",
      ]
    : [
        "How many TB cases right now?",
        "How many cases in my area?",
        "How many cases in Maa?",
        "Ano ang sintomas ng TB?",
        "Unsa ang tambal sa hubak?",
      ];

  return (
    <>
      <PageHeader
        title="Multilingual Chatbot"
        subtitle={
          isPatient
            ? "Your personal TB health support. Ask in English, Filipino, or Bisaya."
            : "Ask in English, Filipino (Tagalog), or Bisaya. Language is detected automatically."
        }
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
        {/* History panel */}
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
                <li key={s.id} className="group relative">
                  <button
                    onClick={() => loadSession(s.id)}
                    className={
                      "block w-full px-4 py-2 pr-9 text-left text-sm transition " +
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
                  {/* Delete button — appears on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }}
                    disabled={deletingId === s.id}
                    title="Delete this conversation"
                    className={
                      "absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition " +
                      "text-slate-300 opacity-0 group-hover:opacity-100 " +
                      "hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    }
                  >
                    {deletingId === s.id ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Chat panel */}
        <Card className="flex h-[560px] flex-col">
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.length === 0 && (
              <div className="space-y-3 text-sm text-slate-500">
                <p>
                  {isPatient
                    ? "How can I help you today? Ask about your TB care:"
                    : "Ask about TB health topics or live case data:"}
                </p>
                <ul className="space-y-1.5">
                  {quickReplies.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                        onClick={() => setDraft(q)}
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
                {canAccessData && (
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <Database className="h-3 w-3" />
                    Data queries pull live figures from the BANTAY-TB database.
                  </p>
                )}
              </div>
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
    "patient-default":
      "I'm here to support your TB care journey. I can answer questions about symptoms, treatment, adherence, and when to visit your DOTS center. (Edge Function fallback response.)",
  },
  tl: {
    "tb-symptoms":
      "Karaniwang sintomas ng TB: ubo nang 2+ linggo, ubong may dugo, sakit sa dibdib, pagbaba ng timbang, lagnat, pagpapawis sa gabi, pagkapagod. Magpa-screen sa DOTS Center.",
    "tb-treatment":
      "Ang karaniwang TB treatment ay 6 na buwan sa ilalim ng DOTS: 4 na antibiyotiko sa unang 2 buwan, tapos 2 antibiyotiko sa susunod na 4 na buwan. Kumpletuhin ang gamot.",
    default:
      "Maaari akong sumagot tungkol sa TB, pulmonya, COVID-19, at hika — sintomas, gamot, pag-iwas, at impormasyon ng DOTS Center.",
    "patient-default":
      "Nandito ako para suportahan ang iyong paggamot sa TB. Maaari kang magtanong tungkol sa sintomas, gamot, at kung kailan bisitahin ang DOTS Center.",
  },
  ceb: {
    "tb-symptoms":
      "Komon nga sintomas sa TB: ubo nga molabaw 2 ka semana, ubo nga adunay dugo, kasakit sa dughan, pagniwang, hilanat, paghigwaos sa gabii, kakapoy. Adto sa DOTS Center.",
    "tb-treatment":
      "Standard nga TB tambal kay 6 ka bulan sa DOTS: 4 ka antibiotic sulod sa 2 ka bulan, dayon 2 ka antibiotic sulod sa 4 ka bulan. Kompleto ang tambal.",
    default:
      "Makahatag ko og impormasyon bahin sa TB, pulmonya, COVID-19, ug hubak — sintomas, tambal, pag-likay, ug DOTS Center.",
    "patient-default":
      "Ania ako aron suportahan ang imong paggamot sa TB. Pwede kang mangutana bahin sa sintomas, tambal, ug kung kanus-a adtoon ang DOTS Center.",
  },
};

function localFallback(text: string, locale: Locale, patient: boolean): string {
  const lower = text.toLowerCase();
  const tbWords = ["tb", "tuberkulosis", "tuberculosis"];
  const isTb = tbWords.some((w) => lower.includes(w));
  if (isTb && /(symptom|sintoma)/.test(lower)) return FALLBACKS[locale]["tb-symptoms"];
  if (isTb && /(treat|gamot|tambal)/.test(lower))
    return FALLBACKS[locale]["tb-treatment"];
  return patient ? FALLBACKS[locale]["patient-default"] : FALLBACKS[locale].default;
}
