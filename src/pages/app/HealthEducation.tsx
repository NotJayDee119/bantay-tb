import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  HeartPulse,
  Languages,
  PartyPopper,
  ShieldAlert,
  Sparkles,
  Star,
  Stethoscope,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

// Pastel chip palette per topic — playful but still 4.5:1 on text.
const DISEASE_STYLE: Record<Disease, { idle: string; active: string }> = {
  tb: {
    idle: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
    active: "border-sky-500 bg-sky-500 text-white",
  },
  pneumonia: {
    idle: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
    active: "border-violet-500 bg-violet-500 text-white",
  },
  covid19: {
    idle: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
    active: "border-rose-500 bg-rose-500 text-white",
  },
  influenza: {
    idle: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
    active: "border-amber-500 bg-amber-500 text-white",
  },
  bronchitis: {
    idle: "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100",
    active: "border-teal-500 bg-teal-500 text-white",
  },
  copd: {
    idle: "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
    active: "border-orange-500 bg-orange-500 text-white",
  },
  asthma: {
    idle: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    active: "border-emerald-500 bg-emerald-500 text-white",
  },
};

// Rotating step colors for the section list.
const STEP_ACTIVE = [
  "bg-sky-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-emerald-500",
  "bg-violet-500",
];

/**
 * Patient-facing education — a friendly, nursery-style reading experience
 * over the same reviewed health content as the public Learn page.
 */
