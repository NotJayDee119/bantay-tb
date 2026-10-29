import type { Locale } from "../lib/i18n";

/** Page furniture, translated alongside the articles. A language switcher that
 *  leaves the labels around the text in English undercuts the point of it. */
export const UI = {
  forPatients: {
    en: "For patients & families",
    tl: "Para sa pasyente at pamilya",
    ceb: "Para sa pasyente ug pamilya",
  },
  pageTitle: {
    en: "Health Education",
    tl: "Edukasyong Pangkalusugan",
    ceb: "Edukasyon sa Panglawas",
  },
  pageIntro: {
    en: "Plain-language guides to TB and other chest illnesses — what they are, the signs to watch for, and how they are treated and prevented.",
    tl: "Mga simpleng gabay tungkol sa TB at iba pang sakit sa dibdib — kung ano ito, ang mga sintomas na dapat bantayan, at kung paano ito ginagamot at iniiwasan.",
    ceb: "Yano nga mga giya bahin sa TB ug uban pang sakit sa dughan — unsa kini, ang mga timailhan nga bantayan, ug unsaon kini pagtambal ug paglikay.",
  },
  contents: { en: "Contents", tl: "Nilalaman", ceb: "Sulod" },
  findCenter: {
    en: "Find a DOTS center",
    tl: "Maghanap ng DOTS center",
    ceb: "Pangita ug DOTS center",
  },
  freeNote: {
    en: "TB tests and medicine are free at every DOTS center.",
    tl: "Libre ang TB test at gamot sa bawat DOTS center.",
    ceb: "Libre ang TB test ug tambal sa matag DOTS center.",
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
  // Image viewer. Spoken by screen readers only — the controls themselves are
  // icons, for the same reason the figure's own affordance carries no words.
  viewLarger: {
    en: "View larger",
    tl: "Tingnan nang mas malaki",
    ceb: "Tan-awa nga mas dako",
  },
  zoomIn: { en: "Zoom in", tl: "Palakihin", ceb: "Padakua" },
  zoomOut: { en: "Zoom out", tl: "Paliitin", ceb: "Pagamya" },
  close: { en: "Close", tl: "Isara", ceb: "Isira" },

  // ── Guidebook ─────────────────────────────────────────────────────
  read: { en: "Read", tl: "Basahin", ceb: "Basaha" },
  chapterCount: {
    en: "{n} chapters",
    tl: "{n} kabanata",
    ceb: "{n} ka kapitulo",
  },
  chapterOf: {
    en: "Chapter {n} of {total}",
    tl: "Kabanata {n} ng {total}",
    ceb: "Kapitulo {n} sa {total}",
  },
  allGuides: {
    en: "All guides",
    tl: "Lahat ng gabay",
    ceb: "Tanang giya",
  },
  finished: {
    en: "You finished this guide",
    tl: "Natapos mo ang gabay na ito",
    ceb: "Nahuman nimo kini nga giya",
  },
  finishedBody: {
    en: "Share what you learned with your family and neighbours.",
    tl: "Ibahagi ang iyong natutunan sa pamilya at kapitbahay.",
    ceb: "Ipaambit ang imong nakat-onan sa pamilya ug silingan.",
  },
  readAnother: {
    en: "Read another guide",
    tl: "Magbasa ng iba pang gabay",
    ceb: "Pagbasa ug laing giya",
  },
} satisfies Record<string, Record<Locale, string>>;

export function t(
  key: keyof typeof UI,
  locale: Locale,
  vars?: Record<string, string | number>,
): string {
  let out: string = UI[key][locale];
  for (const [k, v] of Object.entries(vars ?? {}))
    out = out.replace(`{${k}}`, String(v));
  return out;
}

