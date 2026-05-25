import { useState } from "react";
import { BookOpen, ExternalLink, Languages } from "lucide-react";
import { Card } from "../../components/ui";
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

export function LearnPublic() {
  const [locale, setLocale] = useState<Locale>("en");
  const [disease, setDisease] = useState<Disease>("tb");
  const [category, setCategory] = useState<Category>("overview");

  const article = HEALTH_ARTICLES.find(
    (a) => a.disease === disease && a.locale === locale && a.category === category
  );

  return (
    <>
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                For patients &amp; families
              </p>
              <h1 className="font-display mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Health Education
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
                Plain-language guides on tuberculosis and other respiratory
                diseases. Available in English, Filipino, and Bisaya.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 shadow-soft">
              <Languages className="ml-2 h-4 w-4 text-slate-400" />
              {(Object.keys(LOCALE_LABEL) as Locale[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={
                    "rounded-full px-3 py-1.5 text-xs font-medium transition " +
                    (locale === l
                      ? "bg-brand-600 text-white shadow-soft"
                      : "text-slate-600 hover:bg-slate-100")
                  }
                >
                  {LOCALE_LABEL[l]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Choose a topic
          </p>
          <div className="flex flex-wrap gap-2">
            {DISEASES.map((d) => (
              <button
                key={d}
                onClick={() => setDisease(d)}
                className={
                  "rounded-full px-4 py-2 text-sm font-medium transition " +
                  (disease === d
                    ? "bg-slate-900 text-white shadow-soft"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50")
                }
              >
                {DISEASE_LABEL[d][locale]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <Card className="h-fit p-2 md:sticky md:top-4">
            <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Sections
            </p>
            <nav className="space-y-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition " +
                    (category === c
                      ? "bg-brand-50 font-medium text-brand-800"
                      : "text-slate-700 hover:bg-slate-100")
                  }
                >
                  <span>{CATEGORY_LABEL[c][locale]}</span>
                  {category === c && (
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                  )}
                </button>
              ))}
            </nav>
          </Card>

          <Card className="p-6 sm:p-8">
            {article ? (
              <article>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold uppercase tracking-wide text-brand-700">
                    {DISEASE_LABEL[disease][locale]}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="font-medium uppercase tracking-wide">
                    {CATEGORY_LABEL[category][locale]}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>{LOCALE_LABEL[locale]}</span>
                </div>

                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {article.title}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-slate-600">
                  {article.summary}
                </p>

                <div className="prose prose-slate mt-6 max-w-none whitespace-pre-line text-[15px] leading-relaxed text-slate-800">
                  {article.body_md}
                </div>

                <section
                  aria-labelledby="sources-heading"
                  className="mt-10 border-t border-slate-200 pt-6"
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
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-700">
                  Article not available yet
                </p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  This combination of disease, section, and language is not yet
                  published. Try another section or language.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
