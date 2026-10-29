import { Suspense } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lock,
  MapPin,
  MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../../components/ui";
import { CaseMapHint } from "../../components/CaseMapHint";
import { SymptomIcon } from "../../components/SymptomIcon";
import { lazyWithPreload } from "../../lib/lazyWithPreload";
import { LoadingSpinner } from "../../components/LazyFallback";
import { usePublicDotsCenterCount } from "../../hooks/usePublicDotsCenterCount";
import { openPublicChat } from "../../lib/publicChat";
import { DISEASE_SYMPTOMS, type SymptomIconName } from "../../data/symptomVisuals";
import heroImage from "../../assets/davao-city-hero.webp";
import ctaImage from "../../assets/dots1.webp";

// The map pulls in Leaflet and MapLibre (over 1 MB). Loading it as its own
// chunk lets the rest of the page paint first instead of waiting on it.
const PublicCaseMap = lazyWithPreload(() => import("../../components/PublicCaseMap"));

const MAP_HEIGHT =
  "h-[22rem] sm:h-[28rem] md:h-[60vh] lg:h-[78vh] lg:min-h-[30rem]";

/** Holds the map's height while its chunk loads, so nothing below jumps.
 *  No frame of its own — just the spinner over the hero background. */
function MapPlaceholder() {
  return (
    <div className={"grid place-items-center " + MAP_HEIGHT}>
      <LoadingSpinner tone="dark" label="Loading map…" />
    </div>
  );
}

/* ── What a visitor came for — one tap each ──────────────────────────── */
type Action = {
  icon: LucideIcon;
  title: string;
  hint: string;
  tint: string;
} & ({ to: string } | { onClick: () => void });

const ACTIONS: Action[] = [
  {
    icon: MapPin,
    title: "Find free treatment",
    hint: "Nearest DOTS center",
    tint: "bg-accent-100 text-accent-700",
    to: "/dots-locator",
  },
  {
    icon: BookOpen,
    title: "Learn about TB",
    hint: "Easy guides",
    tint: "bg-sky-100 text-sky-700",
    to: "/learn",
  },
  {
    icon: MessageCircle,
    title: "Ask a question",
    hint: "Chat now",
    tint: "bg-violet-100 text-violet-700",
    onClick: openPublicChat,
  },
];

/* ── The signs worth getting checked for ─────────────────────────────── */
// Drawn from the same TB symptom set as the Learn guide, so the pictures a
// visitor sees here are the ones they meet again inside it.
const SIGNS: SymptomIconName[] = ["cough", "coughBlood", "nightSweats", "weightLoss"];
const TB_SIGNS = SIGNS.map((icon) => DISEASE_SYMPTOMS.tb.find((s) => s.icon === icon)).filter(
  (s): s is NonNullable<typeof s> => !!s,
);

const STEPS = [
  { title: "Get checked", body: "Free, at any DOTS center." },
  { title: "Start medicine", body: "Free, for 6 months." },
  { title: "Visit regularly", body: "Get your medicine and a check-up." },
  { title: "Finish and get cured", body: "Take every dose until the end." },
];

