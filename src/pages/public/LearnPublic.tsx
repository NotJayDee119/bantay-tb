import { useLayoutEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLenis } from "lenis/react";
import { ArrowRight, BookOpen, ChevronRight, Languages, MapPin } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  DISEASE_LABEL,
  HEALTH_ARTICLES,
  type Disease,
} from "../../data/healthContent";
import { LOCALE_LABEL, type Locale } from "../../lib/i18n";
import { t } from "../../data/learnUi";
import { Guidebook, type Section } from "../../components/learn/Guidebook";
import {
  CATEGORIES,
  DISEASE_ICON,
  DISEASES,
} from "../../components/learn/shared";

/** A colour per condition, so a reader can find "the blue one" again. */
const TILE_COLOR: Record<Disease, string> = {
  tb: "bg-accent-100 text-accent-700",
  pneumonia: "bg-sky-100 text-sky-700",
  covid19: "bg-violet-100 text-violet-700",
  influenza: "bg-amber-100 text-amber-700",
  bronchitis: "bg-teal-100 text-teal-700",
  copd: "bg-rose-100 text-rose-700",
  asthma: "bg-cyan-100 text-cyan-700",
  paragonimiasis: "bg-orange-100 text-orange-700",
};

function isDisease(value: string | null): value is Disease {
  return !!value && (DISEASES as string[]).includes(value);
}
function isSection(value: string | null): value is Section {
  return value === "sources" || (CATEGORIES as string[]).includes(value ?? "");
}

/**
 * Health Education, as a set of guidebooks.
 *
 * `/learn` lists the conditions; `/learn?topic=tb` opens that condition's
 * guide at its first chapter, and `&section=symptoms` at a given one. Each
 * chapter sits in the URL, so the browser's Back button steps back through
 * the chapters the reader opened, and a chapter can be shared as a link.
 */
export function LearnPublic() {
  // Filipino, not English. The reader this page is written for lives in Davao
  // City, and the artwork is drawn in Filipino throughout — opening in English
  // put the wording of the page at odds with the wording inside every poster
  // on it. English and Cebuano stay one tap away.
  const [locale, setLocale] = useState<Locale>("tl");
  const [params, setParams] = useSearchParams();
  const lenis = useLenis();

  // The chatbot cites articles by title and links here as ?article=<title>:
  // that opens the article's guide at its chapter, in its language.
  const linkedTitle = params.get("article");
  const linked = useMemo(
    () =>
      linkedTitle
        ? HEALTH_ARTICLES.find((a) => a.title === linkedTitle)
        : undefined,
    [linkedTitle],
  );
  useLayoutEffect(() => {
    if (!linked) return;
    setLocale(linked.locale);
    setParams({ topic: linked.disease, section: linked.category }, { replace: true });
  }, [linked, setParams]);

  const topicParam = params.get("topic");
  const sectionParam = params.get("section");
  const topic: Disease | null = isDisease(topicParam) ? topicParam : null;
  const section: Section = isSection(sectionParam) ? sectionParam : "overview";

  const toTop = () => {
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  };
  const openGuide = (d: Disease) => {
    setParams({ topic: d });
    toTop();
  };
  const closeGuide = () => {
    setParams({});
    toTop();
  };

  if (topic) {
    return (
      <Guidebook
        disease={topic}
        section={section}
        locale={locale}
        onLocaleChange={setLocale}
        onSection={(s) => setParams({ topic, section: s })}
        onDisease={openGuide}
        onClose={closeGuide}
      />
    );
  }

  return (
    <div className="bg-slate-50">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-8 gap-y-5 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="min-w-0 max-w-2xl">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
              <BookOpen className="h-4 w-4" aria-hidden />
              {t("forPatients", locale)}
            </p>
            <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {t("pageTitle", locale)}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-600 [text-wrap:pretty]">
              {t("pageIntro", locale)}
            </p>
          </div>

          <div
            role="group"
            aria-label="Language"
            className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1"
          >
            <Languages className="ml-2 h-4 w-4 text-slate-400" aria-hidden />
            {(Object.keys(LOCALE_LABEL) as Locale[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                aria-pressed={locale === l}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
                  locale === l
                    ? "bg-brand-950 text-white shadow-soft"
                    : "text-slate-600 hover:bg-white hover:text-slate-900",
                )}
              >
                {LOCALE_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ─── The guides ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        {/* Two rows of four on a computer, two across on a phone. Each tile
            is just a picture and a name — nothing to read before choosing. */}
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {DISEASES.map((d) => {
            const Icon = DISEASE_ICON[d];
            return (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => openGuide(d)}
                  className="group flex h-full w-full flex-col items-center rounded-3xl border border-slate-200 bg-white px-3 py-6 text-center transition duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 motion-reduce:transform-none sm:py-8"
                >
                  <span
                    className={cn(
                      "grid h-16 w-16 place-items-center rounded-2xl sm:h-20 sm:w-20",
                      TILE_COLOR[d],
                    )}
                  >
                    <Icon className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden />
                  </span>
                  <span className="font-display mt-4 text-lg font-extrabold leading-tight tracking-tight text-slate-900 [text-wrap:balance] sm:text-xl">
                    {DISEASE_LABEL[d][locale]}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-4 text-[15px] font-semibold text-accent-700">
                    {t("read", locale)}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 ring-1 ring-accent-100">
              <MapPin className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-[15px] leading-relaxed text-slate-700">
              {t("freeNote", locale)}
            </p>
          </div>
          <Link
            to="/dots-locator"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
          >
            {t("findCenter", locale)}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
