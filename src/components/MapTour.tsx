import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Flame,
  Map as MapIcon,
  Palette,
  Workflow,
  X,
} from "lucide-react";

/**
 * First-visit walkthrough for the landing map. Each step spotlights one part
 * of the map card (found by its `data-tour` attribute) and explains it in
 * plain words: what the map is, where the numbers come from, how to read the
 * colours, and what a red area does — and does not — mean.
 *
 * The spotlight is a box with an enormous outer shadow (`.tour-spot`). The
 * card clips its overflow, so that shadow becomes the dimmed backdrop with a
 * clean cut-out around the target, and it morphs between targets on one CSS
 * transition. A step with no target collapses the cut-out to a point in the
 * middle, so even "dim everything" is the same smooth morph.
 */

export interface MapTourTop {
  name: string;
  count: number;
}

interface Step {
  /** `data-tour` value of the element to spotlight; null dims everything. */
  target: string | null;
  icon: ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  body: ReactNode;
}

const SEEN_KEY = "bantay.mapTourSeen";

export function hasSeenMapTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private browsing / storage disabled — the tour just shows again.
  }
}

/** Step indices the map reacts to with its own effect. */
export const MAP_TOUR_STEP = { welcome: 0, legend: 2, high: 3 } as const;

function buildSteps(top: MapTourTop | null, legendColors: string[]): Step[] {
  return [
    {
      target: "map",
      icon: MapIcon,
      eyebrow: "Welcome",
      title: "This is a live map of TB in Davao City",
      body: (
        <>
          <p>
            Each glowing dot is one <strong className="text-white">barangay</strong>.
            It shows how many people with TB live there, as recorded by the
            city&apos;s health centres.
          </p>
          <p className="mt-2 text-slate-400">
            No names or addresses are shown — only a total per barangay, so no
            patient can be identified.
          </p>
        </>
      ),
    },
    {
      target: null,
      icon: Workflow,
      eyebrow: "How it works",
      title: "Where these numbers come from",
      body: (
        <ol className="relative space-y-3">
          {/* The rail joining the three numbered stages. */}
          <span
            aria-hidden
            className="absolute bottom-3 left-[9.5px] top-3 w-px bg-gradient-to-b from-accent-400/60 via-accent-400/30 to-transparent"
          />
          {[
            "A patient is diagnosed and starts free treatment at a DOTS health centre.",
            "Health workers record the case in BANTAY-TB, under the barangay where the patient lives.",
            "The system adds up the cases per barangay, and this map updates by itself.",
          ].map((text, i) => (
            <li
              key={i}
              className="tour-step-next relative flex gap-3"
              style={{ animationDelay: `${120 + i * 110}ms` }}
            >
              <span className="relative grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-950 font-mono text-[10px] font-bold text-accent-300 ring-1 ring-accent-400/50">
                {i + 1}
              </span>
              <span>{text}</span>
            </li>
          ))}
          <li
            className="tour-step-next pl-8 text-slate-400"
            style={{ animationDelay: "460ms" }}
          >
            Health workers use the same data to find hotspots and follow up
            patients who miss their medicine.
          </li>
        </ol>
      ),
    },
    {
      target: "legend",
      icon: Palette,
      eyebrow: "Reading the map",
      title: "Size and colour show how many cases",
      body: (
        <>
          <div className="mb-3 flex items-end justify-between rounded-xl border border-white/5 bg-white/[0.03] px-5 py-3.5">
            {legendColors.map((c, i) => (
              <span
                key={c}
                className="tour-step-next rounded-full"
                style={{
                  width: 8 + i * 5,
                  height: 8 + i * 5,
                  background: c,
                  boxShadow: `0 0 14px ${c}`,
                  animationDelay: `${i * 80}ms`,
                }}
              />
            ))}
          </div>
          <p>
            Bigger, warmer dots mean more cases.{" "}
            <span className="text-sky-300">Blue</span> is fewer;{" "}
            <span className="text-amber-300">yellow</span>,{" "}
            <span className="text-orange-400">orange</span> and{" "}
            <span className="text-red-400">red</span> are more.
          </p>
          <p className="mt-2 text-slate-400">
            Colours compare barangays with each other — red means close to the
            highest count on the map.
          </p>
        </>
      ),
    },
    {
      target: "top",
      icon: Flame,
      eyebrow: "High-case areas",
      title: "What a red area means",
      body: (
        <>
          {top && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3.5 py-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[9px] uppercase tracking-wider text-red-300/80">
                  Most recorded cases
                </div>
                <div className="truncate text-sm font-semibold text-white">{top.name}</div>
              </div>
              <div className="font-display text-xl font-extrabold tabular-nums text-red-400">
                {top.count.toLocaleString()}
              </div>
            </div>
          )}
          <p>
            A red dot means many people with TB living there have been found and
            are being treated. It does <em>not</em> mean the place is unsafe to
            visit — and barangays with more residents naturally record more
            cases.
          </p>
          <p className="mt-2 text-slate-400">
            Coughing for 2 weeks or more? Get checked — TB testing and treatment
            are free at any DOTS centre.{" "}
            <Link
              to="/dots-locator"
              className="font-semibold text-accent-400 underline-offset-2 hover:text-accent-300 hover:underline"
            >
              Find one near you
            </Link>
          </p>
        </>
      ),
    },
    {
      target: "panel",
      icon: Compass,
      eyebrow: "Your turn",
      title: "Explore your own barangay",
      body: (
        <ul className="space-y-2">
          {[
            "Tap any dot to see its barangay and case count.",
            "Type a barangay name in the search box to jump to it.",
            "Switch years to see how cases changed over time.",
          ].map((text, i) => (
            <li
              key={i}
              className="tour-step-next flex gap-2.5"
              style={{ animationDelay: `${100 + i * 90}ms` }}
            >
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
              {text}
            </li>
          ))}
          <li
            className="tour-step-next hidden gap-2.5 md:flex"
            style={{ animationDelay: "370ms" }}
          >
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" />
            <span>
              Hold{" "}
              <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-px font-mono text-[11px] text-slate-200">
                Ctrl
              </kbd>{" "}
              and scroll to zoom the map.
            </span>
          </li>
        </ul>
      ),
    },
  ];
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function MapTour({
  containerRef,
  step,
  onStep,
  onClose,
  top,
  legendColors,
}: {
  /** The map card — targets are looked up inside it and measured against it. */
  containerRef: RefObject<HTMLElement>;
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
  top: MapTourTop | null;
  legendColors: string[];
}) {
  const steps = buildSteps(top, legendColors);
  const current = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;
  const [rect, setRect] = useState<Rect | null>(null);
  const [hasTarget, setHasTarget] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Which way the content slides: forward steps enter from the right.
  const prevStep = useRef(step);
  const direction = step >= prevStep.current ? "next" : "prev";
  useEffect(() => {
    prevStep.current = step;
  }, [step]);

  function close() {
    markSeen();
    onClose();
  }

  // Measure the spotlight target relative to the card, and keep measuring as
  // the layout shifts (breakpoints, the panel growing with search results).
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const c = container.getBoundingClientRect();
      const el = current.target
        ? container.querySelector<HTMLElement>(`[data-tour="${current.target}"]`)
        : null;
      if (!el) {
        // Collapse to a point mid-card: the backdrop covers everything.
        setHasTarget(false);
        setRect({ top: c.height / 2, left: c.width / 2, width: 0, height: 0 });
        return;
      }
      const r = el.getBoundingClientRect();
      // The map fills the card's edge, so its frame sits just inside it.
      const pad = current.target === "map" ? -10 : 6;
      setHasTarget(true);
      setRect({
        top: r.top - c.top - pad,
        left: r.left - c.left - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, current.target]);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" && !last) onStep(step + 1);
      else if (e.key === "ArrowLeft" && step > 0) onStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // close/onStep are recreated each render; step and last cover the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, last]);

  const Icon = current.icon;
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="absolute inset-0 z-[1200] overflow-hidden">
      {/* Backdrop + cut-out, with its frame. Only the decorations are keyed
          on the target, so they replay per step while the cut-out itself
          keeps morphing smoothly. */}
      {rect && (
        <div
          aria-hidden
          className="tour-spot pointer-events-none absolute"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        >
          <div
            className="tour-spot-ring absolute inset-0"
            style={{ opacity: hasTarget ? 1 : 0 }}
          />
          {hasTarget && (
            <div key={current.target}>
              <div className="tour-spot-ripple absolute inset-0" />
              <span className="tour-corner -left-2 -top-2 rounded-tl-lg border-l-2 border-t-2" />
              <span className="tour-corner -right-2 -top-2 rounded-tr-lg border-r-2 border-t-2" />
              <span className="tour-corner -bottom-2 -left-2 rounded-bl-lg border-b-2 border-l-2" />
              <span className="tour-corner -bottom-2 -right-2 rounded-br-lg border-b-2 border-r-2" />
            </div>
          )}
        </div>
      )}

      {/* Card — pinned to the map's top-left corner, where the "How to read
          this map" button that opened it sits (hidden while the tour runs).
          The map stays visible beside it, and the panel it points at (right
          column from lg, stacked below the map under lg) is never covered.
          On a phone it spans the width with a small gutter. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-start sm:inset-x-auto sm:left-4 sm:top-4">
        <div
          ref={cardRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-labelledby="map-tour-title"
          className="tour-card pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-white/10 bg-brand-950/95 text-sm leading-relaxed text-slate-300 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(52,211,153,0.08)] outline-none backdrop-blur-xl sm:w-[24rem]"
        >
          {/* Progress — a thin gradient rail along the top edge. */}
          <div className="h-[3px] w-full bg-white/5">
            <div
              className="h-full rounded-r-full bg-gradient-to-r from-accent-500 to-accent-300 shadow-[0_0_10px_rgba(52,211,153,0.6)] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Soft glow behind the header. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent-500/15 blur-3xl"
          />

          <div className="relative p-5">
            <div className="flex items-start gap-3.5">
              <span
                key={`icon-${step}`}
                className="tour-card grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent-400/25 bg-gradient-to-br from-accent-500/25 to-accent-500/5 text-accent-300 shadow-[0_0_20px_rgba(52,211,153,0.2)]"
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-400">
                  {current.eyebrow}
                  <span className="text-slate-500">
                    {" "}
                    · {step + 1} of {steps.length}
                  </span>
                </p>
                <h3
                  id="map-tour-title"
                  key={`title-${step}`}
                  className={`tour-step-${direction} font-display mt-1 text-lg font-bold leading-snug tracking-tight text-white`}
                >
                  {current.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close the tour"
                className="-mr-1.5 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Keyed so each step's text slides in from the direction of travel. */}
            <div key={step} className={`tour-step-${direction} mt-3.5`}>
              {current.body}
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-white/5 pt-4">
              <div className="mr-auto flex gap-1.5">
                {steps.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onStep(i)}
                    aria-label={`Go to step ${i + 1}: ${s.eyebrow}`}
                    aria-current={i === step ? "step" : undefined}
                    className={
                      "h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 " +
                      (i === step
                        ? "w-6 bg-accent-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                        : i < step
                          ? "w-1.5 bg-accent-400/50 hover:bg-accent-400/80"
                          : "w-1.5 bg-white/20 hover:bg-white/40")
                    }
                  />
                ))}
              </div>
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => onStep(step - 1)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Skip tour
                </button>
              )}
              <button
                type="button"
                onClick={() => (last ? close() : onStep(step + 1))}
                className="group inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-b from-accent-400 to-accent-500 px-4 text-xs font-bold text-brand-950 shadow-[0_6px_18px_-4px_rgba(16,185,129,0.6)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
              >
                {last ? "Start exploring" : "Next"}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
