import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLenis } from "lenis/react";
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  CheckCircle2,
  ChevronRight,
  Expand,
  ExternalLink,
  Languages,
  Lightbulb,
  MapPin,
  Siren,
} from "lucide-react";
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
import {
  articleImageFor,
  type ResolvedArticleImage,
} from "../../data/healthImages";
import { parseArticleBody, type ArticleBlock } from "../../lib/articleBlocks";
import { LOCALE_LABEL, type Locale } from "../../lib/i18n";
import { t } from "../../data/learnUi";
import { SymptomInfographic } from "../SymptomInfographic";
import { ImageLightbox } from "./ImageLightbox";
import {
  CATEGORIES,
  CATEGORY_ICON,
  DISEASE_ICON,
  DISEASES,
  checklistMark,
  hostnameOf,
  readingMinutes,
  sentenceCase,
  topicIcon,
} from "./shared";

/** A guide's sections: its five chapters, then the sources behind them. */
export type Section = Category | "sources";

const PROSE = "text-[17px] leading-[1.75] text-slate-700";

/** Height of the site header, which is sticky — the sidebar and the phone
 *  chapter bar sit just under it rather than behind it. */
function useHeaderHeight(): number {
  const [h, setH] = useState(64);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("body header");
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return h;
}

/* ── Article body ──────────────────────────────────────────────────────── */

