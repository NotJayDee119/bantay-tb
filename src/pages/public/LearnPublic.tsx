import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BookOpen,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Expand,
  ExternalLink,
  Eye,
  Footprints,
  HandHeart,
  Heart,
  HeartPulse,
  Languages,
  Lightbulb,
  Microscope,
  Moon,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Stethoscope,
  Syringe,
  Thermometer,
  Utensils,
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
  type HealthArticle,
} from "../../data/healthContent";
import {
  articleImageFor,
  type ResolvedArticleImage,
} from "../../data/healthImages";
import { parseArticleBody, type ArticleBlock } from "../../lib/articleBlocks";
import { SymptomInfographic } from "../../components/SymptomInfographic";
import { LOCALE_LABEL, type Locale } from "../../lib/i18n";
import heroImage from "../../assets/davao-city-hero.webp";

const DISEASES: Disease[] = [
  "tb",
  "pneumonia",
  "covid19",
  "influenza",
  "bronchitis",
  "copd",
  "asthma",
  // Last in the row: it is the one topic here that is not a respiratory
  // infection, and it is read *because* of TB rather than alongside it.
  "paragonimiasis",
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
  paragonimiasis: Bug,
};

/** One icon per section, kept deliberately distinct from `DISEASE_ICON` —
 *  the topic chips and the section list are on screen at the same time, and a
 *  repeated glyph across the two would read as a link between them. */
const CATEGORY_ICON: Record<Category, LucideIcon> = {
  overview: Microscope,
  symptoms: Eye,
  treatment: Pill,
  prevention: ShieldCheck,
  lifestyle: HandHeart,
};

/** Icons for the sub-headings the articles write out longhand — "Sleep:",
 *  "Nutrisyon:", "Mga trigger:". Matched on the label the author wrote, in
 *  whichever language they wrote it, so the glyph survives translation. */
const TOPIC_ICONS: { match: RegExp; icon: LucideIcon }[] = [
  { match: /sleep|tulog|katulog/i, icon: Moon },
  { match: /nutri/i, icon: Utensils },
  { match: /exercise|ehersisyo/i, icon: Footprints },
  { match: /trigger/i, icon: Wind },
  { match: /vaccin|bakuna/i, icon: Syringe },
  { match: /watch|bantayan|sintomas|symptom|signs/i, icon: Eye },
  { match: /treat|paggamot|tambal|pagpapagaling/i, icon: Pill },
  { match: /air|hangin/i, icon: Wind },
];

function topicIcon(label: string, fallback: LucideIcon): LucideIcon {
  return TOPIC_ICONS.find((t) => t.match.test(label))?.icon ?? fallback;
}

/** The mark against each checklist item, which carries meaning rather than
 *  decoration: symptoms are things to notice, everything else is something to
 *  do. A reader skimming the amber marks is reading a different kind of list
 *  from one skimming the green ticks. */
function checklistMark(category: Category): {
  Icon: LucideIcon;
  className: string;
} {
  if (category === "symptoms")
    return { Icon: CircleAlert, className: "text-vigil-600" };
  if (category === "overview")
    return { Icon: ChevronRight, className: "text-slate-400" };
  return { Icon: CheckCircle2, className: "text-accent-600" };
}

/** Page furniture, translated alongside the articles. A language switcher that
 *  leaves the labels around the text in English undercuts the point of it. */
