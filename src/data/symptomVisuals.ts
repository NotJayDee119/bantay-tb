import type { Locale } from "../lib/i18n";
import type { Disease } from "./healthContent";

/** Which drawing to use for a symptom. The pictures themselves live in
 *  `src/components/SymptomIcon.tsx` — kept apart from this list so the same
 *  drawing can serve several diseases (a fever is a fever) while each disease
 *  keeps its own wording. */
export type SymptomIconName =
  | "cough"
  | "coughBlood"
  | "phlegm"
  | "chestPain"
  | "chestTight"
  | "breathless"
  | "wheeze"
  | "fever"
  | "chills"
  | "nightSweats"
  | "weightLoss"
  | "appetiteLoss"
  | "fatigue"
  | "headache"
  | "bodyAches"
  | "soreThroat"
  | "senseLoss"
  | "rawCrab";

export interface SymptomVisual {
  icon: SymptomIconName;
  /** Short enough to sit under a 48 px drawing on a phone. */
  label: Record<Locale, string>;
  /** The one or two signs that most distinguish this disease — drawn with
   *  emphasis so a reader skimming the grid lands on them first. */
  hallmark?: boolean;
}

/**
 * The symptom pictures for each condition, in the order a patient would
 * notice them.
 *
 * These exist because the education module was colours and text only: a
 * reader looking for "do I have this?" had to parse a run-on sentence of
 * eight symptoms. Drawn as a grid of labelled pictures, they can find
 * themselves in it at a glance — which matters most for the readers who
 * struggle with the paragraph.
 *
 * Wording is kept deliberately plainer than the article prose ("Always
 * tired" rather than "fatigue"), because this grid is often the only part
 * that gets read.
 */
