import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Database,
  History,
  MessagesSquare,
  Plus,
  Send,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  PageHeader,
  Spinner,
  Textarea,
} from "../../components/ui";
import { PatientSheet } from "../../components/PatientSheet";
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

/** A patient's own treatment picture, built from their adherence rows. */
interface TreatmentSummary {
  medication: string;
  dose: string;
  timesPerDay: number;
  startDate: string;
  endDate: string;
  taken: number;
  missed: number;
  late: number;
  lastTakenAt: string | null;
  nextDoseAt: string | null;
}

// Roles that can access live surveillance data
const DATA_ROLES = new Set(["health_worker", "barangay_admin", "tb_coordinator", "system_admin"]);

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

export function Chatbot() {
  const { profile } = useAuth();
  const isPatient = profile?.role === "patient";
  const canAccessData = !isPatient && DATA_ROLES.has(profile?.role ?? "");
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? null;

  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [history, setHistory] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // History panel visibility — remembered across visits. Patients start
  // chat-first (hidden); staff start with it open.
  const [showHistory, setShowHistory] = useState<boolean>(() => {
    const saved = localStorage.getItem("bantay-chatbot-history");
    if (saved !== null) return saved === "1";
    return profile?.role !== "patient";
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("bantay-chatbot-history", showHistory ? "1" : "0");
  }, [showHistory]);

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

    // Barangays mentioned in the query — match full names and distinctive
    // name parts so "cases in matina" finds Matina Crossing / Aplaya / Pangi.
    const mentioned = (barangays as { psgc: number; name: string }[])
      .filter((b) => {
        const name = b.name.toLowerCase();
        if (lower.includes(name)) return true;
        return name
          .split(/\s+/)
          .some((part) => part.length >= 4 && lower.includes(part));
      })
      .slice(0, 3);

    for (const bgy of mentioned) {
      const [bgyTotal, bgyRecent] = await Promise.all([
        safeCount(
          supabase
            .from("cases")
            .select("*", { count: "exact", head: true })
            .eq("disease", "tb")
            .eq("barangay_psgc", bgy.psgc)
        ),
        safeCount(
          supabase
            .from("cases")
            .select("*", { count: "exact", head: true })
            .eq("disease", "tb")
            .eq("barangay_psgc", bgy.psgc)
            .gte("reported_at", isoThirty)
        ),
      ]);
      lines.push(
        `- ${bgy.name}: ${bgyTotal} total TB cases, ${bgyRecent} in the last 30 days`
      );

      // Case details for this barangay — classification breakdown plus the
      // most recent reports (age/sex/classification only, never PII).
      try {
        const { data: rows } = await supabase
          .from("cases")
          .select("age, sex, tb_classification, reported_at")
          .eq("disease", "tb")
          .eq("barangay_psgc", bgy.psgc)
          .order("reported_at", { ascending: false })
          .limit(200);
        if (rows && rows.length > 0) {
          const byClass = new Map<string, number>();
          for (const r of rows) {
            const k = r.tb_classification ?? "unclassified";
            byClass.set(k, (byClass.get(k) ?? 0) + 1);
          }
          lines.push(
            `- ${bgy.name} by classification (latest ${rows.length}): ` +
              [...byClass.entries()].map(([k, n]) => `${k}: ${n}`).join(", ")
          );
          const recentList = rows.slice(0, 5).map((r) => {
            const d = new Date(r.reported_at).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const sex = (r.sex ?? "?").toString().charAt(0).toUpperCase();
            return `${r.age ?? "?"}/${sex} ${r.tb_classification ?? "unclassified"} (${d})`;
          });
          lines.push(`- ${bgy.name} most recent reports: ${recentList.join("; ")}`);
        }
      } catch {
        /* detail lines are best-effort */
      }

      // Active hotspot cluster in this barangay, if any
      try {
        const { data: hs } = await supabase
          .from("hotspots")
          .select("severity, case_count, detected_at")
          .eq("barangay_psgc", bgy.psgc)
          .order("detected_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (hs) {
          lines.push(
            `- ${bgy.name} hotspot: ${hs.severity} severity, ${hs.case_count} clustered cases (detected ${new Date(hs.detected_at).toLocaleDateString("en-PH")})`
          );
        } else {
          lines.push(`- ${bgy.name}: no hotspot cluster on record`);
        }
      } catch {
        /* best-effort */
      }
    }

    return lines.join("\n");
  }

  // ── Patient self-service data ─────────────────────────────────────────
  // Patients asking about their own care ("Kumusta ang aking paggamot?",
  // "When was my last dose?") get their real treatment record pulled in as
  // context. RLS restricts every query to the patient's own rows.
  function isSelfCareQuery(text: string): boolean {
    return /\b(treatment|paggamot|pagtambal|tambal|gamot|medicine|medication|medisina|dose|dosis|inom|took|taken?|missed|nakalimutan|nalimtan|schedule|iskedyul|progress|adherence|kumusta|kamusta|reminder)\b/i.test(
      text
    );
  }

  async function fetchTreatmentSummary(): Promise<TreatmentSummary | null> {
    if (!profile?.id) return null;
    try {
      const { data: schedule } = await supabase
        .from("adherence_schedules")
        .select("medication, dose, times_per_day, start_date, end_date")
        .eq("patient_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!schedule) return null;

      const countByStatus = async (status: "taken" | "missed" | "late") => {
        const { count } = await supabase
          .from("adherence_logs")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", profile.id)
          .eq("status", status);
        return count ?? 0;
      };

      const [taken, missed, late, lastTaken, nextDose] = await Promise.all([
        countByStatus("taken"),
        countByStatus("missed"),
        countByStatus("late"),
        supabase
          .from("adherence_logs")
          .select("taken_at")
          .eq("patient_id", profile.id)
          .eq("status", "taken")
          .not("taken_at", "is", null)
          .order("taken_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("adherence_logs")
          .select("scheduled_at")
          .eq("patient_id", profile.id)
          .eq("status", "scheduled")
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        medication: schedule.medication,
        dose: schedule.dose,
        timesPerDay: schedule.times_per_day,
        startDate: schedule.start_date,
        endDate: schedule.end_date,
        taken,
        missed,
        late,
        lastTakenAt: lastTaken.data?.taken_at ?? null,
        nextDoseAt: nextDose.data?.scheduled_at ?? null,
      };
    } catch {
      return null;
    }
  }

  // Accepts optional text so quick-reply cards can send in one tap
  // instead of just filling the input.
  async function send(textArg?: string) {
    const text = (textArg ?? draft).trim();
    if (!text) return;
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
    // Kept outside the try so the catch can build a data-aware fallback
    // reply even when the Edge Function is unreachable.
    let patientSummary: TreatmentSummary | null = null;
    try {
      let context = await fetchDataContext(text);
      if (isPatient && isSelfCareQuery(text)) {
        patientSummary = await fetchTreatmentSummary();
        if (patientSummary) context = buildPatientContext(patientSummary);
      }
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
      // If we already fetched the patient's treatment record, answer from
      // it directly — real data beats a canned reply.
      const fallback = patientSummary
        ? treatmentFallbackReply(patientSummary, language)
        : localFallback(text, language, isPatient);
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
      // Patients get the fallback answer seamlessly — the technical toast
      // is only useful to staff.
      if (!isPatient) {
        toast.message(
          `Edge Function unavailable — using local fallback. (${message})`
        );
      }
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
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
      <PageHeader
        title={isPatient ? "Health Assistant" : "Multilingual Chatbot"}
        subtitle={
          isPatient
            ? "I'm here to help with your TB care — ask me anything in English, Filipino, or Bisaya."
            : "Ask in English, Filipino (Tagalog), or Bisaya. Language is detected automatically."
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowHistory((v) => !v)}
              aria-pressed={showHistory}
            >
              <History className="h-4 w-4" />
              {showHistory ? "Hide history" : "Show history"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSessionId(crypto.randomUUID());
                setMessages([]);
              }}
            >
              <Plus className="h-4 w-4" /> New chat
            </Button>
          </>
        }
      />

      <div
        className={
          "grid min-h-0 flex-1 gap-4 " +
          (showHistory && !isPatient
            ? "grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1"
            : "grid-cols-1 grid-rows-[minmax(0,1fr)]")
        }
      >
        {/* History panel — staff keep a docked side panel; patients open it as
            a bottom sheet (rendered after the grid) so chat stays full-width. */}
        {showHistory && !isPatient && (
        <Card className="panel-in flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
              <History className="h-3.5 w-3.5 text-brand-600" />
              History
            </div>
            {history.length > 0 && (
              <span className="font-mono text-[10px] tabular-nums text-slate-500">
                {history.length}
              </span>
            )}
          </div>
          <HistoryList
            history={history}
            sessionId={sessionId}
            deletingId={deletingId}
            onSelect={loadSession}
            onDelete={deleteSession}
          />
        </Card>
        )}

        {/* Chat panel */}
        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.length === 0 &&
              (isPatient ? (
                /* Patient welcome — warm, personal, one-tap suggestions. */
                <div className="flex h-full flex-col items-center justify-center gap-5 px-4 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-soft">
                    <Bot className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="font-display text-xl font-bold tracking-tight text-slate-900">
                      Hi{firstName ? ` ${firstName}` : ""}! 👋
                    </p>
                    <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">
                      I&apos;m your TB care assistant. Ask me about symptoms,
                      treatment, or your medicines — in English, Filipino, or
                      Bisaya.
                    </p>
                  </div>
                  <div className="grid w-full max-w-md gap-2 sm:grid-cols-2">
                    {quickReplies.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => send(q)}
                        disabled={sending}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-soft transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-slate-500">
                  <p>Ask about TB health topics or live case data:</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {quickReplies.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                          onClick={() => setDraft(q)}
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {canAccessData && (
                    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                      <Database className="h-3 w-3 text-accent-600" />
                      Data queries pull live figures from the BANTAY-TB
                      database.
                    </p>
                  )}
                </div>
              ))}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  "panel-in flex gap-3 " +
                  (m.role === "user" ? "justify-end" : "justify-start")
                }
              >
                {m.role === "assistant" && (
                  <div
                    className={
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white " +
                      (isPatient
                        ? "bg-gradient-to-br from-brand-500 to-accent-500"
                        : "bg-brand-950")
                    }
                  >
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={
                    "max-w-[78%] px-3.5 py-2.5 text-sm shadow-soft " +
                    (m.role === "user"
                      ? "rounded-2xl rounded-br-md bg-brand-600 text-white"
                      : "rounded-2xl rounded-bl-md border border-slate-200/80 bg-white text-slate-900")
                  }
                >
                  <div className="whitespace-pre-line leading-relaxed">
                    {m.content}
                  </div>
                  {m.language && !isPatient && (
                    <div
                      className={
                        "mt-1.5 font-mono text-[9px] font-semibold uppercase tracking-wider " +
                        (m.role === "user" ? "text-brand-200" : "text-slate-400")
                      }
                    >
                      {LOCALE_LABEL[m.language]}
                    </div>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600">
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {sending && (
              /* Typing indicator — three bouncing dots in an assistant
                 bubble, friendlier than a spinner. */
              <div className="panel-in flex gap-3">
                <div
                  className={
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white " +
                    (isPatient
                      ? "bg-gradient-to-br from-brand-500 to-accent-500"
                      : "bg-brand-950")
                  }
                >
                  <Bot className="h-4 w-4" />
                </div>
                <div
                  className="flex items-center rounded-2xl rounded-bl-md border border-slate-200/80 bg-white px-4 py-3 shadow-soft"
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
          </div>
          <div className="border-t border-slate-200 bg-slate-50/60 p-3">
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
                placeholder={
                  isPatient
                    ? "Ask me anything about your TB care…"
                    : "Type in English, Filipino, or Bisaya…"
                }
                aria-label="Message"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!sending) send();
                  }
                }}
                className="min-h-[44px]"
              />
              <Button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>

      {/* Patient chat history — bottom sheet (mobile) / centered dialog. */}
      {isPatient && (
        <PatientSheet
          open={showHistory}
          onClose={() => setShowHistory(false)}
          accentClass="border-sky-200"
          iconClass="bg-sky-100 text-sky-700"
          icon={<History className="h-6 w-6" />}
          title="Your chats"
          subtitle={
            history.length > 0
              ? `${history.length} saved conversation${history.length === 1 ? "" : "s"}`
              : "Your past questions live here"
          }
        >
          <HistoryList
            history={history}
            sessionId={sessionId}
            deletingId={deletingId}
            alwaysShowDelete
            onSelect={(id) => {
              loadSession(id);
              setShowHistory(false);
            }}
            onDelete={deleteSession}
          />
        </PatientSheet>
      )}
    </div>
  );
}

/** Chat history list — shared by the staff side panel and the patient sheet. */
function HistoryList({
  history,
  sessionId,
  deletingId,
  onSelect,
  onDelete,
  alwaysShowDelete = false,
}: {
  history: Session[];
  sessionId: string;
  deletingId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  alwaysShowDelete?: boolean;
}) {
  if (history.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <MessagesSquare className="mx-auto h-6 w-6 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">No previous chats yet.</p>
      </div>
    );
  }
  return (
    <ul className="max-h-56 flex-1 divide-y divide-slate-100 overflow-y-auto lg:max-h-none">
      {history.map((s) => {
        const active = s.id === sessionId;
        return (
          <li key={s.id} className="group relative">
            <button
              onClick={() => onSelect(s.id)}
              className={
                "block w-full border-l-2 px-4 py-3 pr-11 text-left text-sm transition " +
                (active
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-transparent text-slate-700 hover:bg-slate-50")
              }
            >
              <div className="line-clamp-1 font-medium">{s.preview}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                {new Date(s.created_at).toLocaleString()}
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
              }}
              disabled={deletingId === s.id}
              title="Delete this conversation"
              aria-label="Delete this conversation"
              className={
                "absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition " +
                (alwaysShowDelete
                  ? "text-slate-400 "
                  : "text-slate-300 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 ") +
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
        );
      })}
    </ul>
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

const fmtDoseTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

/** Context block sent to the Edge Function for the AI to answer from. */
function buildPatientContext(s: TreatmentSummary): string {
  const done = s.taken + s.missed + s.late;
  const rate = done === 0 ? null : Math.round((s.taken / done) * 100);
  return [
    "PATIENT'S OWN TREATMENT RECORD from the BANTAY-TB database (this data belongs to the patient asking — share it with them clearly and kindly):",
    `- Medication: ${s.medication} ${s.dose}, ${s.timesPerDay}x per day`,
    `- Treatment period: ${s.startDate} to ${s.endDate}`,
    `- Doses taken: ${s.taken} · missed: ${s.missed} · late: ${s.late}` +
      (rate !== null ? ` (adherence ${rate}%)` : ""),
    `- Last dose taken: ${fmtDoseTime(s.lastTakenAt) ?? "no dose recorded yet"}`,
    `- Next scheduled dose: ${fmtDoseTime(s.nextDoseAt) ?? "none upcoming on record"}`,
  ].join("\n");
}

/** Offline answer built straight from the patient's data, per language. */
function treatmentFallbackReply(s: TreatmentSummary, locale: Locale): string {
  const last = fmtDoseTime(s.lastTakenAt);
  const next = fmtDoseTime(s.nextDoseAt);
  const lines: string[] = [];
  if (locale === "tl") {
    lines.push("Narito ang iyong treatment record mula sa BANTAY-TB:", "");
    lines.push(
      `💊 ${s.medication} ${s.dose} — ${s.timesPerDay}x kada araw (hanggang ${s.endDate})`,
      `✅ Nainom: ${s.taken} · ❌ Nakalimutan: ${s.missed} · ⏰ Nahuli: ${s.late}`
    );
    lines.push(last ? `Huling dose: ${last}` : "Wala pang naitalang dose.");
    if (next) lines.push(`Susunod na dose: ${next}`);
    lines.push(
      "",
      "Ipagpatuloy mo lang! Kung may nakalimutang dose, inumin ang susunod sa tamang oras at sabihin sa iyong health worker."
    );
  } else if (locale === "ceb") {
    lines.push("Ania ang imong treatment record gikan sa BANTAY-TB:", "");
    lines.push(
      `💊 ${s.medication} ${s.dose} — ${s.timesPerDay}x kada adlaw (hangtod ${s.endDate})`,
      `✅ Nainom: ${s.taken} · ❌ Nakalimtan: ${s.missed} · ⏰ Naulahi: ${s.late}`
    );
    lines.push(last ? `Kataposang dose: ${last}` : "Wala pay narekord nga dose.");
    if (next) lines.push(`Sunod nga dose: ${next}`);
    lines.push(
      "",
      "Padayon lang! Kung adunay nakalimtan nga dose, inoma ang sunod sa saktong oras ug isulti sa imong health worker."
    );
  } else {
    lines.push("Here is your treatment record from BANTAY-TB:", "");
    lines.push(
      `💊 ${s.medication} ${s.dose} — ${s.timesPerDay}x a day (until ${s.endDate})`,
      `✅ Taken: ${s.taken} · ❌ Missed: ${s.missed} · ⏰ Late: ${s.late}`
    );
    lines.push(last ? `Last dose taken: ${last}` : "No dose has been recorded yet.");
    if (next) lines.push(`Next scheduled dose: ${next}`);
    lines.push(
      "",
      "Keep it up! If you missed a dose, take the next one on schedule and let your health worker know."
    );
  }
  return lines.join("\n");
}

function localFallback(text: string, locale: Locale, patient: boolean): string {
  const lower = text.toLowerCase();
  const tbWords = ["tb", "tuberkulosis", "tuberculosis"];
  const isTb = tbWords.some((w) => lower.includes(w));
  if (isTb && /(symptom|sintoma)/.test(lower)) return FALLBACKS[locale]["tb-symptoms"];
  if (isTb && /(treat|gamot|tambal)/.test(lower))
    return FALLBACKS[locale]["tb-treatment"];
  return patient ? FALLBACKS[locale]["patient-default"] : FALLBACKS[locale].default;
}