export function Landing() {
  // No entrance choreography of its own. PublicLayout's page transition
  // already fades every route in; this page used to run a second, longer
  // timeline on top of it — background scaling down from 1.08 over 1.2s, the
  // glow blooming, the map rising 32px, the caption trailing — so the hero
  // arrived in staggered waves for over a second and a half, with the map
  // (the thing a visitor came to look at) moving under a transform while
  // Leaflet was still laying itself out. One fade is the whole entrance now.

  // Live count of the public DOTS directory — the same list the locator shows.
  const { count: centerCount, status: centerStatus } = usePublicDotsCenterCount();

  return (
    <div>
      {/* ─── 1. Hero — full-width live case map ─────────────────────── */}
      <section className="relative overflow-hidden bg-brand-950 text-white">
        {/* midnight-blue city photo + monitoring grid + emerald glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <img src={heroImage} alt="" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-950/70 via-brand-950/40 to-brand-950" />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid" />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 top-[-10%] h-[36rem] w-[36rem] rounded-full bg-accent-500/15 blur-[120px]"
        />

        <div className="relative mx-auto max-w-screen-2xl px-3 py-6 sm:px-5 sm:py-8">
          {/* The page's one heading — short, so the map stays the hero. */}
          <h1 className="mb-3 flex items-center gap-2.5 px-1 font-display text-lg font-bold tracking-tight text-white sm:mb-4 sm:text-2xl">
            <span aria-hidden className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-400" />
            </span>
            Live map of TB cases in Davao City
          </h1>
          {/* The height goes on the map region, not the card: below lg the
              side panel stacks underneath the map and brings its own height. */}
          <Suspense fallback={<MapPlaceholder />}>
            <PublicCaseMap mapClassName={MAP_HEIGHT} />
          </Suspense>
          <p className="mt-3 flex items-start gap-2 px-1 text-xs leading-relaxed text-slate-400 sm:items-center">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-400 sm:mt-0" aria-hidden />
            <span>
              No names are shown — only the number of cases in each barangay.{" "}
              <CaseMapHint className="text-slate-500" />.
            </span>
          </p>
        </div>
      </section>

      {/* ─── 2. What do you need? — three doors, one tap each ──────────── */}
      <section className="bg-slate-50 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <ul className="grid gap-4 sm:grid-cols-3 sm:gap-6">
            {ACTIONS.map((a) => {
              const inner = (
                <>
                  <span
                    className={
                      "grid h-16 w-16 place-items-center rounded-2xl transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none " +
                      a.tint
                    }
                  >
                    <a.icon className="h-8 w-8" aria-hidden />
                  </span>
                  <span className="font-display mt-5 block text-xl font-extrabold leading-tight tracking-tight text-slate-900">
                    {a.title}
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-accent-700">
                    {a.hint}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </>
              );
              const cls =
                "group flex h-full w-full flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-6 py-9 text-center shadow-soft transition duration-200 ease-out hover:-translate-y-1 hover:border-slate-300 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 motion-reduce:transform-none";
              return (
                <li key={a.title}>
                  {"to" in a ? (
                    <Link to={a.to} className={cls}>
                      {inner}
                    </Link>
                  ) : (
                    <button type="button" onClick={a.onClick} className={cls}>
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ─── 3. Do you have these signs? ────────────────────────────── */}
      <section className="border-y border-amber-200/70 bg-amber-50/70 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Do you have these signs?
          </h2>
          <ul className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {TB_SIGNS.map((s) => (
              <li
                key={s.icon}
                className="flex flex-col items-center rounded-3xl border border-amber-200 bg-white px-3 py-6 text-center"
              >
                <span className="grid h-20 w-20 place-items-center rounded-full bg-amber-100 text-amber-800">
                  <SymptomIcon name={s.icon} className="h-12 w-12" />
                </span>
                <span className="mt-4 text-base font-bold leading-snug text-slate-900 [text-wrap:balance] sm:text-lg">
                  {s.label.en}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="max-w-xl text-lg leading-relaxed text-slate-700">
              If you have any of these, <strong className="text-slate-900">get checked</strong>.
              It&rsquo;s free.
            </p>
            <Link to="/dots-locator" className="group/cta">
              <Button variant="accent" size="lg" className="gap-2 text-base">
                Find a DOTS center
                <ArrowRight className="h-5 w-5 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 4. How to get cured — four steps ───────────────────────── */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            How to get cured
          </h2>
          <ol className="relative mx-auto mt-12 grid max-w-md gap-8 lg:max-w-none lg:grid-cols-4 lg:gap-6">
            {/* The line joining the steps: down the side on a phone, across
                on a computer. */}
            <span
              aria-hidden
              className="absolute bottom-6 left-7 top-6 w-0.5 bg-slate-200 lg:bottom-auto lg:left-[12.5%] lg:right-[12.5%] lg:top-7 lg:h-0.5 lg:w-auto"
            />
            {STEPS.map((s, i) => {
              const last = i === STEPS.length - 1;
              return (
                <li
                  key={s.title}
                  className="relative flex items-center gap-5 lg:flex-col lg:gap-0 lg:text-center"
                >
                  <span
                    className={
                      "relative grid h-14 w-14 shrink-0 place-items-center rounded-full font-display text-xl font-extrabold ring-8 ring-white " +
                      (last ? "bg-accent-600 text-white" : "bg-brand-950 text-white")
                    }
                  >
                    {last ? <CheckCircle2 className="h-7 w-7" aria-hidden /> : i + 1}
                  </span>
                  <span className="lg:mt-5">
                    <span className="font-display block text-xl font-bold tracking-tight text-slate-900">
                      {s.title}
                    </span>
                    <span className="mt-1 block text-base text-slate-600">{s.body}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ─── 5. Help is near ────────────────────────────────────────── */}
      <section className="border-t border-slate-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft lg:grid-cols-2">
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <span className="font-display text-7xl font-black leading-none tracking-tight text-brand-950 sm:text-8xl">
                {centerCount !== null
                  ? centerCount.toLocaleString("en-PH")
                  : centerStatus === "loading"
                    ? "…"
                    : "—"}
              </span>
              <h2 className="font-display mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                free DOTS centers in Davao City
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                TB can be cured. The test and the medicine are free — there is
                probably a center close to your home.
              </p>
              <Link to="/dots-locator" className="group/cta mt-7 self-start">
                <Button variant="accent" size="lg" className="gap-2 text-base">
                  Find the nearest one
                  <ArrowRight className="h-5 w-5 transition-transform duration-150 group-hover/cta:translate-x-0.5" />
                </Button>
              </Link>
            </div>
            <div className="relative min-h-[16rem]">
              <img
                src={ctaImage}
                alt="A DOTS treatment center in Davao City"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