function Block({
  block,
  category,
  locale,
}: {
  block: ArticleBlock;
  category: Category;
  locale: Locale;
}) {
  const items = (list: string[]) => {
    const { Icon: Mark, className } = checklistMark(category);
    return (
      <ul className="mt-3 grid gap-2">
        {list.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200/80"
          >
            <Mark className={cn("mt-0.5 h-5 w-5 shrink-0", className)} aria-hidden />
            <span className="text-[16px] leading-relaxed text-slate-700">
              {sentenceCase(item)}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  switch (block.kind) {
    case "prose":
      return <p className={PROSE}>{block.text}</p>;
    case "checklist":
      return (
        <div>
          {block.lead && (
            <p className="text-[17px] font-semibold leading-relaxed text-slate-900">
              {block.lead}
            </p>
          )}
          {items(block.items)}
        </div>
      );
    case "topic": {
      const Icon = topicIcon(block.label, CATEGORY_ICON[category]);
      return (
        <div>
          <h3 className="flex items-center gap-3 text-lg font-bold tracking-tight text-slate-900">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100">
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            {block.label}
          </h3>
          {block.text && <p className={cn(PROSE, "mt-3")}>{block.text}</p>}
          {block.items.length > 0 && items(block.items)}
        </div>
      );
    }
    case "alert":
      return (
        <aside className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-600 text-white">
            <Siren className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-700">
              {t("whenToGetHelp", locale)}
            </p>
            <p className="mt-1 text-[16px] font-medium leading-relaxed text-red-950">
              {block.text}
            </p>
          </div>
        </aside>
      );
  }
}

function Figure({
  image,
  locale,
  onOpen,
}: {
  image: ResolvedArticleImage;
  locale: Locale;
  onOpen: () => void;
}) {
  return (
    <figure>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${t("viewLarger", locale)}: ${image.alt}`}
        aria-haspopup="dialog"
        className={cn(
          "group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl ring-1 ring-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
          image.fit === "contain" ? "bg-slate-900" : "bg-slate-100",
        )}
      >
        <img
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          decoding="async"
          className={cn(
            "mx-auto max-h-[460px] w-full transition-transform duration-500 ease-out group-hover:scale-[1.015] motion-reduce:transform-none",
            image.fit === "cover" ? "object-cover" : "object-contain",
            image.fit === "contain" && "p-3",
          )}
        />
        <span className="pointer-events-none absolute right-3 top-3 rounded-lg bg-slate-900/60 p-1.5 text-white opacity-80 transition-opacity group-hover:opacity-100">
          <Expand className="h-4 w-4" aria-hidden />
        </span>
      </button>
      <figcaption className="mt-3 text-[13px] leading-relaxed text-slate-500">
        {image.caption}{" "}
        <span className="text-slate-400">
          ·{" "}
          {image.creditUrl ? (
            <a
              href={image.creditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-700"
            >
              {image.credit}
            </a>
          ) : (
            image.credit
          )}
        </span>
      </figcaption>
    </figure>
  );
}

/* ── The guide ─────────────────────────────────────────────────────────── */

/**
 * One condition, read as a guidebook: its chapters listed down the side, one
 * chapter on screen at a time, and Previous / Next at the foot of each so the
 * reader is never more than a click from where they were going.
 *
 * On phones the side list becomes a row of chapter chips under the header.
 */
export function Guidebook({
  disease,
  section,
  locale,
  onLocaleChange,
  onSection,
  onDisease,
  onClose,
}: {
  disease: Disease;
  section: Section;
  locale: Locale;
  onLocaleChange: (l: Locale) => void;
  onSection: (s: Section) => void;
  onDisease: (d: Disease) => void;
  onClose: () => void;
}) {
  const headerH = useHeaderHeight();
  const lenis = useLenis();
  const articleRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<ResolvedArticleImage | null>(null);

  const articles = useMemo(
    () =>
      HEALTH_ARTICLES.filter((a) => a.disease === disease && a.locale === locale),
    [disease, locale],
  );
  const minutes = useMemo(
    () =>
      readingMinutes(articles.map((a) => `${a.summary} ${a.body_md}`).join(" ")),
    [articles],
  );
  const sections: Section[] = [...CATEGORIES, "sources"];
  const index = sections.indexOf(section);
  const prevSection = index > 0 ? sections[index - 1] : null;
  const nextSection = index < sections.length - 1 ? sections[index + 1] : null;

  const label = (s: Section) =>
    s === "sources" ? SOURCES_HEADING[locale] : CATEGORY_LABEL[s][locale];

  // Moving between chapters: glide back up to the top of the chapter (not
  // the top of the page — the reader stays inside the guide), and keep the
  // phone's chip row showing the chapter that's open.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = articleRef.current;
    if (el && el.getBoundingClientRect().top < headerH) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const offset = -(headerH + 72);
      if (lenis) lenis.scrollTo(el, { offset, duration: reduce ? 0 : 0.7 });
      else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    }
    // Only on a change of chapter or guide, not on every header resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, disease]);

  useEffect(() => {
    const chip = chipsRef.current?.querySelector<HTMLElement>("[aria-current='page']");
    chip?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [section]);

  // ← → move between chapters, as they do in most readers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightbox || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight" && nextSection) onSection(nextSection);
      else if (e.key === "ArrowLeft" && prevSection) onSection(prevSection);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, nextSection, prevSection, onSection]);

  const DiseaseIcon = DISEASE_ICON[disease];
  const others = [1, 2, 3].map(
    (k) => DISEASES[(DISEASES.indexOf(disease) + k) % DISEASES.length],
  );

  const languageSwitch = (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1"
    >
      <Languages className="ml-1.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      {(Object.keys(LOCALE_LABEL) as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onLocaleChange(l)}
          aria-pressed={locale === l}
          className={cn(
            "flex-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
            locale === l
              ? "bg-brand-950 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {LOCALE_LABEL[l]}
        </button>
      ))}
    </div>
  );

  /* ── The open chapter ── */
  let body: ReactNode;
  if (section === "sources") {
    body = (
      <>
        <p className="text-sm font-semibold text-accent-700">
          {DISEASE_LABEL[disease][locale]}
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-[2.25rem]">
          {SOURCES_HEADING[locale]}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          {SOURCES_NOTE[locale]}
        </p>
        <ol className="mt-6 divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200">
          {DISEASE_SOURCES[disease].map((s, i) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5"
              >
                <span className="mt-0.5 w-5 shrink-0 text-sm tabular-nums text-slate-400">
                  {i + 1}.
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-accent-700">
                    {s.title}
                  </span>
                  <span className="mt-1 block text-[13px] text-slate-500">
                    {s.publisher} · {s.year} · {hostnameOf(s.url)}
                  </span>
                </span>
                <ExternalLink
                  className="mt-1 h-4 w-4 shrink-0 text-slate-300 group-hover:text-accent-600"
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ol>

        {/* End of the guide. */}
        <div className="mt-12 rounded-3xl bg-brand-950 p-6 text-white sm:p-8">
          <CheckCircle2 className="h-8 w-8 text-accent-400" aria-hidden />
          <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight">
            {t("finished", locale)}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-300">
            {t("finishedBody", locale)}
          </p>
          <p className="mt-6 text-sm font-semibold text-slate-200">
            {t("readAnother", locale)}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {others.map((d) => {
              const Icon = DISEASE_ICON[d];
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDisease(d)}
                  className="group flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-3 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                >
                  <Icon className="h-5 w-5 shrink-0 text-accent-400" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                    {DISEASE_LABEL[d][locale]}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  } else {
    const article = articles.find((a) => a.category === section);
    const image = articleImageFor(disease, section, locale) ?? null;
    const SectionIcon = CATEGORY_ICON[section];
    body = (
      <>
        <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-accent-700">
          <SectionIcon className="h-4 w-4" aria-hidden />
          {t("chapterOf", locale, { n: index + 1, total: CATEGORIES.length })}
          {article && (
            <span className="font-normal text-slate-500">
              · {t("minRead", locale, { n: readingMinutes(`${article.summary} ${article.body_md}`) })}
            </span>
          )}
        </p>
        <h1 className="font-display mt-2 text-3xl font-extrabold leading-[1.12] tracking-tight text-slate-900 [text-wrap:balance] sm:text-[2.25rem]">
          {article?.title ?? CATEGORY_LABEL[section][locale]}
        </h1>

        {!article ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="font-semibold text-slate-800">{t("emptyTitle", locale)}</p>
            <p className="mt-1 text-sm text-slate-500">{t("emptyBody", locale)}</p>
          </div>
        ) : (
          <>
            {article.summary && (
              <div className="mt-6 flex gap-3 rounded-2xl border border-accent-200 bg-accent-50 p-4 sm:p-5">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-accent-800">
                    {t("keyTakeaway", locale)}
                  </p>
                  <p className="mt-1 text-[16px] font-medium leading-relaxed text-slate-800">
                    {article.summary}
                  </p>
                </div>
              </div>
            )}

            {image && (
              <div className="mt-8">
                <Figure image={image} locale={locale} onOpen={() => setLightbox(image)} />
              </div>
            )}

            {section === "symptoms" && (
              <SymptomInfographic disease={disease} locale={locale} className="mt-8" />
            )}

            <div className="mt-8 space-y-6">
              {parseArticleBody(article.body_md).map((b, i) => (
                <Block key={i} block={b} category={section} locale={locale} />
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  const navRow = (s: Section, i: number) => {
    const active = s === section;
    const Icon = s === "sources" ? BookMarked : CATEGORY_ICON[s];
    return (
      <li key={s}>
        <button
          type="button"
          onClick={() => onSection(s)}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
            active
              ? "bg-white font-semibold text-slate-900 shadow-soft ring-1 ring-slate-200"
              : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
          )}
        >
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums transition-colors",
              active
                ? "bg-accent-600 text-white"
                : "bg-slate-200/70 text-slate-500 group-hover:bg-slate-200",
            )}
          >
            {s === "sources" ? <Icon className="h-3.5 w-3.5" aria-hidden /> : i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate">{label(s)}</span>
        </button>
      </li>
    );
  };

  return (
    <div className="bg-slate-50">
      {/* ── Phone: chapter chips under the header ── */}
      <div
        className="sticky z-30 border-b border-slate-200 bg-white/90 backdrop-blur lg:hidden"
        style={{ top: headerH }}
      >
        <div className="flex items-center gap-2 px-4 pt-2.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="-ml-1.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("allGuides", locale)}
          </button>
          <span className="truncate text-sm font-semibold text-slate-900">
            · {DISEASE_LABEL[disease][locale]}
          </span>
        </div>
        <div
          ref={chipsRef}
          className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {sections.map((s, i) => {
            const active = s === section;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSection(s)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150",
                  active
                    ? "bg-brand-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {s === "sources" ? label(s) : `${i + 1}. ${label(s)}`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-6 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14 lg:px-8 lg:pt-10">
        {/* ── Desktop: the contents, down the side ── */}
        <aside className="hidden lg:block">
          <div className="sticky space-y-6" style={{ top: headerH + 32 }}>
            <button
              type="button"
              onClick={onClose}
              className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t("allGuides", locale)}
            </button>

            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-950 text-accent-400">
                <DiseaseIcon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-display truncate text-lg font-extrabold leading-tight tracking-tight text-slate-900">
                  {DISEASE_LABEL[disease][locale]}
                </p>
                <p className="text-[13px] text-slate-500">
                  {t("chapterCount", locale, { n: CATEGORIES.length })} ·{" "}
                  {t("minRead", locale, { n: minutes })}
                </p>
              </div>
            </div>

            <nav aria-label={t("contents", locale)}>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                {t("contents", locale)}
              </p>
              <ol className="space-y-1">{sections.map(navRow)}</ol>
            </nav>

            {languageSwitch}

            <Link
              to="/dots-locator"
              className="group flex items-start gap-3 rounded-2xl border border-accent-200 bg-accent-50 p-4 transition-colors hover:bg-accent-100/70"
            >
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent-700" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[13px] leading-relaxed text-slate-700">
                  {t("freeNote", locale)}
                </span>
                <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-accent-800">
                  {t("findCenter", locale)}
                  <ChevronRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </span>
            </Link>
          </div>
        </aside>

        {/* ── The chapter ── */}
        <main ref={articleRef} className="min-w-0">
          <div className="mb-6 lg:hidden">{languageSwitch}</div>

          <article
            key={`${disease}-${section}-${locale}`}
            className="learn-chapter-in max-w-[44rem]"
          >
            {body}
          </article>

          {/* Previous / Next */}
          <nav
            aria-label={t("contents", locale)}
            className="mt-14 grid max-w-[44rem] gap-3 border-t border-slate-200 pt-8 sm:grid-cols-2"
          >
            {prevSection ? (
              <button
                type="button"
                onClick={() => onSection(prevSection)}
                className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 motion-reduce:transform-none"
              >
                <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
                  <ArrowLeft
                    className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
                    aria-hidden
                  />
                  {t("previous", locale)}
                </span>
                <span className="mt-1 font-semibold text-slate-900">
                  {label(prevSection)}
                </span>
              </button>
            ) : (
              <span className="hidden sm:block" />
            )}
            {nextSection && (
              <button
                type="button"
                onClick={() => onSection(nextSection)}
                className="group flex flex-col items-end rounded-2xl border border-brand-950 bg-brand-950 p-4 text-right text-white transition duration-200 hover:-translate-y-0.5 hover:bg-brand-900 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 motion-reduce:transform-none"
              >
                <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-300">
                  {t("continueTo", locale)}
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="mt-1 font-semibold">{label(nextSection)}</span>
              </button>
            )}
          </nav>
        </main>
      </div>

      {lightbox && (
        <ImageLightbox image={lightbox} locale={locale} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
