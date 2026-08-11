import type { SymptomIconName } from "../data/symptomVisuals";

/**
 * Hand-drawn symptom pictures, as inline SVG.
 *
 * Drawn rather than photographed for three reasons: a photograph of night
 * sweats or lost appetite does not exist in any freely-licensed library; a
 * drawing of a symptom is clearer than a photograph of a person having it;
 * and the whole set costs about two kilobytes inside the JS bundle instead
 * of eighteen image requests over mobile data.
 *
 * They share one visual vocabulary so the grid reads as a set: a 24×24 box,
 * round caps and joins, and a single stroke weight. People are drawn as a
 * head circle plus a simple body — enough to read as a person at 48 px
 * without turning into a detailed illustration that stops matching the
 * line-art icons used elsewhere in the app.
 */

/** Each drawing's strokes, in a 24×24 box. */
const PATHS: Record<SymptomIconName, React.ReactNode> = {
  // Head in profile with air pushed out of the mouth.
  cough: (
    <>
      <circle cx="8" cy="6.5" r="3.2" />
      <path d="M3 21v-3.4a5 5 0 0 1 5-5h1.2" />
      <path d="M13.2 8.4c1.1.5 1.7 1.5 1.7 2.5" />
      <path d="M15.6 6c2.1 1 3.2 2.8 3.2 4.9" />
      <path d="M18 3.6c2.9 1.4 4.4 3.8 4.4 6.5" />
    </>
  ),

  // Air pushed out, with a drop falling from it.
  coughBlood: (
    <>
      <circle cx="7.5" cy="6" r="3" />
      <path d="M2.5 21v-3.2a5 5 0 0 1 5-5h1" />
      <path d="M12.4 7.6c1 .5 1.6 1.4 1.6 2.3" />
      <path d="M14.8 5.4c1.9.9 2.9 2.5 2.9 4.4" />
      <path d="M18.5 13.4s-2.7 3.1-2.7 5a2.7 2.7 0 0 0 5.4 0c0-1.9-2.7-5-2.7-5z" />
    </>
  ),

  // Two drops — phlegm coughed up.
  phlegm: (
    <>
      <path d="M8 3.2S4.2 7.6 4.2 10.3a3.8 3.8 0 0 0 7.6 0C11.8 7.6 8 3.2 8 3.2z" />
      <path d="M16.6 11.5s-2.8 3.2-2.8 5.2a2.8 2.8 0 0 0 5.6 0c0-2-2.8-5.2-2.8-5.2z" />
    </>
  ),

  // Chest with a jolt of pain through it.
  chestPain: (
    <>
      <path d="M5.5 4h13v8.6a6.5 6.5 0 0 1-13 0z" />
      <path d="M13.4 6.6 9.8 11.4h2.6l-1 3.8 3.8-4.9h-2.6z" />
    </>
  ),

  // Chest with a band across it and arrows pressing inward. The arrows do
  // the work: a plain line across the chest reads as a lid on a pot.
  chestTight: (
    <>
      <path d="M6.6 4h10.8v8.2a5.4 5.4 0 0 1-10.8 0z" />
      <path d="M6.6 10.2h10.8" />
      <path d="M1.8 10.2h2.8" />
      <path d="m3.6 9.2 1 1-1 1" />
      <path d="M22.2 10.2h-2.8" />
      <path d="m20.4 9.2-1 1 1 1" />
    </>
  ),

  // A pair of lungs.
  breathless: (
    <>
      <path d="M12 3.5v7.8" />
      <path d="M12 11.3c-.6-2.6-2.4-3.7-4-3.7-2.1 0-3.4 1.7-3.4 4.4 0 3.1.9 6.6 3.1 6.6 2.5 0 4.3-2.1 4.3-4.7z" />
      <path d="M12 11.3c.6-2.6 2.4-3.7 4-3.7 2.1 0 3.4 1.7 3.4 4.4 0 3.1-.9 6.6-3.1 6.6-2.5 0-4.3-2.1-4.3-4.7z" />
    </>
  ),

  // Air whistling through narrowed airways.
  wheeze: (
    <>
      <path d="M3 8.5h9.5a3 3 0 1 0-3-3" />
      <path d="M3 13.5h12.5a3 3 0 1 1-3 3" />
      <path d="M3 18.5h6" />
    </>
  ),

  // Thermometer with heat coming off it.
  fever: (
    <>
      <path d="M8.5 13.2V4.8a2.4 2.4 0 1 1 4.8 0v8.4a4.2 4.2 0 1 1-4.8 0z" />
      <path d="M10.9 9.4v4.6" />
      <path d="M17.4 6.2c1.1 1.1 1.1 2.9 0 4" />
      <path d="M20 4c2 2 2 5.2 0 7.2" />
    </>
  ),

  // A person shivering.
  chills: (
    <>
      <circle cx="12" cy="6" r="3" />
      <path d="M8.5 21v-4.2a3.5 3.5 0 0 1 7 0V21" />
      <path d="M4.2 7.4c1 1 1 2.6 0 3.6" />
      <path d="M19.8 7.4c-1 1-1 2.6 0 3.6" />
    </>
  ),

  // Night: a moon with sweat drops.
  nightSweats: (
    <>
      <path d="M21 13.6A8.4 8.4 0 0 1 10.4 3a7.2 7.2 0 1 0 10.6 10.6z" />
      <path d="M5.6 14.4s-1.8 2-1.8 3.2a1.8 1.8 0 0 0 3.6 0c0-1.2-1.8-3.2-1.8-3.2z" />
      <path d="M11.4 17s-1.5 1.7-1.5 2.7a1.5 1.5 0 0 0 3 0c0-1-1.5-2.7-1.5-2.7z" />
    </>
  ),

  // A thinning figure beside a falling arrow.
  weightLoss: (
    <>
      <circle cx="7" cy="5.4" r="2.6" />
      <path d="M4 21v-4.2a3 3 0 0 1 6 0V21" />
      <path d="M17.5 4.5v9.5" />
      <path d="M14 10.5l3.5 3.5 3.5-3.5" />
    </>
  ),

  // An untouched plate.
  appetiteLoss: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="3.4" />
      <path d="M5.5 18.5 18.5 5.5" />
    </>
  ),

  // A figure with arms hanging down.
  fatigue: (
    <>
      <circle cx="12" cy="4.8" r="2.6" />
      <path d="M12 7.6v6.2" />
      <path d="M12 9.8 8.6 13.6" />
      <path d="M12 9.8l3.4 3.8" />
      <path d="M12 13.8 9.6 20.4" />
      <path d="M12 13.8l2.4 6.6" />
    </>
  ),

  // A head with pain radiating off it.
  headache: (
    <>
      <circle cx="12" cy="14" r="5.6" />
      <path d="M12 5.6V3" />
      <path d="M7.4 7 5.9 5.5" />
      <path d="M16.6 7l1.5-1.5" />
    </>
  ),

  // A figure with aches marked at the shoulders.
  bodyAches: (
    <>
      <circle cx="12" cy="4.6" r="2.6" />
      <path d="M12 7.4v6.4" />
      <path d="M8.2 10.4h7.6" />
      <path d="M12 13.8 9.6 20.4" />
      <path d="M12 13.8l2.4 6.6" />
      <path d="M5.6 6.6 4.2 5.2" />
      <path d="M18.4 6.6l1.4-1.4" />
    </>
  ),

  // A head above a raw throat. Without the head the throat alone just reads
  // as a flame.
  soreThroat: (
    <>
      <circle cx="12" cy="4.8" r="2.8" />
      <path d="M9.7 7.4v2.2c0 2.6-1.7 3.4-1.7 6.2a4 4 0 0 0 8 0c0-2.8-1.7-3.6-1.7-6.2V7.4" />
      <path d="M4.2 11.2c.9.9.9 2.5 0 3.4" />
      <path d="M19.8 11.2c-.9.9-.9 2.5 0 3.4" />
    </>
  ),

  // A nose, crossed out.
  senseLoss: (
    <>
      <path d="M14.6 3.6c0 3.2-1 5.2-1 7.2 0 1.6 1 2.2 1 3.8 0 2.1-1.6 3.6-3.7 3.6H9" />
      <path d="M5 19.4 19.4 5" />
    </>
  ),

  // A crab — the source of paragonimiasis. A domed shell with the legs
  // hanging below it: an oval ringed by evenly radiating legs and claws,
  // which is the obvious way to draw this, comes out as a sun.
  rawCrab: (
    <>
      <path d="M4.8 13.4A7.2 6 0 0 1 19.2 13.4Z" />
      <circle cx="10" cy="9.9" r=".8" />
      <circle cx="14" cy="9.9" r=".8" />
      <path d="M5.2 11.8 3 10.2" />
      <path d="M3 10.2 1.7 11.1" />
      <path d="M3 10.2 2.5 8.6" />
      <path d="m18.8 11.8 2.2-1.6" />
      <path d="m21 10.2 1.3.9" />
      <path d="m21 10.2-.5-1.6" />
      <path d="M7.4 13.4 6.1 16.6" />
      <path d="M10.4 13.4 9.9 17" />
      <path d="m13.6 13.4.5 3.6" />
      <path d="m16.6 13.4 1.3 3.2" />
    </>
  ),
};

/**
 * One symptom drawing.
 *
 * Decorative by default — the visible label beside it already carries the
 * meaning, so announcing the picture too would make a screen reader say
 * everything twice.
 */
export function SymptomIcon({
  name,
  className,
}: {
  name: SymptomIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export default SymptomIcon;