export const DISEASE_SYMPTOMS: Record<Disease, SymptomVisual[]> = {
  tb: [
    {
      icon: "cough",
      hallmark: true,
      label: {
        en: "Cough for 2 weeks or more",
        tl: "Ubong lampas 2 linggo",
        ceb: "Ubo nga molabaw 2 semana",
      },
    },
    {
      icon: "coughBlood",
      hallmark: true,
      label: {
        en: "Cough with blood or phlegm",
        tl: "Ubong may dugo o plema",
        ceb: "Ubo nga may dugo o plema",
      },
    },
    {
      icon: "chestPain",
      label: {
        en: "Chest pain",
        tl: "Sakit sa dibdib",
        ceb: "Kasakit sa dughan",
      },
    },
    {
      icon: "weightLoss",
      label: {
        en: "Losing weight",
        tl: "Pagbaba ng timbang",
        ceb: "Pagniwang",
      },
    },
    {
      icon: "appetiteLoss",
      label: {
        en: "No appetite",
        tl: "Walang ganang kumain",
        ceb: "Wala'y gana mokaon",
      },
    },
    {
      icon: "fever",
      label: { en: "Fever", tl: "Lagnat", ceb: "Hilanat" },
    },
    {
      icon: "nightSweats",
      hallmark: true,
      label: {
        en: "Sweating at night",
        tl: "Pagpapawis sa gabi",
        ceb: "Paghigwaos sa gabii",
      },
    },
    {
      icon: "fatigue",
      label: { en: "Always tired", tl: "Pagkapagod", ceb: "Kakapoy" },
    },
  ],

  pneumonia: [
    {
      icon: "phlegm",
      hallmark: true,
      label: {
        en: "Cough with phlegm",
        tl: "Ubong may plema",
        ceb: "Ubo nga may plema",
      },
    },
    {
      icon: "fever",
      hallmark: true,
      label: { en: "High fever", tl: "Mataas na lagnat", ceb: "Taas nga hilanat" },
    },
    {
      icon: "breathless",
      hallmark: true,
      label: {
        en: "Hard, fast breathing",
        tl: "Mabilis at mahirap na paghinga",
        ceb: "Paspas ug lisod nga pagginhawa",
      },
    },
    {
      icon: "chills",
      label: { en: "Chills, shaking", tl: "Panginginig", ceb: "Pagkurog" },
    },
    {
      icon: "chestPain",
      label: {
        en: "Chest hurts when breathing",
        tl: "Sakit ang dibdib kapag humihinga",
        ceb: "Sakit ang dughan kung magginhawa",
      },
    },
    {
      icon: "fatigue",
      label: { en: "Very weak", tl: "Panghihina", ceb: "Kaluya" },
    },
  ],

  covid19: [
    {
      icon: "fever",
      label: { en: "Fever", tl: "Lagnat", ceb: "Hilanat" },
    },
    {
      icon: "cough",
      label: { en: "Dry cough", tl: "Tuyong ubo", ceb: "Uga nga ubo" },
    },
    {
      icon: "senseLoss",
      hallmark: true,
      label: {
        en: "Lost taste or smell",
        tl: "Nawalang panlasa o pang-amoy",
        ceb: "Nawad-an sa panlasa o panimhot",
      },
    },
    {
      icon: "fatigue",
      label: { en: "Tiredness", tl: "Pagkapagod", ceb: "Kakapoy" },
    },
    {
      icon: "soreThroat",
      label: { en: "Sore throat", tl: "Masakit ang lalamunan", ceb: "Sakit ang tutunlan" },
    },
    {
      icon: "breathless",
      hallmark: true,
      label: {
        en: "Trouble breathing",
        tl: "Hirap huminga",
        ceb: "Lisod magginhawa",
      },
    },
  ],

  influenza: [
    {
      icon: "fever",
      hallmark: true,
      label: {
        en: "Fever that starts suddenly",
        tl: "Biglaang lagnat",
        ceb: "Kalit nga hilanat",
      },
    },
    {
      icon: "bodyAches",
      hallmark: true,
      label: {
        en: "Aching muscles",
        tl: "Pananakit ng katawan",
        ceb: "Sakit sa kaunuran",
      },
    },
    {
      icon: "headache",
      label: { en: "Headache", tl: "Sakit ng ulo", ceb: "Labad sa ulo" },
    },
    {
      icon: "cough",
      label: { en: "Dry cough", tl: "Tuyong ubo", ceb: "Uga nga ubo" },
    },
    {
      icon: "chills",
      label: { en: "Chills", tl: "Panginginig", ceb: "Pagkurog" },
    },
    {
      icon: "fatigue",
      label: { en: "Very tired", tl: "Sobrang pagod", ceb: "Grabe nga kakapoy" },
    },
  ],

  bronchitis: [
    {
      icon: "phlegm",
      hallmark: true,
      label: {
        en: "Cough bringing up mucus",
        tl: "Ubong may plema",
        ceb: "Ubo nga may plema",
      },
    },
    {
      icon: "chestTight",
      label: {
        en: "Chest feels sore",
        tl: "Masakit ang dibdib",
        ceb: "Sakit ang dughan",
      },
    },
    {
      icon: "wheeze",
      label: {
        en: "Whistling breath",
        tl: "Humihuni ang paghinga",
        ceb: "Nagsipol nga pagginhawa",
      },
    },
    {
      icon: "fever",
      label: { en: "Mild fever", tl: "Banayad na lagnat", ceb: "Gamay nga hilanat" },
    },
    {
      icon: "fatigue",
      label: { en: "Tiredness", tl: "Pagkapagod", ceb: "Kakapoy" },
    },
  ],

  copd: [
    {
      icon: "breathless",
      hallmark: true,
      label: {
        en: "Short of breath when moving",
        tl: "Hingal kapag gumagalaw",
        ceb: "Hangak kung molihok",
      },
    },
    {
      icon: "cough",
      hallmark: true,
      label: {
        en: "Cough almost every morning",
        tl: "Ubo halos tuwing umaga",
        ceb: "Ubo halos matag buntag",
      },
    },
    {
      icon: "phlegm",
      label: {
        en: "More phlegm than before",
        tl: "Mas maraming plema",
        ceb: "Mas daghang plema",
      },
    },
    {
      icon: "wheeze",
      label: {
        en: "Whistling breath",
        tl: "Humihuni ang paghinga",
        ceb: "Nagsipol nga pagginhawa",
      },
    },
    {
      icon: "chestTight",
      label: {
        en: "Tight chest",
        tl: "Masikip ang dibdib",
        ceb: "Gipit ang dughan",
      },
    },
  ],

  asthma: [
    {
      icon: "wheeze",
      hallmark: true,
      label: {
        en: "Whistling breath",
        tl: "Humihuni ang paghinga",
        ceb: "Nagsipol nga pagginhawa",
      },
    },
    {
      icon: "breathless",
      hallmark: true,
      label: {
        en: "Short of breath",
        tl: "Hirap huminga",
        ceb: "Lisod magginhawa",
      },
    },
    {
      icon: "chestTight",
      label: {
        en: "Tight chest",
        tl: "Masikip ang dibdib",
        ceb: "Gipit ang dughan",
      },
    },
    {
      icon: "cough",
      label: {
        en: "Cough at night or early morning",
        tl: "Ubo sa gabi o madaling-araw",
        ceb: "Ubo sa gabii o kaadlawon",
      },
    },
  ],

  paragonimiasis: [
    {
      icon: "cough",
      hallmark: true,
      label: {
        en: "Long-lasting cough",
        tl: "Matagalang ubo",
        ceb: "Dugay nga ubo",
      },
    },
    {
      icon: "coughBlood",
      hallmark: true,
      label: {
        en: "Rust-brown or bloody phlegm",
        tl: "Kulay-kalawang o may dugong plema",
        ceb: "Plema nga morag taya o may dugo",
      },
    },
    {
      icon: "chestPain",
      label: {
        en: "Chest pain",
        tl: "Sakit sa dibdib",
        ceb: "Kasakit sa dughan",
      },
    },
    {
      icon: "breathless",
      label: {
        en: "Short of breath",
        tl: "Hirap huminga",
        ceb: "Lisod magginhawa",
      },
    },
    {
      icon: "fever",
      label: { en: "Low fever", tl: "Mahinang lagnat", ceb: "Gamay nga hilanat" },
    },
    {
      icon: "rawCrab",
      hallmark: true,
      label: {
        en: "Ate raw or half-cooked crab",
        tl: "Kumain ng hilaw o kulang sa lutong talangka",
        ceb: "Nakakaon ug hilaw o kulang sa luto nga kasag",
      },
    },
  ],
};

/** Heading above the picture grid. */
export const SYMPTOM_GRID_HEADING: Record<Locale, string> = {
  en: "What it looks like",
  tl: "Ganito ang hitsura",
  ceb: "Mao kini ang panagway",
};

/** Sub-line under the heading. Frames the grid as a prompt to act, not a
 *  self-diagnosis tool. */
export const SYMPTOM_GRID_NOTE: Record<Locale, string> = {
  en: "You do not need all of these. Even one or two is a reason to get checked.",
  tl: "Hindi kailangang lahat ito. Kahit isa o dalawa, dahilan na para magpatingin.",
  ceb: "Dili kinahanglan tanan kini. Bisan usa o duha, rason na aron magpatan-aw.",
};

/** Marks the signs drawn with emphasis. */
export const SYMPTOM_HALLMARK_LABEL: Record<Locale, string> = {
  en: "Watch closely",
  tl: "Bantayan",
  ceb: "Bantayi",
};
