import {
  Activity,
  Bug,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Eye,
  Footprints,
  HandHeart,
  HeartPulse,
  Microscope,
  Moon,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Thermometer,
  Utensils,
  Waves,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Category, Disease } from "../../data/healthContent";

export const DISEASES: Disease[] = [
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
export const CATEGORIES: Category[] = [
  "overview",
  "symptoms",
  "treatment",
  "prevention",
  "lifestyle",
];

export const DISEASE_ICON: Record<Disease, LucideIcon> = {
  tb: Activity,
  pneumonia: Stethoscope,
  covid19: ShieldAlert,
  influenza: Thermometer,
  bronchitis: Waves,
  copd: HeartPulse,
  asthma: Wind,
  paragonimiasis: Bug,
};

/** One icon per section — the fallback glyph for an article's labelled
 *  sub-headings. Kept distinct from `DISEASE_ICON`, which the contents tree
 *  shows on the same screen. */
export const CATEGORY_ICON: Record<Category, LucideIcon> = {
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

export function topicIcon(label: string, fallback: LucideIcon): LucideIcon {
  return TOPIC_ICONS.find((t) => t.match.test(label))?.icon ?? fallback;
}

/** The mark against each checklist item, which carries meaning rather than
 *  decoration: symptoms are things to notice, everything else is something to
 *  do. A reader skimming the amber marks is reading a different kind of list
 *  from one skimming the green ticks. */
export function checklistMark(category: Category): {
  Icon: LucideIcon;
  className: string;
} {
  if (category === "symptoms")
    return { Icon: CircleAlert, className: "text-vigil-600" };
  if (category === "overview")
    return { Icon: ChevronRight, className: "text-slate-400" };
  return { Icon: CheckCircle2, className: "text-accent-600" };
}


/** ~200 words/min, always at least 1 minute. */
export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

/** Lists in the source are written as mid-sentence clauses, so they arrive
 *  lowercase. Once each one is on its own line it reads as a fragment unless
 *  it starts like a sentence. */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
