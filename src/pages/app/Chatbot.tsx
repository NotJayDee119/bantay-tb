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
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useAreaScope } from "../../hooks/useAreaScope";
import { useGeolocation } from "../../hooks/useGeolocation";
import { detectLocale, LOCALE_LABEL, type Locale } from "../../lib/i18n";
import { findMentionedBarangays } from "../../lib/barangayMention";
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

/**
 * "My area" in the three languages the assistant speaks.
 *
 * Without this, "how many cases in my area" was answered from the account's
 * *assigned* barangay — right for a BHW sitting in their own barangay, wrong
 * for anyone asking while standing somewhere else, and answerable at all only
 * for accounts that have an assignment. With a GPS fix the question means what
 * it says: here, where I am now.
 */
const HERE_PATTERN =
  /\b(my area|my barangay|my place|near me|around me|nearby|here|dito|dito sa amin|sa amin|aming lugar|aking lugar|aming barangay|malapit sa akin|diri|dinhi|akong lugar|among lugar|among barangay|duol nako|sa amoa|ari sa amoa)\b/i;

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

export function Chatbot() {
  const { profile } = useAuth();
  const scope = useAreaScope();
  const canAccessData = DATA_ROLES.has(profile?.role ?? "");

  // Opt-in, button-triggered only — see useGeolocation.
  const geo = useGeolocation();

  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [history, setHistory] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // History panel visibility — remembered across visits, open by default.
  const [showHistory, setShowHistory] = useState<boolean>(() => {
    const saved = localStorage.getItem("bantay-chatbot-history");
    return saved === null ? true : saved === "1";
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

  // Only staff roles fetch live surveillance data.
  async function fetchDataContext(text: string): Promise<string | null> {
    if (!canAccessData) return null;

    const lower = text.toLowerCase();
    const isDataQuery =
      /\b(how many|cases|count|total|stats|statistics|hotspot|recent|ilan|kaso|pila|data|infected|reported|area|barangay)\b/i.test(
        lower
      ) || findMentionedBarangays(text).length > 0;
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

    // For area-scoped staff every count above is already filtered by RLS to
    // their barangay, so labelling them "Davao City" would make the assistant
    // report their area's numbers as citywide totals.
    const coverage = scope.scoped
      ? `${scope.name ?? "the assigned area"} only`
      : "Davao City";
    const lines: string[] = [
      `LIVE DATA from BANTAY-TB database (as of ${now}):`,
      `- Data coverage: ${coverage}`,
      `- TB cases (all-time) in ${coverage}: ${totalCount}`,
      `- TB cases in the last 30 days: ${recentCount}`,
      `- Barangays currently flagged as TB hotspots (Getis-Ord Gi*): ${hotspotCount}`,
    ];
    if (scope.scoped) {
      lines.push(
        "- NOTE: this user is a community-level operator and may only access " +
          `${scope.name ?? "their assigned area"}. You have NO data for any ` +
          "other barangay. If asked about one, say you can only report on " +
          "their assigned area — never state or imply another barangay has " +
          "zero cases."
      );
    } else {
      // A coordinator's area is the whole city. Without saying so, "how many
      // cases in my area" read as an unanswerable question about some smaller
      // patch, and the assistant refused while holding the citywide numbers.
      const roleName =
        profile?.role === "system_admin" ? "system administrator" : "city TB coordinator";
      lines.push(
        `- NOTE: this user is the ${roleName} with citywide access — their area ` +
          "is ALL of Davao City. When they ask about \"my area\", answer with " +
          "the Davao City figures above, addressed to them as their area. Do " +
          "not say their area's figures are unavailable, and do not refer them " +
          "to a DOTS center."
      );
    }

    // Assigned-area stats for health_worker / barangay_admin. Read from the
    // scope, not the profile: a coordinator's profile can still carry a
    // barangay, and labelling it "assigned area" shrinks their citywide view.
    const assignedPsgc = scope.psgc;
    if (assignedPsgc !== null || scope.facilityId) {
      const bgyName =
        (barangays as { psgc: number; name: string }[]).find(
          (b) => b.psgc === assignedPsgc
        )?.name ?? "your assigned area";
      // Residence and place of registration are separate axes, and reporting
      // only the first is what made a Mintal worker read "0 cases" while five
      // were registered at their own facility. Both are stated, each named.
      //
      // The registration half asks about THIS user's facility, not every
      // clinic standing in their barangay: a neighbouring clinic's register is
      // somebody else's, and a health worker posted outside their assigned
      // barangay would otherwise have their own register counted as zero.
      const ownFacility = scope.facilityId
        ? ((
            await supabase
              .from("dots_centers")
              .select("name")
              .eq("id", scope.facilityId)
              .maybeSingle()
          ).data?.name ?? "your DOTS facility")
        : null;

      const [areaTotal, areaRecent, clinicTotal] = await Promise.all([
        assignedPsgc !== null
          ? safeCount(
              supabase
                .from("cases")
                .select("*", { count: "exact", head: true })
                .eq("disease", "tb")
                .eq("barangay_psgc", assignedPsgc)
            )
          : Promise.resolve(0),
        assignedPsgc !== null
          ? safeCount(
              supabase
                .from("cases")
                .select("*", { count: "exact", head: true })
                .eq("disease", "tb")
                .eq("barangay_psgc", assignedPsgc)
                .gte("reported_at", isoThirty)
            )
          : Promise.resolve(0),
        scope.facilityId
          ? safeCount(
              supabase
                .from("cases")
                .select("*", { count: "exact", head: true })
                .eq("disease", "tb")
                .eq("facility_id", scope.facilityId)
            )
          : Promise.resolve(0),
      ]);
      if (assignedPsgc !== null) {
        lines.push(
          `- ${bgyName} (assigned area), cases whose patients LIVE there: ${areaTotal} total, ${areaRecent} in last 30 days`
        );
      }
      if (ownFacility) {
        lines.push(
          `- ${ownFacility} (this user's own DOTS facility), cases REGISTERED there: ${clinicTotal} (patients may live in other barangays)`
        );
      }
    }

    // Barangays named in the query ("Maa" finds Ma-a, "matina" finds Matina
    // Crossing / Aplaya / Pangi). Coordinators read every one; area-scoped
    // staff only their own — another barangay's count would come back 0 from
    // RLS and the assistant would report it as "no cases there".
    const named = findMentionedBarangays(text);
    const mentioned = named.filter((b) => !scope.scoped || b.psgc === scope.psgc);
    const outside = named.filter((b) => scope.scoped && b.psgc !== scope.psgc);
    if (outside.length > 0) {
      const own = scope.name ?? "your assigned area";
      lines.push(
        `- ${outside.map((b) => b.name).join(", ")}: outside your assigned area. ` +
          `This account can only view case data for ${own}. ` +
          "(Do not state, estimate, or imply any figure for these barangays.)"
      );
    }

    // "How many cases in my area" answered from where the user actually is.
    // Only when they have shared a fix — no location, no location answer.
    const here = geo.area;
    if (here && HERE_PATTERN.test(lower)) {
      const readable = !scope.scoped || scope.psgc === here.psgc;
      if (!readable) {
        // Their GPS says one barangay, their permissions cover another. The
        // count would come back 0 and read as "no TB here", which is the
        // opposite of true — name the limit instead.
        lines.push(
          `- NOTE: the user is physically in ${here.name}, which is OUTSIDE their assigned area. You have NO data for ${here.name}. Say you can only report on their assigned area — never state or imply ${here.name} has zero cases.`
        );
      } else if (!mentioned.some((b) => b.psgc === here.psgc)) {
        mentioned.unshift({ psgc: here.psgc, name: here.name });
        const where = `${here.name}${
          here.confident ? "" : " (approximate — nearest barangay to their GPS fix)"
        }`;
        lines.push(
          scope.scoped
            ? `- The user is physically in ${where}. Read "my area" / "dinhi" / "dito sa amin" as ${here.name}.`
            : // Citywide: "my area" stays the city; where they stand is extra.
              `- The user is currently physically in ${where}. Give its figures too, after the citywide ones.`
        );
      }
    }

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

      // Active hotspot (area of concentrated cases) in this barangay, if any
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
            `- ${bgy.name} is a TB hotspot: TB is high in ${bgy.name} and in the barangays around it, more than chance would explain (${hs.severity === "urgent" ? "very strong pattern at 99% confidence: if cases were spread randomly, a pattern this strong would happen less than 1 time in 100" : "strong pattern at 95% confidence: if cases were spread randomly, a pattern this strong would happen less than 1 time in 20"}). ${hs.case_count} TB patients are recorded as living in ${bgy.name}; a barangay can be a hotspot with few or no cases of its own when the barangays next to it have many. Hotspot since ${new Date(hs.detected_at).toLocaleDateString("en-PH")}. Explain this in plain words — do not quote z-scores or p-values.`
          );
        } else {
          lines.push(`- ${bgy.name}: no hotspot on record`);
        }
      } catch {
        /* best-effort */
      }
    }

    return lines.join("\n");
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
      const { error } = await supabase.from("chatbot_messages").insert({
        id: userMsg.id,
        session_id: sessionId,
        user_id: profile.id,
        role: "user",
        content: text,
        language,
      });
      if (error) console.error("chatbot: could not save question", error);
    }

    // Every reply is kept with the conversation, including the fallbacks
    // shown when the AI is unreachable — those used to live only on screen,
    // so reopening the chat showed questions with no answers. The Edge
    // Function saves the replies it produces under this id and reports
    // `saved`; anything it did not save is written here instead.
    const replyId = crypto.randomUUID();
    const saveReply = async (content: string, lang: Locale) => {
      if (!profile?.id) return;
      const { error } = await supabase.from("chatbot_messages").insert({
        id: replyId,
        session_id: sessionId,
        user_id: profile.id,
        role: "assistant",
        content,
        language: lang,
      });
      if (error) console.error("chatbot: could not save reply", error);
    };

    setSending(true);
    // Hoisted so the catch can answer from the live DB data we already
    // fetched, even when the Edge Function / AI is unreachable.
    let statsContext: string | null = null;
    try {
      const context = await fetchDataContext(text);
      statsContext = context;
      const { data, error } = await supabase.functions.invoke("chatbot", {
        body: {
          session_id: sessionId,
          message: text,
          language,
          user_id: profile?.id,
          reply_id: replyId,
          role: profile?.role ?? null,
          context: context ?? undefined,
        },
      });
      if (error) throw error;
      const d = data as { reply?: string; language?: Locale; saved?: boolean };
      const reply = d?.reply;
      const assistantLang = d?.language ?? language;
      if (reply) {
        // Only an explicit false: an older deployment of the function sends
        // no flag but has already saved the reply.
        if (d.saved === false) await saveReply(reply, assistantLang);
        const assistantMsg: Message = {
          id: replyId,
          role: "assistant",
          content: reply,
          language: assistantLang,
          created_at: new Date().toISOString(),
        };
        setMessages((m) => [...m, assistantMsg]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const fallback = statsContext
        ? statsFallbackReply(statsContext, language)
        : localFallback(text, language);
      await saveReply(fallback, language);
      setMessages((m) => [
        ...m,
        {
          id: replyId,
          role: "assistant",
          content: fallback,
          language,
          created_at: new Date().toISOString(),
        },
      ]);
      toast.message(
        `Edge Function unavailable — using local fallback. (${message})`
      );
    } finally {
      setSending(false);
      loadHistory();
    }
  }

  const quickReplies = [
    "How many TB cases right now?",
    "How many cases in my area?",
    "How many cases in Maa?",
    "Ano ang sintomas ng TB?",
    "Unsa ang tambal sa hubak?",
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Multilingual Chatbot"
        subtitle="Ask in English, Filipino (Tagalog), or Cebuano. Language is detected automatically."
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
          (showHistory
            ? "grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1"
            : "grid-cols-1 grid-rows-[minmax(0,1fr)]")
        }
      >
        {/* History panel — docked beside the chat. */}
        {showHistory && (
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
            {messages.length === 0 && (
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
              )}
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
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-950 text-white"
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
                  {m.language && (
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
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-950 text-white"
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
                placeholder="Type in English, Filipino, or Cebuano…"
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

    </div>
  );
}

/** Chat history list for the side panel. */
function HistoryList({
  history,
  sessionId,
  deletingId,
  onSelect,
  onDelete,
}: {
  history: Session[];
  sessionId: string;
  deletingId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
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
                "absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-300 opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100 " +
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

/**
 * Offline answer built straight from the live database context we already
 * fetched (case counts, hotspots, per-barangay figures). Used when the AI
 * Edge Function is unreachable so staff still get real numbers instead of a
 * canned line. `context` is the string produced by fetchDataContext().
 */
function statsFallbackReply(context: string, locale: Locale): string {
  // Drop the machine-facing header and NOTE lines and the AI-only
  // instructions in parentheses; keep the "- ..." data lines.
  const dataLines = context
    .split("\n")
    .filter((l) => l.trim().startsWith("-") && !l.trim().startsWith("- NOTE"))
    .map((l) => l.replace(/ \(Do not [^)]*\)$/, ""));
  if (dataLines.length === 0) return localFallback("", locale);

  const header: Record<Locale, string> = {
    en: "Here are the latest figures from the BANTAY-TB database:",
    tl: "Narito ang pinakabagong datos mula sa BANTAY-TB database:",
    ceb: "Ania ang pinakabag-ong datos gikan sa BANTAY-TB database:",
  };
  const footer: Record<Locale, string> = {
    en: "(Live database figures — the AI assistant is temporarily unavailable.)",
    tl: "(Live na datos mula sa database — pansamantalang hindi available ang AI assistant.)",
    ceb: "(Live nga datos gikan sa database — temporaryong dili available ang AI assistant.)",
  };
  return [header[locale], "", ...dataLines, "", footer[locale]].join("\n");
}

function localFallback(text: string, locale: Locale): string {
  const lower = text.toLowerCase();
  const tbWords = ["tb", "tuberkulosis", "tuberculosis"];
  const isTb = tbWords.some((w) => lower.includes(w));
  if (isTb && /(symptom|sintoma)/.test(lower)) return FALLBACKS[locale]["tb-symptoms"];
  if (isTb && /(treat|gamot|tambal)/.test(lower))
    return FALLBACKS[locale]["tb-treatment"];
  return FALLBACKS[locale].default;
}