const UI = {
  chooseTopic: {
    en: "Choose a topic",
    tl: "Pumili ng paksa",
    ceb: "Pagpili ug hilisgutan",
  },
  sections: { en: "Sections", tl: "Mga Bahagi", ceb: "Mga Bahin" },
  sectionOf: {
    en: "Section {n} of {total}",
    tl: "Bahagi {n} ng {total}",
    ceb: "Bahin {n} sa {total}",
  },
  minRead: {
    en: "{n} min read",
    tl: "{n} min basahin",
    ceb: "{n} min basahon",
  },
  keyTakeaway: {
    en: "Key takeaway",
    tl: "Mahalagang tandaan",
    ceb: "Hinumdumi kini",
  },
  whenToGetHelp: {
    en: "When to get help",
    tl: "Kailan magpatingin",
    ceb: "Kanus-a mangayo ug tabang",
  },
  previous: { en: "Previous", tl: "Nakaraan", ceb: "Miagi" },
  continueTo: {
    en: "Continue to",
    tl: "Susunod na bahagi",
    ceb: "Sunod nga bahin",
  },
  related: {
    en: "Related articles",
    tl: "Kaugnay na artikulo",
    ceb: "Kalabot nga artikulo",
  },
  relatedNote: {
    en: "The same section, for other conditions.",
    tl: "Ang parehong bahagi, para sa ibang sakit.",
    ceb: "Ang samang bahin, para sa ubang sakit.",
  },
  emptyTitle: {
    en: "Not published yet",
    tl: "Wala pa nailalathala",
    ceb: "Wala pa gimantala",
  },
  emptyBody: {
    en: "This section is not yet available in this language. Try another section or switch language.",
    tl: "Wala pa sa wikang ito ang bahaging ito. Sumubok ng ibang bahagi o palitan ang wika.",
    ceb: "Wala pa niini nga pinulongan kini nga bahin. Sulayi ang laing bahin o usba ang pinulongan.",
  },
} satisfies Record<string, Record<Locale, string>>;

function t(
  key: keyof typeof UI,
  locale: Locale,
  vars?: Record<string, string | number>,
): string {
  let out: string = UI[key][locale];
  for (const [k, v] of Object.entries(vars ?? {}))
    out = out.replace(`{${k}}`, String(v));
  return out;
}

