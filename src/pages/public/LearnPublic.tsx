import { useState } from "react";
import { ExternalLink } from "lucide-react";
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
      <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            For patients &amp; families
          </p>
          <h1 className="font-display mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Health Education
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            Plain-language guides on tuberculosis and respiratory diseases in
            English, Filipino, and Bisaya.
          </p>
        </div>
      </section>
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(LOCALE_LABEL) as Locale[]).map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={
              "rounded-full px-3 py-1.5 text-xs font-medium transition " +
              (locale === l
                ? "bg-brand-600 text-white"
                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50")
            }
          >
            {LOCALE_LABEL[l]}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {DISEASES.map((d) => (
          <button
            key={d}
            onClick={() => setDisease(d)}
            className={
              "rounded-md px-3 py-2 text-sm font-medium transition " +
              (disease === d
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50")
            }
          >
            {DISEASE_LABEL[d][locale]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={
                "block w-full rounded-md px-3 py-2 text-left text-sm transition " +
                (category === c
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-700 hover:bg-slate-100")
              }
            >
              {CATEGORY_LABEL[c][locale]}
            </button>
          ))}
        </nav>

        <Card className="p-6">
          {article ? (
            <article>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">
                {DISEASE_LABEL[disease][locale]} ·{" "}
                {CATEGORY_LABEL[category][locale]}
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {article.title}
              </h2>
              <p className="mt-2 text-base text-slate-600">{article.summary}</p>
              <div className="prose mt-4 max-w-none whitespace-pre-line text-slate-800">
                {article.body_md}
              </div>

              <section
                aria-labelledby="sources-heading"
                className="mt-8 border-t border-slate-200 pt-5"
              >
                <h3
                  id="sources-heading"
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                >
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
            <p className="text-sm text-slate-500">
              Article not available for this combination yet.
            </p>
          )}
        </Card>
      </div>
    </div>
    </>
  );
}
