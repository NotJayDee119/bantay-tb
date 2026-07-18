import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  Languages,
  PartyPopper,
  Pill,
  Salad,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Thermometer,
  Waves,
  Wind,
  X,
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

// Each learning step gets its own icon + soft color so the card grid reads
// like a friendly set of chapters rather than a plain list.
const CATEGORY_ICON: Record<Category, LucideIcon> = {
  overview: BookOpen,
  symptoms: Thermometer,
  treatment: Pill,
  prevention: ShieldCheck,
  lifestyle: Salad,
};

const CATEGORY_STYLE: Record<
  Category,
  { tint: string; ring: string; badge: string; dot: string }
> = {
  overview: {
    tint: "bg-sky-50",
    ring: "border-sky-200 hover:border-sky-400",
    badge: "bg-sky-100 text-sky-700",
    dot: "bg-sky-500",
  },
  symptoms: {
    tint: "bg-amber-50",
    ring: "border-amber-200 hover:border-amber-400",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  treatment: {
    tint: "bg-pink-50",
    ring: "border-pink-200 hover:border-pink-400",
    badge: "bg-pink-100 text-pink-700",
    dot: "bg-pink-500",
  },
  prevention: {
    tint: "bg-emerald-50",
    ring: "border-emerald-200 hover:border-emerald-400",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  lifestyle: {
    tint: "bg-violet-50",
    ring: "border-violet-200 hover:border-violet-400",
    badge: "bg-violet-100 text-violet-700",
    dot: "bg-violet-500",
  },
};

const CATEGORY_HINT: Record<Category, Record<Locale, string>> = {
  overview: { en: "What it is", tl: "Ano ito", ceb: "Unsa kini" },
  symptoms: { en: "How it feels", tl: "Mga pakiramdam", ceb: "Mga bati" },
  treatment: { en: "Getting better", tl: "Paggaling", ceb: "Pag-ayo" },
  prevention: { en: "Stay safe", tl: "Manatiling ligtas", ceb: "Magpabilin luwas" },
  lifestyle: { en: "Live healthy", tl: "Mabuhay nang malusog", ceb: "Himsog nga kinabuhi" },
};

const TAP_HINT: Record<Locale, string> = {
  en: "Tap to read",
  tl: "Pindutin para basahin",
  ceb: "I-tap aron basahon",
};

/**
 * Patient-facing education — a mobile-first, tap-to-open reading experience.
 * Each disease shows five friendly "chapter" cards; tapping one opens a
 * bottom-sheet modal (on phones) / centered dialog (on wider screens) with the
 * full reviewed article, references, and step-to-step navigation.
 */
export function HealthEducation() {
  const [locale, setLocale] = useState<Locale>("en");
  const [disease, setDisease] = useState<Disease>("tb");
  // The step whose detail modal is open — null means the card grid is showing.
  const [openCategory, setOpenCategory] = useState<Category | null>(null);
  // Sections the patient has opened, per disease — powers the star progress.
  const [visited, setVisited] = useState<Set<string>>(new Set());

  const openStep = (c: Category) => {
    setOpenCategory(c);
    setVisited((v) => {
      const key = `${disease}:${c}`;
      if (v.has(key)) return v;
      const next = new Set(v);
      next.add(key);
      return next;
    });
  };

  const visitedCount = useMemo(
    () => CATEGORIES.filter((c) => visited.has(`${disease}:${c}`)).length,
    [visited, disease]
  );
  const allDone = visitedCount === CATEGORIES.length;

  return (
    <div className="space-y-6">
      {/* ── Hero — warm and welcoming ────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-sky-200 bg-gradient-to-br from-sky-100 via-amber-50 to-pink-100 p-5 sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-pink-200/60 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-14 left-1/4 h-40 w-40 rounded-full bg-sky-200/60 blur-2xl"
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-sky-700 shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Learn &amp; grow strong
            </span>
            <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Health Education
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-700 sm:text-base">
              Easy, friendly guides about TB and other sicknesses — tap a card to
              read in English, Filipino, or Bisaya.
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
          <Sparkles className="h-4 w-4 text-pink-500" />
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

      {/* ── Progress banner — stars per disease ──────────────────────── */}
      <section
        className={cn(
          "flex items-center gap-3 rounded-3xl border-2 p-4 transition-colors",
          allDone
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50/70"
        )}
      >
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white",
            allDone ? "bg-emerald-500" : "bg-amber-400"
          )}
        >
          {allDone ? (
            <PartyPopper className="h-5 w-5" />
          ) : (
            <Star className="h-5 w-5 fill-white" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-slate-800">
            {allDone
              ? `You read all ${CATEGORIES.length} steps — amazing!`
              : `${visitedCount} of ${CATEGORIES.length} steps read`}
          </p>
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
      </section>

      {/* ── Chapter cards — tap to open the detail modal ─────────────── */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c, i) => {
            const Icon = CATEGORY_ICON[c];
            const style = CATEGORY_STYLE[c];
            const seen = visited.has(`${disease}:${c}`);
            const hasArticle = HEALTH_ARTICLES.some(
              (a) => a.disease === disease && a.locale === locale && a.category === c
            );
            return (
              <button
                key={c}
                type="button"
                onClick={() => openStep(c)}
                className={cn(
                  "group relative flex h-full flex-col items-start gap-3 rounded-3xl border-2 bg-white p-4 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]",
                  style.ring
                )}
              >
                {seen && (
                  <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check className="h-4 w-4" />
                  </span>
                )}
                <span
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-2xl transition-transform duration-200 group-hover:scale-105",
                    style.tint
                  )}
                >
                  <Icon
                    className={cn(
                      "h-6 w-6",
                      seen ? "text-slate-500" : "text-slate-700"
                    )}
                  />
                </span>
                <div className="min-w-0">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
                      style.badge
                    )}
                  >
                    <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-white/70 text-[9px] text-slate-700">
                      {i + 1}
                    </span>
                    {CATEGORY_HINT[c][locale]}
                  </span>
                  <p className="mt-2 font-display text-sm font-extrabold leading-snug text-slate-900">
                    {CATEGORY_LABEL[c][locale]}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-400">
                    {hasArticle ? (
                      <>
                        {TAP_HINT[locale]}
                        <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </>
                    ) : (
                      "Coming soon"
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Detail modal ─────────────────────────────────────────────── */}
      {openCategory && (
        <ArticleModal
          disease={disease}
          category={openCategory}
          locale={locale}
          onClose={() => setOpenCategory(null)}
          onNavigate={openStep}
        />
      )}
    </div>
  );
}

/* ── Detail modal: bottom sheet on phones, centered dialog on desktop ─── */
function ArticleModal({
  disease,
  category,
  locale,
  onClose,
  onNavigate,
}: {
  disease: Disease;
  category: Category;
  locale: Locale;
  onClose: () => void;
  onNavigate: (c: Category) => void;
}) {
  const article = HEALTH_ARTICLES.find(
    (a) => a.disease === disease && a.locale === locale && a.category === category
  );
  const style = CATEGORY_STYLE[category];
  const Icon = CATEGORY_ICON[category];

  const catIndex = CATEGORIES.indexOf(category);
  const prevCat = catIndex > 0 ? CATEGORIES[catIndex - 1] : null;
  const nextCat =
    catIndex < CATEGORIES.length - 1 ? CATEGORIES[catIndex + 1] : null;

  // Lock body scroll + wire Escape while the sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="he-modal-title"
    >
      <div
        aria-hidden
        className="he-backdrop-in absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="he-sheet-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border-2 border-b-0 border-sky-200 bg-white shadow-lift sm:max-h-[88vh] sm:max-w-lg sm:rounded-3xl sm:border-b-2">
        {/* Grab handle (mobile affordance) */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Sticky header */}
        <div className="flex items-start gap-3 border-b-2 border-sky-100 px-5 py-4">
          <span
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
              style.tint
            )}
          >
            <Icon className="h-6 w-6 text-slate-700" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 text-[11px] font-bold",
                  DISEASE_STYLE[disease].idle
                )}
              >
                {DISEASE_LABEL[disease][locale]}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide",
                  style.badge
                )}
              >
                {CATEGORY_LABEL[category][locale]}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {article ? (
            <>
              <h2
                id="he-modal-title"
                className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl"
              >
                {article.title}
              </h2>

              {/* Key takeaway */}
              <div className="mt-4 flex gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
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

              <div className="mt-5 whitespace-pre-line text-[15px] leading-[1.9] text-slate-800">
                {article.body_md}
              </div>

              {/* References — for parents & guardians */}
              <section
                aria-labelledby="he-sources-heading"
                className="mt-6 border-t-2 border-sky-100 pt-5"
              >
                <h3
                  id="he-sources-heading"
                  className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500"
                >
                  <BookOpen className="h-3.5 w-3.5 text-sky-600" />
                  {SOURCES_HEADING[locale]}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {SOURCES_NOTE[locale]}
                </p>
                <ol className="mt-4 grid gap-2">
                  {DISEASE_SOURCES[disease].map((s, idx) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3.5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lift"
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
            </>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
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

        {/* Sticky footer — step navigation */}
        <div className="grid grid-cols-2 gap-2.5 border-t-2 border-sky-100 bg-sky-50/60 p-3.5">
          {prevCat ? (
            <button
              type="button"
              onClick={() => onNavigate(prevCat)}
              className="group flex items-center gap-2.5 rounded-2xl border-2 border-slate-200 bg-white px-3.5 py-2.5 text-left transition-all duration-200 hover:border-sky-300 active:scale-[0.98]"
            >
              <ChevronLeft className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Back
                </span>
                <span className="block truncate text-xs font-extrabold text-slate-900">
                  {CATEGORY_LABEL[prevCat][locale]}
                </span>
              </span>
            </button>
          ) : (
            <span aria-hidden />
          )}
          {nextCat ? (
            <button
              type="button"
              onClick={() => onNavigate(nextCat)}
              className="group flex items-center justify-end gap-2.5 rounded-2xl border-2 border-emerald-500 bg-emerald-500 px-3.5 py-2.5 text-right transition-all duration-200 hover:bg-emerald-600 active:scale-[0.98]"
            >
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-100">
                  Next
                </span>
                <span className="block truncate text-xs font-extrabold text-white">
                  {CATEGORY_LABEL[nextCat][locale]}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-white transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500 bg-emerald-500 px-3.5 py-2.5 text-xs font-extrabold text-white transition-all duration-200 hover:bg-emerald-600 active:scale-[0.98]"
            >
              <Check className="h-4 w-4" />
              Done
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