/** ~200 words/min, always at least 1 minute. */
function readingMinutes(text: string): number {
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

/** Lists in the source are written as mid-sentence clauses, so they arrive
 *  lowercase. Once each one is on its own line it reads as a fragment unless
 *  it starts like a sentence. */
function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Section heading for the two rails, so they read as one system. */
function RailHeading({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-tight text-slate-900">
      <Icon className="h-4 w-4 shrink-0 text-accent-600" aria-hidden />
      {children}
    </h2>
  );
}

/** The article's picture, with its caption and credit.
 *
 *  Two quite different things arrive here and they are not laid out the same
 *  way. A photograph is scenery: it crops into a wide banner and loses nothing.
 *  An infographic is *text* — the reader is meant to read it — so it is never
 *  boxed to a ratio at all. It runs the full width of the column at its own
 *  aspect. The old code letterboxed both into the same 16:9 slab, which is what
 *  made the posters unreadable: the box was throwing away exactly the width
 *  their wording needed.
 *
 *  `width`/`height` on the tag let the browser reserve the space itself, so
 *  the natural-aspect figures don't reflow the page as they load. */
function ArticleImageFigure({ image }: { image: ResolvedArticleImage }) {
  const isFigure = image.fit === "figure";

  return (
    <figure className="border-y border-slate-200 bg-white">
      {isFigure ? (
        // Every one of these is a portrait poster, and the two ways to frame
        // one both fail on their own: fill the column and a 3:4 poster runs
        // ~870px tall (the 768×1376 ones ~1165px), swallowing the screen; cap
        // the height and its wording shrinks past reading.
        //
        // So the figure is capped to fit one screen — 70vh, never taller than
        // the reader's viewport — and the whole thing opens full-size in a new
        // tab on click. The page stays readable at a glance; the poster stays
        // legible for anyone who wants to actually read it. `max-w` at the
        // intrinsic width still keeps the column from upscaling a 768px file
        // into a blurry one.
        <a
          href={image.src}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block cursor-zoom-in bg-slate-100/70"
        >
          <img
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="mx-auto block h-auto max-h-[70vh] w-auto"
            style={{
              maxWidth: image.width ? `min(100%, ${image.width}px)` : "100%",
            }}
          />
          {/* No wording on the affordance: this page runs in three languages
              and a picture that opens bigger does not need a sentence. */}
          <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-slate-900/55 p-1.5 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            <Expand className="h-4 w-4" />
          </span>
        </a>
      ) : (
        <img
          src={image.src}
          alt={image.alt}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className={cn(
            "w-full",
            // Clinical images sit whole against a dark backing rather than
            // being cropped: cropping a chest X-ray cuts off the lungs, and
            // cropping the micrograph loses its scale bar. The dark backing
            // also happens to read like a radiologist's lightbox.
            image.fit === "contain"
              ? "aspect-[16/10] bg-slate-900 object-contain p-3 sm:aspect-[2/1] sm:p-4"
              : "aspect-[2/1] bg-slate-100 object-cover sm:aspect-[21/9]",
          )}
        />
      )}

      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1.5 bg-slate-50 px-6 py-3 sm:px-8 lg:px-10">
        <p className="min-w-[16rem] flex-1 text-[13px] leading-relaxed text-slate-600">
          {image.caption}
        </p>
        {/* Credit stays visible rather than hiding in a tooltip or alt text —
            on a health page a reader should be able to see where a clinical
            image came from without hunting for it. slate-500 rather than
            slate-400: at 10px on this tinted strip, slate-400 lands near
            2.9:1 against the background. */}
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          {image.creditUrl ? (
            <a
              href={image.creditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition hover:text-slate-700"
            >
              {image.credit}
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            </a>
          ) : (
            image.credit
          )}
        </p>
      </figcaption>
    </figure>
  );
}

/** Renders one parsed block of the article.
 *
 *  The source is flowing prose, but much of it is a list wearing a paragraph's
 *  clothes — eight symptoms separated by semicolons inside one sentence. Set
 *  as lines with a mark against each, a worried reader can find themselves in
 *  it at a glance instead of parsing a wall of text. */
function BodyBlock({
  block,
  category,
  locale,
}: {
  block: ArticleBlock;
  category: Category;
  locale: Locale;
}) {
  const mark = checklistMark(category);

  if (block.kind === "prose") {
    return (
      <p className="text-[17px] leading-[1.8] text-slate-700 [text-wrap:pretty]">
        {block.text}
      </p>
    );
  }

  if (block.kind === "alert") {
    return (
      <aside className="flex gap-3.5 rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-600 text-white">
          <Siren className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-red-700">
            {t("whenToGetHelp", locale)}
          </p>
          <p className="mt-1 text-[15px] font-medium leading-relaxed text-red-950">
            {block.text}
          </p>
        </div>
      </aside>
    );
  }

  if (block.kind === "checklist") {
    return (
      <div>
        {block.lead && (
          <p className="text-[17px] font-semibold leading-relaxed text-slate-900">
            {block.lead}
          </p>
        )}
        {/* Two columns only from `lg`, where the reading column is genuinely
            wide enough for them. Below that a split makes each item wrap to
            three lines, which is harder to scan than one clean column. */}
        <ul
          className={cn(
            "grid gap-x-4 gap-y-1.5 lg:grid-cols-2",
            block.lead && "mt-3",
          )}
        >
          {block.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5"
            >
              <mark.Icon
                className={cn("mt-0.5 h-4 w-4 shrink-0", mark.className)}
                aria-hidden
              />
              <span className="text-[15px] leading-snug text-slate-700">
                {sentenceCase(item)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Labelled sub-section: "Sleep: …", "Nutrisyon: …", "Mga trigger: …"
  const Icon = topicIcon(block.label, CATEGORY_ICON[category]);
  return (
    <section className="flex gap-3.5">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-100">
        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold tracking-tight text-slate-900">
          {block.label}
        </h3>
        {block.text && (
          <p className="mt-1 text-[17px] leading-[1.8] text-slate-700 [text-wrap:pretty]">
            {sentenceCase(block.text)}
          </p>
        )}
        {block.items.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {block.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <mark.Icon
                  className={cn("mt-1 h-3.5 w-3.5 shrink-0", mark.className)}
                  aria-hidden
                />
                <span className="text-[15px] leading-snug text-slate-700">
                  {sentenceCase(item)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function LearnPublic() {
  // Filipino, not English. The reader this page is written for lives in Davao
  // City, and the artwork is drawn in Filipino throughout — opening in English
  // put the wording of the page at odds with the wording inside every poster
  // on it. English and Cebuano stay one tap away.
  const [locale, setLocale] = useState<Locale>("tl");
  const [disease, setDisease] = useState<Disease>("tb");
  const [category, setCategory] = useState<Category>("overview");
  // Sections the visitor has opened, per disease — powers the progress UI.
  const [visited, setVisited] = useState<Set<string>>(new Set());
  // Citations start folded. They are reference material rather than reading
  // material, and open by default they pushed the article down the page. The
  // count stays visible on the closed header, so the reader can still see at a
  // glance that the page is sourced.
  const [showSources, setShowSources] = useState(false);

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
    (a) =>
      a.disease === disease && a.locale === locale && a.category === category,
  );

  const articleImage = articleImageFor(disease, category, locale);

  const blocks = useMemo(
    () => (article ? parseArticleBody(article.body_md) : []),
    [article],
  );

  // The same section for other conditions — "Symptoms" while reading about TB
  // offers Pneumonia's and COVID's symptoms, which is the comparison a worried
  // reader is usually trying to make.
  const related = useMemo(
    () =>
      DISEASES.filter((d) => d !== disease)
        .map((d) =>
          HEALTH_ARTICLES.find(
            (a) =>
              a.disease === d && a.locale === locale && a.category === category,
          ),
        )
        .filter((a): a is HealthArticle => Boolean(a))
        .slice(0, 4),
    [disease, locale, category],
  );

  const catIndex = CATEGORIES.indexOf(category);
  const prevCat = catIndex > 0 ? CATEGORIES[catIndex - 1] : null;
  const nextCat =
    catIndex < CATEGORIES.length - 1 ? CATEGORIES[catIndex + 1] : null;

  const visitedCount = useMemo(
    () => CATEGORIES.filter((c) => visited.has(`${disease}:${c}`)).length,
    [visited, disease],
  );

  const CategoryIcon = CATEGORY_ICON[category];

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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-vigil-grid"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-[-40%] h-[26rem] w-[26rem] rounded-full bg-accent-500/10 blur-[100px]"
        />

        {/* The masthead and the topic picker share one band. As two stacked
            full-padding sections they cost around 400px before the article
            began, which is most of a laptop viewport spent on chrome. */}
        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-brand-300">
                <Heart className="h-3 w-3 text-accent-400" />
                For patients &amp; families
              </div>
              <h1 className="font-display mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Health Education
              </h1>
            </div>

            {/* Language — segmented pill, mirrors the navbar */}
            <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1 backdrop-blur-sm">
              <Languages className="ml-2 h-4 w-4 text-white/50" />
              {(Object.keys(LOCALE_LABEL) as Locale[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200",
                    locale === l
                      ? "bg-white text-brand-950 shadow-soft"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {LOCALE_LABEL[l]}
                </button>
              ))}
            </div>
          </div>

          {/* Topic chips, in the same band. The standing description that used
              to sit here is a first-visit message that cost every visit a
              paragraph of height; the chips say what the page covers. */}
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible lg:pb-0">
            {DISEASES.map((d) => {
              const Icon = DISEASE_ICON[d];
              const active = disease === d;
              return (
                <button
                  key={d}
                  onClick={() => setDisease(d)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-white text-brand-950 shadow-soft"
                      : "border border-white/15 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      active ? "text-accent-600" : "text-accent-400",
                    )}
                  />
                  {DISEASE_LABEL[d][locale]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Two-column reading layout ─────────────────────────────────
          Was three columns: nav rail, article, and a rail of related reading
          and citations. The third column cost the article 250px of width, and
          the article is where the infographics live — at three columns a
          1024px-wide poster rendered around 600px, small enough that its own
          body text fell under 10px. The supporting material was never read
          *while* reading; it is what you turn to afterwards. So it moved below
          the article, where it reads as the end of the section rather than
          competing with it, and the reading column took the width back. */}
      <div className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
            {/* ── Left rail: what you're reading, and the section list ── */}
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft">
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-950 text-accent-400">
                      <CategoryIcon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-bold tracking-tight text-slate-900">
                        {DISEASE_LABEL[disease][locale]}
                      </p>
                      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-500">
                        {CATEGORY_LABEL[category][locale]}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen
                        className="h-3.5 w-3.5 text-slate-400"
                        aria-hidden
                      />
                      {t("sectionOf", locale, {
                        n: catIndex + 1,
                        total: CATEGORIES.length,
                      })}
                    </span>
                    {article && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock
                          className="h-3.5 w-3.5 text-slate-400"
                          aria-hidden
                        />
                        {t("minRead", locale, {
                          n: readingMinutes(
                            `${article.summary} ${article.body_md}`,
                          ),
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Section navigation stays in this rail: without it there is
                    no way to move between the five sections. */}
                <div className="border-t border-slate-200 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {t("sections", locale)}
                    </p>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-accent-500 transition-all duration-500"
                        style={{
                          width: `${(visitedCount / CATEGORIES.length) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px] tabular-nums text-slate-500">
                      {visitedCount}/{CATEGORIES.length}
                    </span>
                  </div>
                </div>
                <nav className="grid gap-0.5 p-2 pt-0 sm:grid-cols-2 lg:grid-cols-1">
                  {CATEGORIES.map((c) => {
                    const active = category === c;
                    const seen = visited.has(`${disease}:${c}`);
                    const Icon = CATEGORY_ICON[c];
                    return (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition",
                          active
                            ? "bg-brand-950 font-medium text-white shadow-soft"
                            : "text-slate-700 hover:bg-slate-100",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-6 w-6 shrink-0 place-items-center rounded-lg",
                            active
                              ? "bg-white/15 text-accent-300"
                              : seen
                                ? "bg-accent-50 text-accent-700"
                                : "bg-slate-100 text-slate-400",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {CATEGORY_LABEL[c][locale]}
                        </span>
                        {seen && !active && (
                          <CheckCircle2
                            className="h-3.5 w-3.5 shrink-0 text-accent-500"
                            aria-hidden
                          />
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>

            {/* ── Centre: the article itself ─────────────────────────── */}
            <main className="min-w-0">
              <div
                key={`${disease}-${category}-${locale}`}
                className="learn-article-in overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft sm:p-8 lg:p-10"
              >
                {article ? (
                  <article>
                    {/* Title, the one-sentence point, then the picture. The
                        summary used to sit *below* the picture; once figures
                        render at their own aspect a portrait poster is taller
                        than a phone screen, and the sentence the reader most
                        needs was landing under all of it. */}
                    <h2 className="font-display max-w-[22ch] text-[1.75rem] font-extrabold leading-[1.12] tracking-tight text-slate-900 [text-wrap:balance] sm:text-4xl">
                      {article.title}
                    </h2>

                    {/* Both of these run to the card's edges rather than
                        sitting in it as rounded boxes. Cards inside a card
                        gave the article three nested frames and no hierarchy;
                        as full-bleed bands they read as a beat of the page —
                        padded title, two bands, padded prose. */}
                    <div className="-mx-6 mt-5 border-y border-accent-200/70 bg-accent-50 px-6 py-4 sm:-mx-8 sm:px-8 sm:py-5 lg:-mx-10 lg:px-10">
                      <div className="flex gap-3.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-600 text-white">
                          <Lightbulb
                            className="h-[1.125rem] w-[1.125rem]"
                            aria-hidden
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-800">
                            {t("keyTakeaway", locale)}
                          </p>
                          <p className="mt-1 max-w-[62ch] text-[15px] font-medium leading-relaxed text-slate-800">
                            {article.summary}
                          </p>
                        </div>
                      </div>
                    </div>

                    {articleImage && (
                      <div className="-mx-6 sm:-mx-8 lg:-mx-10">
                        <ArticleImageFigure image={articleImage} />
                      </div>
                    )}

                    {/* Symptom pictures land before the prose, not after it:
                        the reader who most needs them is the one who will not
                        finish the paragraph. */}
                    {category === "symptoms" && (
                      <SymptomInfographic
                        disease={disease}
                        locale={locale}
                        className="mt-8"
                      />
                    )}

                    {/* The reading column is capped at 72 characters. The brief
                        asked for 700–800px, but at 17px that runs to ~90
                        characters a line, past the point where the eye starts
                        losing its place on the return sweep to the next line. */}
                    <div className="mt-8 max-w-[72ch] space-y-6">
                      {blocks.map((block, i) => (
                        <BodyBlock
                          key={i}
                          block={block}
                          category={category}
                          locale={locale}
                        />
                      ))}
                    </div>

                    {/* Section navigation — continue the course */}
                    {(prevCat || nextCat) && (
                      <div className="mt-10 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-2">
                        {prevCat ? (
                          <button
                            type="button"
                            onClick={() => setCategory(prevCat)}
                            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lift"
                          >
                            <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5" />
                            <span className="min-w-0">
                              <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500">
                                {t("previous", locale)}
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
                                {t("continueTo", locale)}
                              </span>
                              <span className="block truncate text-sm font-semibold text-white">
                                {CATEGORY_LABEL[nextCat][locale]}
                              </span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-accent-400 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                ) : (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100">
                      <BookOpen className="h-6 w-6 text-slate-400" />
                    </span>
                    <p className="mt-4 text-sm font-semibold text-slate-700">
                      {t("emptyTitle", locale)}
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-slate-500">
                      {t("emptyBody", locale)}
                    </p>
                  </div>
                )}
              </div>

              {/* ── After the article: related reading and the citations ──
                  Below the reading column rather than beside it, and two-up
                  from `md` so the pair reads as one closing band instead of a
                  stack. Both are what you turn to once you've finished, so
                  they no longer compete with the article for width. */}
              <div
                className={cn(
                  "mt-6 grid gap-6",
                  // Two-up only when there is a pair to balance; on the
                  // conditions with no related reading, the citations take the
                  // full width rather than sitting in a half-empty row.
                  related.length > 0 && "md:grid-cols-2",
                )}
              >
                {related.length > 0 && (
                  <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft">
                    <RailHeading icon={Waves}>
                      {t("related", locale)}
                    </RailHeading>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                      {t("relatedNote", locale)}
                    </p>
                    <ul className="mt-3 space-y-0.5">
                      {related.map((a) => {
                        const Icon = DISEASE_ICON[a.disease];
                        return (
                          <li key={a.slug}>
                            <button
                              type="button"
                              onClick={() => setDisease(a.disease)}
                              className="group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-slate-50"
                            >
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-accent-50 group-hover:text-accent-700">
                                <Icon className="h-3.5 w-3.5" aria-hidden />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-accent-700">
                                  {DISEASE_LABEL[a.disease][locale]}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                                  {a.title}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {/* References — a reading list, not a grid of cards. */}
                <section
                  aria-labelledby="sources-heading"
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft"
                >
                  {/* Disclosure, not a checkbox or an icon-only affordance: the
                    whole header row is the hit target, and the count stays
                    visible when collapsed so the reader still knows the page
                    is sourced and how heavily. */}
                  <h2 id="sources-heading">
                    <button
                      type="button"
                      onClick={() => setShowSources((v) => !v)}
                      aria-expanded={showSources}
                      aria-controls="sources-panel"
                      className="-mx-2 flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <BookOpen
                        className="h-4 w-4 shrink-0 text-accent-600"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 text-[13px] font-bold tracking-tight text-slate-900">
                        {SOURCES_HEADING[locale]}
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-slate-600">
                        {DISEASE_SOURCES[disease].length}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                          !showSources && "-rotate-90",
                        )}
                        aria-hidden
                      />
                    </button>
                  </h2>

                  {/* Kept mounted and hidden rather than unmounted, so the
                    button's `aria-controls` always resolves to a real element. */}
                  <div id="sources-panel" hidden={!showSources}>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {SOURCES_NOTE[locale]}
                    </p>
                    <ol className="mt-3 border-t border-slate-100">
                      {DISEASE_SOURCES[disease].map((s, idx) => (
                        <li key={s.url} className="border-b border-slate-100">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start gap-2.5 py-3 transition-colors hover:bg-slate-50"
                          >
                            <span className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-semibold leading-snug text-slate-900 transition-colors group-hover:text-accent-700">
                                {s.title}
                              </span>
                              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                                {s.publisher} · {s.year}
                              </span>
                              <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-slate-500 transition-colors group-hover:text-accent-700">
                                {hostnameOf(s.url)}
                                <ExternalLink
                                  className="h-2.5 w-2.5"
                                  aria-hidden
                                />
                              </span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                </section>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
