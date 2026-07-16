import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Heart,
  HeartPulse,
  Info,
  Languages,
  ShieldAlert,
  Stethoscope,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, MotionCard } from "../../components/ui";
import { cn } from "../../lib/utils";
import {
  CATEGORY_LABEL,
  DISEASE_LABEL,
  DISEASE_SOURCES,
  HEALTH_ARTICLES,
  SOURCES_HEADING,
  SOURCES_NOTE,
  type Category,
  type Disease,
} from "../../data/healthContent";
import { LOCALE_LABEL, type Locale } from "../../lib/i18n";
import heroImage from "../../assets/davao_city_midnight_blue_20260528_090346.png";

const DISEASES: Disease[] = [
  "tb",
  "pneumonia",
  "covid19",
  "influenza",
  "bronchitis",
  "copd",
  "asthma",
];
const CATEGORIES: Category[] = [
  "overview",
  "symptoms",
  "treatment",
  "prevention",
  "lifestyle",
];

const DISEASE_ICON: Record<Disease, LucideIcon> = {
  tb: Activity,
  pneumonia: Stethoscope,
  covid19: ShieldAlert,
  influenza: Thermometer,
  bronchitis: Waves,
  copd: HeartPulse,
  asthma: Wind,
};

/** ~200 words/min, always at least 1 minute. */
function readingMinutes(text: string): number {
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LearnPublic() {
  const [locale, setLocale] = useState<Locale>("en");
  const [disease, setDisease] = useState<Disease>("tb");
  const [category, setCategory] = useState<Category>("overview");
  // Sections the visitor has opened, per disease — powers the progress UI.
  const [visited, setVisited] = useState<Set<string>>(new Set());

  useEffect(() => {
    setVisited((v) => {
      const key = `${disease}:${category}`;
      if (v.has(key)) return v;
      const next = new Set(v);
      next.add(key);
      return next;
    });
  }, [disease, category]);

  const article = HEALTH_ARTICLES.find(
    (a) => a.disease === disease && a.locale === locale && a.category === category
  );

  const catIndex = CATEGORIES.indexOf(category);
  const prevCat = catIndex > 0 ? CATEGORIES[catIndex - 1] : null;
  const nextCat = catIndex < CATEGORIES.length - 1 ? CATEGORIES[catIndex + 1] : null;

  const visitedCount = useMemo(
    () => CATEGORIES.filter((c) => visited.has(`${disease}:${c}`)).length,
    [visited, disease]
  );

  return (
    <>
      {/* ─── Hero header — matches the landing surveillance styling ── */}
      <section className="relative overflow-hidden bg-brand-950">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <img
            src={heroImage}
            alt=""
            className="h-full w-full object-cover object-center opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-950/70 via-brand-950/50 to-brand-950" />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-[-40%] h-[26rem] w-[26rem] rounded-full bg-accent-500/10 blur-[100px]"
        />

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
                <Heart className="h-3.5 w-3.5 text-accent-400" />
                For patients &amp; families
              </div>
              <h1 className="font-display mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Health Education
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300">
                Plain-language guides on tuberculosis and other respiratory
                diseases — reviewed against WHO, DOH, and CDC references. Available
                in English, Filipino, and Bisaya.
              </p>
            </div>

            {/* Language — segmented pill, mirrors the navbar */}
            <div className="flex items-center gap-1 self-start rounded-full border border-white/15 bg-white/10 p-1 backdrop-blur-sm md:self-auto">
              <Languages className="ml-2 h-4 w-4 text-white/50" />
              {(Object.keys(LOCALE_LABEL) as Locale[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200",
                    locale === l
                      ? "bg-white text-brand-950 shadow-soft"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {LOCALE_LABEL[l]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Topic selector — icon chips ───────────────────────────── */}
      <section className="border-b border-brand-800 bg-brand-950">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Choose a topic
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
            {DISEASES.map((d) => {
              const Icon = DISEASE_ICON[d];
              const active = disease === d;
              return (
                <button
                  key={d}
                  onClick={() => setDisease(d)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-white text-brand-950 shadow-soft"
                      : "border border-white/15 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-accent-600" : "text-accent-400")} />
                  {DISEASE_LABEL[d][locale]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Content area ──────────────────────────────────────────── */}
      <div className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="grid gap-6 md:grid-cols-[240px_1fr]">
            {/* Sidebar — numbered course-style sections + progress */}
            <MotionCard className="h-fit overflow-hidden p-0 md:sticky md:top-20">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Sections
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-accent-500 transition-all duration-500"
                      style={{ width: `${(visitedCount / CATEGORIES.length) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-slate-500">
                    {visitedCount}/{CATEGORIES.length}
                  </span>
                </div>
              </div>
              <nav className="space-y-0.5 p-2">
                {CATEGORIES.map((c, i) => {
                  const active = category === c;
                  const seen = visited.has(`${disease}:${c}`);
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition",
                        active
                          ? "bg-brand-950 font-medium text-white shadow-soft"
                          : "text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                          active
                            ? "bg-white/15 text-white"
                            : seen
                              ? "bg-accent-100 text-accent-700"
                              : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {seen && !active ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {CATEGORY_LABEL[c][locale]}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </MotionCard>

            {/* Article */}
            <div key={`${disease}-${category}-${locale}`}>
              <MotionCard className="overflow-hidden p-0">
                {article ? (
                  <article>
                    <div className="p-6 sm:p-8">
                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info">{DISEASE_LABEL[disease][locale]}</Badge>
                        <Badge tone="default">{CATEGORY_LABEL[category][locale]}</Badge>
                        <span className="ml-auto flex items-center gap-3 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {readingMinutes(article.summary + " " + article.body_md)} min read
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Languages className="h-3.5 w-3.5" />
                            {LOCALE_LABEL[locale]}
                          </span>
                        </span>
                      </div>

                      <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                        {article.title}
                      </h2>

                      {/* Key takeaway — the summary as an educational callout */}
                      <div className="mt-5 flex gap-3 rounded-2xl border border-accent-200/70 bg-accent-50/60 p-4">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-600 text-white">
                          <Info className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-700">
                            Key takeaway
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-slate-700">
                            {article.summary}
                          </p>
                        </div>
                      </div>

                      <div className="prose prose-slate mt-6 max-w-none whitespace-pre-line text-[15px] leading-[1.85] text-slate-800">
                        {article.body_md}
                      </div>
                    </div>

                    {/* Section navigation — continue the course */}
                    <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2 sm:p-5">
                      {prevCat ? (
                        <button
                          type="button"
                          onClick={() => setCategory(prevCat)}
                          className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
                        >
                          <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
                          <span className="min-w-0">
                            <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                              Previous
                            </span>
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {CATEGORY_LABEL[prevCat][locale]}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <span aria-hidden className="hidden sm:block" />
                      )}
                      {nextCat && (
                        <button
                          type="button"
                          onClick={() => setCategory(nextCat)}
                          className="group flex items-center justify-end gap-3 rounded-xl border border-brand-900 bg-brand-950 px-4 py-3 text-right shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
                        >
                          <span className="min-w-0">
                            <span className="block font-mono text-[10px] uppercase tracking-wider text-brand-300">
                              Continue to
                            </span>
                            <span className="block truncate text-sm font-semibold text-white">
                              {CATEGORY_LABEL[nextCat][locale]}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-accent-400 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      )}
                    </div>

                    {/* References — linked, numbered cards */}
                    <section
                      aria-labelledby="sources-heading"
                      className="border-t border-slate-100 p-6 sm:p-8"
                    >
                      <h3
                        id="sources-heading"
                        className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-accent-600" />
                        {SOURCES_HEADING[locale]}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        {SOURCES_NOTE[locale]}
                      </p>
                      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                        {DISEASE_SOURCES[disease].map((s, idx) => (
                          <li key={s.url}>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-lift"
                            >
                              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 font-mono text-[10px] font-bold text-slate-500 transition-colors group-hover:bg-accent-100 group-hover:text-accent-700">
                                {idx + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold leading-snug text-slate-900 group-hover:text-brand-900">
                                  {s.title}
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {s.publisher} ({s.year})
                                </span>
                                <span className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-accent-700">
                                  {hostnameOf(s.url)}
                                  <ExternalLink className="h-3 w-3" aria-hidden />
                                </span>
                              </span>
                            </a>
                          </li>
                        ))}
                      </ol>
                    </section>
                  </article>
                ) : (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100">
                      <BookOpen className="h-6 w-6 text-slate-400" />
                    </span>
                    <p className="mt-4 text-sm font-semibold text-slate-700">
                      Article not available yet
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                      This combination of disease, section, and language is not yet
                      published. Try another section or language.
                    </p>
                  </div>
                )}
              </MotionCard>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