export function HealthEducation() {
  const [locale, setLocale] = useState<Locale>("en");
  const [disease, setDisease] = useState<Disease>("tb");
  const [category, setCategory] = useState<Category>("overview");
  // Sections the patient has opened, per disease — powers the star progress.
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
  const allDone = visitedCount === CATEGORIES.length;

  return (
    <div className="space-y-6">
      {/* ── Hero — warm and welcoming ────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-sky-200 bg-gradient-to-br from-sky-100 via-amber-50 to-pink-100 p-6 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-pink-200/60 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-14 left-1/4 h-40 w-40 rounded-full bg-sky-200/60 blur-2xl"
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-sky-700 shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Learn &amp; grow strong
            </span>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Health Education
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-700 sm:text-base">
              Easy, friendly guides about TB and other sicknesses — read them in
              English, Filipino, or Bisaya.
            </p>
          </div>

          {/* Language — chunky segmented pill */}
          <div className="flex items-center gap-1 self-start rounded-full border-2 border-white/80 bg-white/80 p-1 shadow-soft backdrop-blur-sm">
            <Languages className="ml-2 h-4 w-4 text-slate-400" />
            {(Object.keys(LOCALE_LABEL) as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200",
                  locale === l
                    ? "bg-sky-500 text-white shadow-soft"
                    : "text-slate-600 hover:bg-sky-100 hover:text-sky-700"
                )}
              >
                {LOCALE_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Topic picker — colorful chips ────────────────────────────── */}
      <section>
        <p className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-slate-700">
          <Heart className="h-4 w-4 text-pink-500" />
          Pick a topic
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
          {DISEASES.map((d) => {
            const Icon = DISEASE_ICON[d];
            const active = disease === d;
            const style = DISEASE_STYLE[d];
            return (
              <button
                key={d}
                onClick={() => setDisease(d)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold transition-all duration-200 active:scale-95",
                  active ? style.active + " shadow-soft" : style.idle
                )}
              >
                <Icon className="h-4 w-4" />
                {DISEASE_LABEL[d][locale]}
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* ── Steps sidebar — numbered like a storybook ──────────────── */}
        <div className="h-fit overflow-hidden rounded-3xl border-2 border-amber-200 bg-white shadow-soft md:sticky md:top-20">
          <div className="border-b-2 border-amber-100 bg-amber-50/70 px-4 py-3">
            <p className="text-sm font-extrabold text-slate-800">My steps</p>
            <div
              className="mt-1.5 flex gap-0.5"
              role="img"
              aria-label={`${visitedCount} of ${CATEGORIES.length} steps read`}
            >
              {CATEGORIES.map((c) => (
                <Star
                  key={c}
                  aria-hidden
                  className={cn(
                    "h-4 w-4",
                    visited.has(`${disease}:${c}`)
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300"
                  )}
                />
              ))}
            </div>
          </div>
          <nav className="space-y-1 p-2.5">
            {CATEGORIES.map((c, i) => {
              const active = category === c;
              const seen = visited.has(`${disease}:${c}`);
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-bold transition active:scale-[0.98]",
                    active
                      ? "border-transparent text-white shadow-soft " + STEP_ACTIVE[i]
                      : "border-transparent text-slate-700 hover:border-amber-200 hover:bg-amber-50"
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-xs font-extrabold",
                      active
                        ? "bg-white/25 text-white"
                        : seen
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {seen && !active ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {CATEGORY_LABEL[c][locale]}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Article ────────────────────────────────────────────────── */}
        <div key={`${disease}-${category}-${locale}`}>
          <div className="overflow-hidden rounded-3xl border-2 border-sky-200 bg-white shadow-soft">
            {article ? (
              <article>
                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-bold",
                        DISEASE_STYLE[disease].idle
                      )}
                    >
                      {DISEASE_LABEL[disease][locale]}
                    </span>
                    <span className="inline-flex items-center rounded-full border-2 border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                      {CATEGORY_LABEL[category][locale]}
                    </span>
                  </div>

                  <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                    {article.title}
                  </h2>

                  {/* Key takeaway — "Remember this!" */}
                  <div className="mt-5 flex gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-amber-400 text-white">
                      <Star className="h-5 w-5 fill-white" />
                    </span>
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
                        Remember this!
                      </p>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">
                        {article.summary}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 max-w-none whitespace-pre-line text-[15px] leading-[1.9] text-slate-800 sm:text-base">
                    {article.body_md}
                  </div>

                  {allDone && (
                    <div className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white">
                        <PartyPopper className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-display text-sm font-extrabold text-emerald-800">
                          You read all {CATEGORIES.length} steps — amazing!
                        </p>
                        <p className="text-xs font-medium text-emerald-700">
                          Pick another topic above to keep learning.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step navigation — big friendly buttons */}
                <div className="grid gap-3 border-t-2 border-sky-100 bg-sky-50/50 p-4 sm:grid-cols-2 sm:p-5">
                  {prevCat ? (
                    <button
                      type="button"
                      onClick={() => setCategory(prevCat)}
                      className="group flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lift active:scale-[0.98]"
                    >
                      <ChevronLeft className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                          Go back
                        </span>
                        <span className="block truncate text-sm font-extrabold text-slate-900">
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
                      className="group flex items-center justify-end gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-500 px-4 py-3 text-right shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-lift active:scale-[0.98]"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] font-bold uppercase tracking-wide text-emerald-100">
                          Next step
                        </span>
                        <span className="block truncate text-sm font-extrabold text-white">
                          {CATEGORY_LABEL[nextCat][locale]}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-white transition-transform group-hover:translate-x-0.5" />
                    </button>
                  )}
                </div>

                {/* References — for parents & guardians */}
                <section
                  aria-labelledby="sources-heading"
                  className="border-t-2 border-sky-100 p-6 sm:p-8"
                >
                  <h3
                    id="sources-heading"
                    className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-sky-600" />
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
                          className="group flex h-full items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lift"
                        >
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-extrabold text-slate-500 transition-colors group-hover:bg-sky-100 group-hover:text-sky-700">
                            {idx + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold leading-snug text-slate-900">
                              {s.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {s.publisher} ({s.year})
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
                <span className="grid h-14 w-14 place-items-center rounded-3xl bg-sky-100">
                  <BookOpen className="h-7 w-7 text-sky-500" />
                </span>
                <p className="mt-4 text-sm font-extrabold text-slate-700">
                  This page isn't ready yet
                </p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Try another step or another language while we finish it.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
