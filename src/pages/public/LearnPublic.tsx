import { useState } from "react";
import { BookOpen, ExternalLink, Heart, Languages } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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

export function LearnPublic() {
  const [locale, setLocale] = useState<Locale>("en");
  const [disease, setDisease] = useState<Disease>("tb");
  const [category, setCategory] = useState<Category>("overview");

  const article = HEALTH_ARTICLES.find(
    (a) => a.disease === disease && a.locale === locale && a.category === category
  );

  return (
    <>
      {/* ─── Hero Header ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/85 via-slate-900/75 to-brand-900/85" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                <Heart className="h-4 w-4" />
                For patients &amp; families
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Health Education
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-200">
                Plain-language guides on tuberculosis and other respiratory
                diseases. Available in English, Filipino, and Bisaya.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 p-1 backdrop-blur-sm"
            >
              <Languages className="ml-2 h-4 w-4 text-white/60" />
              {(Object.keys(LOCALE_LABEL) as Locale[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    locale === l
                      ? "bg-white text-brand-800 shadow-soft"
                      : "text-white/80 hover:bg-white/15"
                  )}
                >
                  {LOCALE_LABEL[l]}
                </button>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Disease Topic Selector ────────────────────────────────── */}
      <section className="border-b border-brand-800 bg-brand-950">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Choose a topic
          </p>
          <div className="flex flex-wrap gap-2">
            {DISEASES.map((d) => (
              <button
                key={d}
                onClick={() => setDisease(d)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  disease === d
                    ? "bg-white text-brand-900 shadow-soft"
                    : "border border-white/15 bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {DISEASE_LABEL[d][locale]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Content Area ──────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <MotionCard className="h-fit p-2 md:sticky md:top-20">
            <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Sections
            </p>
            <nav className="space-y-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition",
                    category === c
                      ? "border-l-2 border-brand-600 bg-brand-50 pl-[10px] font-medium text-brand-800"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {CATEGORY_LABEL[c][locale]}
                </button>
              ))}
            </nav>
          </MotionCard>

          {/* Article */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${disease}-${category}-${locale}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <MotionCard className="p-6 sm:p-8">
                {article ? (
                  <article>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Badge tone="info">
                        {DISEASE_LABEL[disease][locale]}
                      </Badge>
                      <Badge tone="default">
                        {CATEGORY_LABEL[category][locale]}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {LOCALE_LABEL[locale]}
                      </span>
                    </div>

                    <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {article.title}
                    </h2>
                    <p className="mt-3 text-base leading-relaxed text-slate-600">
                      {article.summary}
                    </p>

                    <div className="prose prose-slate mt-6 max-w-none whitespace-pre-line text-[15px] leading-[1.8] text-slate-800">
                      {article.body_md}
                    </div>

                    <section
                      aria-labelledby="sources-heading"
                      className="mt-10 rounded-xl border border-slate-100 bg-slate-50 p-5"
                    >
                      <h3
                        id="sources-heading"
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        {SOURCES_HEADING[locale]}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        {SOURCES_NOTE[locale]}
                      </p>
                      <ol className="mt-3 space-y-2 text-sm text-slate-700">
                        {DISEASE_SOURCES[disease].map((s, idx) => (
                          <li key={s.url} className="flex gap-2 leading-relaxed">
                            <span className="text-slate-400">{idx + 1}.</span>
                            <span>
                              <span className="font-medium text-slate-900">
                                {s.publisher}
                              </span>{" "}
                              ({s.year}).{" "}
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline"
                              >
                                {s.title}
                                <ExternalLink className="h-3 w-3" aria-hidden />
                              </a>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </section>
                  </article>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center py-16 text-center"
                  >
                    <BookOpen className="mb-3 h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-700">
                      Article not available yet
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                      This combination of disease, section, and language is not yet
                      published. Try another section or language.
                    </p>
                  </motion.div>
                )}
              </MotionCard>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
