import type { Locale } from "../lib/i18n";
import type { Category, Disease } from "./healthContent";

/** One picture, as it appears in one article section.
 *
 *  There is exactly one of these per disease + category — 40 in all — and no
 *  two of them share a definition. Editing the picture on COPD's prevention
 *  section changes COPD's prevention section and nothing else.
 *
 *  (This file used to hoist the repeated photographs into shared constants,
 *  which kept it short but meant that eight sections moved together whenever
 *  one of them was touched.) */
export interface ArticleImage {
  /** Either a filename under `public/images/learn/`, or a full URL.
   *
   *  `"tb-symptoms-pia.webp"`        → served from `public/images/learn/`
   *  `"https://example.org/tb.jpg"`  → fetched from that host as-is
   *
   *  An empty string means this section has no picture yet: it renders no
   *  figure at all rather than a broken image, so blank slots are safe to
   *  leave in place until you have something to put in them. */
  src: string;
  /** What the picture shows, for screen readers and broken-image fallback.
   *  Describe the image itself here — the *point* of it goes in `caption`. */
  alt: Record<Locale, string>;
  /** Visible caption, written for the disease being read about. */
  caption: Record<Locale, string>;
  /** Visible credit line. */
  credit: string;
  /** Link to the original record so the credit can be checked. */
  creditUrl?: string;
  /** How the picture meets its frame. Defaults to "cover".
   *
   *  - "cover"   — a photograph. Crops into a wide banner; it is scenery, and
   *                losing its edges costs the reader nothing.
   *  - "contain" — a clinical image. Letterboxed whole against a dark backing,
   *                because cropping a chest X-ray cuts off the lungs and
   *                cropping the micrograph loses its scale bar. The dark
   *                backing reads like a radiologist's lightbox.
   *  - "figure"  — an infographic. This is not scenery, it is text: the reader
   *                is meant to *read* it, so it is never boxed to a ratio at
   *                all. It runs the full width of the column at its own
   *                aspect. Forcing one of these into a 16:9 box throws away
   *                the width that makes its wording legible.
   *
   *  Give "figure" images their intrinsic `width`/`height` below so the
   *  browser reserves the right space before the file arrives. */
  fit?: "cover" | "contain" | "figure";
  /** Intrinsic pixel size, for images rendered at their natural aspect.
   *  Without it a "figure" reflows the page as it loads. */
  width?: number;
  height?: number;
}

/** One article image with its locale already chosen and its `src` resolved to
 *  a URL the browser can use — what the pages actually render. */
export interface ResolvedArticleImage {
  src: string;
  alt: string;
  caption: string;
  credit: string;
  creditUrl?: string;
  fit?: "cover" | "contain" | "figure";
  width?: number;
  height?: number;
}

/** Images are keyed by disease + category rather than by article, because the
 *  same photograph serves all three translations of a section — only its
 *  wording changes. Keying per article would mean maintaining an identical
 *  `src` in triplicate across 120 entries. */
export type ArticleImageKey = `${Disease}:${Category}`;

export function articleImageKey(
  disease: Disease,
  category: Category,
): ArticleImageKey {
  return `${disease}:${category}`;
}

/** Where the browser fetches the picture from.
 *
 *  A bare filename is served out of `public/images/learn/`. Anything already a
 *  URL — `https://…`, or root-relative `/…` — passes through untouched, so a
 *  section can point straight at a hosted image without the file being copied
 *  into the repo first.
 *
 *  Hosted images are convenient but not free: the picture disappears if that
 *  host takes it down, blocks hotlinking, or changes what sits at the URL, and
 *  the reader's browser reveals its IP to that host. For anything meant to
 *  last, download it into `public/images/learn/` and use the filename. */
export function imageUrl(src: string): string {
  return /^(https?:\/\/|\/)/.test(src) ? src : `/images/learn/${src}`;
}

// ─── The pictures ────────────────────────────────────────────────────────────
// Every one was opened and looked at before being committed, and checked
// individually against its source's licence statement. CDC's library mixes
// public-domain and copyright-restricted images, so "it came from CDC" is not
// on its own a clearance.
//
// All forty sections now have their own picture. Nothing is shared between two
// sections any more, and no section is left blank — the SHARED markers and the
// `src: ""` placeholders that used to stand in for both are gone.
//
// They come from three kinds of source, and the difference matters:
//
//   - Government and agency posters (PIA, DOH, WHO, Ospital ng Maynila,
//     Quezon City Health Department) — published for public dissemination,
//     credited by name, and linked to their source record where one exists.
//   - Freely-licensed photographs and clinical images (CDC, Wikimedia,
//     StockSnap, Flickr) — each checked against its own licence statement.
//   - Project artwork, credited "Bantay-TB" — the bronchitis, COPD, asthma,
//     and paragonimiasis sets. These carry no logo, no photographer, and no
//     licence statement, and their style and text errors read as machine-
//     generated. Where one of them says something wrong, the entry says so in
//     a comment and the caption corrects it. Read the paragonimiasis block
//     before touching that topic.
//
// A handful still carry problems that a caption cannot fix, each flagged at
// its own entry: three unlicensed stock images, one watermarked thumbnail, two
// misspellings drawn into artwork, and three posters that draw the wrong
// animal for paragonimiasis.

export const ARTICLE_IMAGES: Record<ArticleImageKey, ArticleImage> = {
  // ─── Tuberculosis ─────────────────────────────────────────────────────────
  // Project artwork, replacing the Philippine Information Agency and ACCESS TB
  // posters this topic used to carry. That trade is worth stating plainly: the
  // set now matches the other seven diseases, and it loses PIA's name from the
  // most important topic in the app. See the note at the top of this file.
  //
  // The treatment poster carries an official-looking seal and a "Kaagapay sa
  // Kalusugan" wordmark; the prevention and lifestyle ones are clean. Nothing
  // here is a real agency's mark — see the warning on `tb:treatment`.
  "tb:overview": {
    src: "tb-overview.webp",
    alt: {
      en: "Illustrated poster headed 'Ano ang tuberculosis?' with a health worker beside five stacked cards in Filipino: what causes it, what it attacks, how it spreads, how it does not spread, and that it is curable.",
      tl: "Nakalarawang poster na may pamagat na 'Ano ang tuberculosis?' na may health worker at limang card: ang sanhi, ang tinatamaan, kung paano kumakalat, kung paano hindi nakukuha, at na ito ay may lunas.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Ano ang tuberculosis?' nga adunay health worker ug lima ka card: ang hinungdan, ang giigo, unsaon kini mokatap, unsaon kini dili makuha, ug nga kini matambalan.",
    },
    caption: {
      en: "TB is an infectious disease caused by the bacterium Mycobacterium tuberculosis. It usually attacks the lungs but can reach other parts of the body — the kidneys, the spine, the brain. It travels through the air when someone with active lung TB coughs, sneezes, or speaks. It is NOT caught by shaking hands or sharing a glass or cutlery. And it is curable, with steady treatment — around six months of it.",
      tl: "Ang TB ay isang nakakahawang sakit na sanhi ng bakteryang Mycobacterium tuberculosis. Karaniwang baga ang tinatamaan ngunit maaari ring makaapekto sa ibang bahagi ng katawan — bato, gulugod, utak. Kumakalat ito sa hangin kapag ang taong may aktibong TB sa baga ay umuubo, bumabahing, o nagsasalita. HINDI ito nakukuha sa pakikipagkamay o paggamit ng baso o kubyertos ng may sakit. At may lunas ito at nagagamot, sa tuloy-tuloy na gamutan — mga anim na buwan.",
      ceb: "Ang TB usa ka makatakod nga sakit tungod sa bakterya nga Mycobacterium tuberculosis. Kasagaran ang baga ang giigo apan mahimo sad nga moabot sa ubang bahin sa lawas — kidney, bukog sa likod, utok. Mokatap kini sa hangin kung ang tawo nga adunay aktibo nga TB sa baga mo-ubo, mobahing, o mosulti. DILI kini makuha sa paglamano o paggamit sa baso o kubyertos sa masakiton. Ug matambalan kini, sa padayon nga tambal — mga unom ka bulan.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "tb:symptoms": {
    src: "tb-symptoms.webp",
    alt: {
      en: "Illustrated poster headed 'Mga sintomas ng TB na dapat bantayan' with a nurse at the centre and six labelled symptom panels around her.",
      tl: "Nakalarawang poster na may pamagat na 'Mga sintomas ng TB na dapat bantayan' na may nars sa gitna at anim na sintomas sa paligid.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Mga sintomas ng TB na dapat bantayan' nga adunay nars sa tunga ug unom ka sintomas sa palibot.",
    },
    caption: {
      en: "The six signs to watch for: a cough lasting more than two weeks, fever with heavy night sweats, chest pain, weakness or fatigue, weight loss with no explanation, and coughing up blood. Consult a doctor or your nearest health centre if you have any of these. The long cough is the most common — but the others matter just as much.",
      tl: "Ang anim na palatandaang dapat bantayan: ubo na tumatagal ng higit sa dalawang linggo, lagnat at matinding pagpapawis sa gabi, sakit sa dibdib, panghihina o pagkapagod, pagbaba ng timbang nang walang dahilan, at ubo na may kasamang dugo. Konsultahin ang doktor o pinakamalapit na health center kung mayroon ka ng mga ito.",
      ceb: "Ang unom ka timailhan nga angay bantayan: ubo nga molungtad ug kapin sa duha ka semana, hilanat ug grabe nga singot sa gabii, sakit sa dughan, kaluya o kakapoy, pagniwang nga walay hinungdan, ug ubo nga may dugo. Pagkonsulta sa doktor o sa pinakaduol nga health center kung aduna ka niini.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "tb:treatment": {
    // UNVERIFIED SEAL — the bottom-right corner carries a circular government-
    // style seal beside a "Kaagapay sa Kalusugan" wordmark. Neither belongs to
    // any agency this project can point to, and the seal's own lettering is
    // unreadable. On a health page, an official-looking crest is a claim of
    // endorsement, and this one backs nothing. It should be painted out.
    //
    // The headline also spells the disease "Tuberkulosis" while the other four
    // posters spell it "Tuberculosis". Both are defensible in Filipino; using
    // both across one topic is not.
    src: "tb-treatment.webp",
    alt: {
      en: "Illustrated poster headed 'Paggamot sa tuberkulosis (TB)' with four numbered steps beside a young woman holding a bottle of medicine in a health centre waiting room.",
      tl: "Nakalarawang poster na may pamagat na 'Paggamot sa tuberkulosis (TB)' na may apat na bilang na hakbang at dalagang may hawak na bote ng gamot sa health center.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Paggamot sa tuberkulosis (TB)' nga adunay upat ka numerado nga lakang ug dalaga nga naggunit ug botelya sa tambal sa health center.",
    },
    caption: {
      en: "Four steps: get tested at once — go to the health centre if you have coughed for two weeks or more; take the medicines every day at the right time and dose; finish the whole 6 to 12 months even after you start feeling well; and keep seeing your barangay health centre for monitoring. Stopping early is what breeds drug-resistant TB.",
      tl: "Apat na hakbang: magpasuri agad — pumunta sa health center kapag may ubo nang dalawang linggo o higit pa; inumin ang mga gamot araw-araw sa tamang oras at dosis; tapusin ang buong 6 hanggang 12 buwan kahit masarap na ang pakiramdam; at bisitahin ang barangay health center para sa regular na monitoring. Ang pagtigil nang maaga ang nagbubunga ng TB na hindi na tinatablan ng gamot.",
      ceb: "Upat ka lakang: pagpasusi dayon — adto sa health center kung nag-ubo na ug duha ka semana o kapin; inoma ang tambal kada adlaw sa hustong oras ug dosis; humana ang tibuok 6 ngadto sa 12 ka bulan bisan maayo na ang imong pamati; ug padayon sa pagbisita sa barangay health center para sa monitoring. Ang paghunong ug sayo mao ang mohatag ug TB nga dili na maayo sa tambal.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "tb:prevention": {
    // Two spelling slips drawn into the artwork: "bintilasyon" for
    // "bentilasyon", twice, and "takpa'n" for "takpan".
    src: "tb-prevention.webp",
    alt: {
      en: "Illustrated poster headed 'Pigilan ang pagkalat ng tuberculosis (TB)' with a nurse at the centre and four panels: finishing the medicine, covering coughs, ventilating the home, and BCG vaccination for children.",
      tl: "Nakalarawang poster na may pamagat na 'Pigilan ang pagkalat ng tuberculosis (TB)' na may nars sa gitna at apat na bahagi: pagtatapos ng gamot, pagtatakip kapag umuubo, bentilasyon sa bahay, at bakunang BCG para sa mga bata.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Pigilan ang pagkalat ng tuberculosis (TB)' nga adunay nars sa tunga ug upat ka bahin: paghuman sa tambal, pagtabon kung mo-ubo, bentilasyon sa balay, ug bakuna nga BCG para sa mga bata.",
    },
    caption: {
      en: "Four ways to stop TB spreading: finish the whole course of medicine — never stop before the doctor says so; cover your mouth and nose when you cough or sneeze, using a tissue, handkerchief, or your elbow, and throw the tissue away properly; keep the house ventilated, with the windows open to fresh air and sunlight; and have children given the BCG vaccine, which protects against the severe forms of TB.",
      tl: "Apat na paraan upang mapigilan ang pagkalat ng TB: tapusin ang buong gamutan — huwag itigil hangga't hindi sinasabi ng doktor; takpan ang bibig at ilong kapag umuubo o bumabahing, gamit ang tisyu, panyo, o siko, at itapon nang maayos ang tisyu; panatilihin ang bentilasyon sa bahay, buksan ang bintana para makapasok ang sariwang hangin at sikat ng araw; at ipabakuna ng BCG ang mga bata, na nagpoprotekta laban sa malubhang uri ng TB.",
      ceb: "Upat ka paagi sa pagpugong sa pagkatap sa TB: humana ang tibuok tambal — ayaw hunonga hangtod dili moingon ang doktor; taboni ang baba ug ilong kung mo-ubo o mobahing, gamit ang tisyu, panyo, o siko, ug ilabay ang tisyu sa hustong paagi; ampingi ang bentilasyon sa balay, ablihi ang bintana para makasulod ang preskong hangin ug sidlak sa adlaw; ug pabakunahi ug BCG ang mga bata, nga manalipod batok sa grabeng matang sa TB.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "tb:lifestyle": {
    // Replaces a Dreamstime stock preview that carried an embedded copyright
    // tag and had never been licensed — so on the licence question this one is
    // a straight improvement.
    src: "tb-lifestyle.webp",
    alt: {
      en: "Illustrated poster headed 'Gumaling sa tuberculosis (TB)!' with three numbered panels: proper food and nutrition, enough sleep and rest, and regular exercise.",
      tl: "Nakalarawang poster na may pamagat na 'Gumaling sa tuberculosis (TB)!' na may tatlong bilang na bahagi: wastong pagkain at nutrisyon, sapat na tulog at pahinga, at regular na ehersisyo.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Gumaling sa tuberculosis (TB)!' nga adunay tulo ka numerado nga bahin: hustong pagkaon ug nutrisyon, igong katulog ug pahulay, ug regular nga ehersisyo.",
    },
    caption: {
      en: "Three things carry the body through months of TB treatment. Food: eat nourishing meals every day, drink 8 or more glasses of water, and go easy on fatty and processed food. Sleep: 7 to 9 hours a night, somewhere comfortable, avoiding exhaustion and stress. Movement: exercise daily, starting gently — walking, stretching — to build the immune system back up.",
      tl: "Tatlong bagay ang nagpapalakas sa katawan sa mga buwan ng paggamot sa TB. Pagkain: kumain ng masusustansyang pagkain araw-araw, uminom ng 8 o higit pang baso ng tubig, at iwasan ang mamantika at processed foods. Tulog: matulog ng 7 hanggang 9 na oras gabi-gabi, sa komportableng tulugan, at iwasan ang pagkapagod at stress. Paggalaw: mag-ehersisyo araw-araw, magsimula sa magagaan na aktibidad — paglalakad, stretching — upang palakasin ang immune system at katawan.",
      ceb: "Tulo ka butang ang mopalig-on sa lawas sa mga bulan sa pagtambal sa TB. Pagkaon: kaon ug masustansyang pagkaon kada adlaw, inom ug 8 o kapin ka baso nga tubig, ug likayi ang tambok ug processed nga pagkaon. Katulog: katulog ug 7 ngadto sa 9 ka oras kada gabii, sa komportableng higdaanan, ug likayi ang kakapoy ug stress. Lihok: mag-ehersisyo kada adlaw, sugdi sa hinay nga kalihokan — paglakaw, stretching — aron molig-on ang immune system ug ang lawas.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── Pneumonia ────────────────────────────────────────────────────────────
  // Project artwork, replacing the Ospital ng Maynila / Dr. Ang posters this
  // topic used to carry, plus one Shutterstock preview and one supplement
  // seller's diagram. On licensing that is a clear gain — two of the five it
  // replaces should never have been here. On authority it is a loss: a Manila
  // city hospital's name no longer appears on any of it.
  //
  // Two spelling faults are drawn into this set. See `overview` and
  // `prevention`; the overview one is a factual error, not just a typo.
  "pneumonia:overview": {
    // WRONG WORD, TWICE — the "Mga sanhi" row lists the causes as "BAKTERYA,
    // BIRA, BIRA, FUNGUS". The intended word is "BIRUS" (virus), it is
    // misspelt, and it is printed twice while bacteria and fungi appear once
    // each. A reader counting the causes off this poster gets four, two of
    // which are the same non-word. The caption below gives the three real
    // ones; the artwork wants redrawing.
    src: "pneumonia-overview.webp",
    alt: {
      en: "Illustrated poster headed 'Ano ang pneumonia?' with two figures either side of a drawing of the lungs, above panels on what it is, what causes it, and its common symptoms.",
      tl: "Nakalarawang poster na may pamagat na 'Ano ang pneumonia?' na may dalawang tao sa magkabilang gilid ng guhit ng baga, at mga bahagi tungkol sa kung ano ito, mga sanhi, at karaniwang sintomas.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Ano ang pneumonia?' nga adunay duha ka tawo sa isigkakilid sa drowing sa baga, ug mga bahin bahin sa unsa kini, mga hinungdan, ug komon nga sintomas.",
    },
    caption: {
      en: "Pneumonia is a serious infection of one or both lungs, inflaming the alveoli — the air sacs. Three things cause it: bacteria, viruses, and fungi. Its common signs are high fever with chills, a cough with phlegm, chest pain, difficulty breathing, and tiredness and weakness. See a doctor as soon as they appear.",
      tl: "Ang pneumonia ay isang seryosong impeksyon sa isa o dalawang baga na nagiging sanhi ng pamamaga ng mga alveoli (air sacs). Tatlo ang sanhi nito: bakterya, birus, at fungus. Ang karaniwang sintomas ay mataas na lagnat at panginginig, ubo na may plema, sakit sa dibdib, hirap sa paghinga, at pagkapagod at panghihina. Kumonsulta agad sa doktor kapag may mga senyales.",
      ceb: "Ang pneumonia usa ka seryoso nga impeksyon sa usa o duha ka baga nga makapamaga sa alveoli (air sacs). Tulo ang hinungdan niini: bakterya, virus, ug fungus. Ang komon nga sintomas mao ang taas nga hilanat ug katugnaw, ubo nga may plema, sakit sa dughan, kalisod sa pagginhawa, ug kakapoy ug kaluya. Pagkonsulta dayon sa doktor kung adunay timailhan.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "pneumonia:symptoms": {
    src: "pneumonia-symptoms.webp",
    alt: {
      en: "Illustrated poster headed 'Mga sintomas ng pneumonia' with a student at the centre and six numbered symptom panels around her.",
      tl: "Nakalarawang poster na may pamagat na 'Mga sintomas ng pneumonia' na may estudyante sa gitna at anim na bilang na sintomas sa paligid.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Mga sintomas ng pneumonia' nga adunay estudyante sa tunga ug unom ka numerado nga sintomas sa palibot.",
    },
    caption: {
      en: "Six signs: a cough with phlegm — yellow, green, or sometimes bloody; high fever with chills and shivering; difficulty breathing, fast or shallow; chest pain when breathing deeply or coughing; heavy tiredness and weakness; and loss of appetite or nausea. Don't ignore pneumonia — get checked early, while it is still easy to treat.",
      tl: "Anim na palatandaan: ubo na may plema — madilaw, luntian, o kung minsan ay dugo; mataas na lagnat at panginginig dahil sa ginaw; nahihirapang huminga, mabilis o mababaw ang paghinga; pananakit ng dibdib kapag humihinga nang malalim o umuubo; matinding pagkapagod at kawalan ng lakas; at kawalan ng gana sa pagkain o pagkahilo. Huwag balewalain ang pneumonia — magpa-checkup para sa tama at maagang lunas.",
      ceb: "Unom ka timailhan: ubo nga may plema — dalag, lunhaw, o usahay dugo; taas nga hilanat ug pangurog tungod sa katugnaw; kalisod sa pagginhawa, paspas o mabaw; sakit sa dughan kung moginhawa ug lawom o mo-ubo; grabe nga kakapoy ug kawalay kusog; ug kawalay gana sa pagkaon o kaluod. Ayaw pasagdi ang pneumonia — pagpa-checkup para sa husto ug sayo nga tambal.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "pneumonia:treatment": {
    // Replaces a 419×280 watermarked Shutterstock preview that had never been
    // licensed and was unreadable at that size — so this slot is much better
    // off than it was.
    src: "pneumonia-treatment.webp",
    alt: {
      en: "Illustrated poster headed 'Pneumonia: pagtutulong at paggamot' with a nurse beside a patient in a hospital bed, and four numbered cards down the right side.",
      tl: "Nakalarawang poster na may pamagat na 'Pneumonia: pagtutulong at paggamot' na may nars sa tabi ng pasyenteng nakahiga sa ospital, at apat na bilang na card sa kanan.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Pneumonia: pagtutulong at paggamot' nga adunay nars tupad sa pasyente sa hospital bed, ug upat ka numerado nga card sa tuo.",
    },
    caption: {
      en: "Four parts to treatment: the right medicine — antibiotics taken exactly as the doctor prescribed; rest and fluids; supportive care — medicine for fever, cough, and phlegm, with oxygen therapy if it is needed; and keeping your check-up appointments. Get seen early. Delay is what turns pneumonia dangerous.",
      tl: "Apat na bahagi ng paggamot: ang tamang gamot — antibiotics ayon sa reseta ng doktor; sapat na pahinga at maraming tubig; suportang pag-aalaga — gamot sa lagnat, ubo, at plema, at oxygen therapy kung kailangan; at pagsunod sa mga check-up appointment. Magpatingin agad. Ang pagpapaliban ang nagpapadelikado sa pneumonia.",
      ceb: "Upat ka bahin sa pagtambal: ang hustong tambal — antibiotics sumala sa reseta sa doktor; igong pahulay ug daghang tubig; suportang pag-atiman — tambal sa hilanat, ubo, ug plema, ug oxygen therapy kung gikinahanglan; ug pagsunod sa mga check-up appointment. Pagpatan-aw dayon. Ang paglangan mao ang makapakuyaw sa pneumonia.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "pneumonia:prevention": {
    // "BAGAA" for "BAGA" — lungs — twice, once in the subtitle and once in the
    // closing line. The headline also glosses the disease as "(PUMONIA)"; the
    // standard Filipino word is "pulmonya".
    src: "pneumonia-prevention.webp",
    alt: {
      en: "Illustrated poster headed 'Pag-iwas sa pneumonia' with a health worker and two children at the centre and four numbered prevention panels around them.",
      tl: "Nakalarawang poster na may pamagat na 'Pag-iwas sa pneumonia' na may health worker at dalawang bata sa gitna at apat na bilang na hakbang sa pag-iwas sa paligid.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Pag-iwas sa pneumonia' nga adunay health worker ug duha ka bata sa tunga ug upat ka numerado nga lakang sa paglikay sa palibot.",
    },
    caption: {
      en: "Four ways to avoid pneumonia: get vaccinated — the flu and pneumococcal vaccines; wash your hands often with soap; eat nourishing food to build the immune system; and cover your coughs and sneezes with your elbow or a tissue so you don't pass it on.",
      tl: "Apat na paraan upang maiwasan ang pneumonia: magpabakuna — laban sa flu at pneumococcus; hugasan ang mga kamay nang madalas gamit ang sabon; kumain ng masustansya upang palakasin ang immune system; at takpan ang ubo at bahing gamit ang siko o tisyu para hindi makahawa.",
      ceb: "Upat ka paagi sa paglikay sa pneumonia: magpabakuna — batok sa trangkaso ug pneumococcus; hugasi ang kamot kanunay gamit ang sabon; kaon ug masustansya aron molig-on ang immune system; ug taboni ang ubo ug bahin gamit ang siko o tisyu aron dili makatakod.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "pneumonia:lifestyle": {
    // Replaces a diagram carrying a supplement seller's own branding
    // ("activz.com") — a vendor's mark on a public health page.
    src: "pneumonia-lifestyle.webp",
    alt: {
      en: "Illustrated poster headed 'Gabay sa pag-recovery mula sa pneumonia' with three numbered columns: enough sleep and rest, proper nutrition, and gentle exercise.",
      tl: "Nakalarawang poster na may pamagat na 'Gabay sa pag-recovery mula sa pneumonia' na may tatlong bilang na hanay: sapat na tulog at pahinga, wastong nutrisyon, at banayad na ehersisyo.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Gabay sa pag-recovery mula sa pneumonia' nga adunay tulo ka numerado nga kolum: igong katulog ug pahulay, hustong nutrisyon, ug hinay nga ehersisyo.",
    },
    caption: {
      en: "Three steps back to strength. Sleep: 7 to 9 hours a night — the body needs it to rebuild the immune system, so avoid late nights and exhaustion. Food: nourishing meals — fruit, vegetables, broth, protein — 8 to 10 glasses of water a day, and go easy on fatty and salty food. Movement: start slowly, try a gentle 5 to 10 minute walk, and don't rush the body — listen to it.",
      tl: "Tatlong hakbang pabalik sa lakas. Tulog: 7 hanggang 9 na oras bawat gabi — kailangan ito ng katawan para makabawi ang immune system, kaya iwasan ang puyat at pagod. Pagkain: masustansyang pagkain — prutas, gulay, sabaw, protina — 8 hanggang 10 baso ng tubig araw-araw, at iwasan ang matataba at maaalat. Paggalaw: unti-unting paggalaw at magaan na ehersisyo, subukan ang mabagal na paglalakad ng 5 hanggang 10 minuto, at huwag biglain ang katawan; pakinggan ito.",
      ceb: "Tulo ka lakang balik sa kusog. Katulog: 7 ngadto sa 9 ka oras kada gabii — gikinahanglan kini sa lawas aron makabawi ang immune system, busa likayi ang pagpuyat ug kakapoy. Pagkaon: masustansyang pagkaon — prutas, utanon, sabaw, protina — 8 ngadto sa 10 ka baso nga tubig kada adlaw, ug likayi ang tambok ug parat. Lihok: hinay-hinay nga paglihok ug gaan nga ehersisyo, sulayi ang hinay nga paglakaw ug 5 ngadto sa 10 ka minuto, ug ayaw daliha ang lawas; paminawa kini.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── COVID-19 ─────────────────────────────────────────────────────────────
  // Project artwork, replacing the WHO Philippines and DOH posters this topic
  // used to carry. Same trade as tuberculosis: a consistent set, at the cost
  // of the World Health Organization's name on the overview.
  //
  // These five are 768×1376 — a phone-story shape, taller and narrower than
  // the 896×1200 posters elsewhere in this file. They render fine, but they
  // sit noticeably taller in the column, and the figure box caps their height
  // rather than their width.
  //
  // The treatment and prevention posters carry small official-looking seals in
  // a bottom corner. As on `tb:treatment`, they belong to no agency this
  // project can name.
  "covid19:overview": {
    src: "covid-overview.webp",
    alt: {
      en: "Illustrated poster headed 'Ano ang COVID-19?' with a masked child leaping above three cards: what causes it, its symptoms, and how to avoid it.",
      tl: "Nakalarawang poster na may pamagat na 'Ano ang COVID-19?' na may batang naka-mask at tatlong card: ang sanhi, ang sintomas, at kung paano maiiwasan.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Ano ang COVID-19?' nga adunay bata nga naka-mask ug tulo ka card: ang hinungdan, ang sintomas, ug unsaon paglikay.",
    },
    caption: {
      en: "COVID-19 is an illness caused by a coronavirus. Its symptoms are fever, cough, and difficulty breathing. It is avoided by washing your hands, wearing a mask, and keeping your distance.",
      tl: "Ang COVID-19 ay isang sakit na dulot ng coronavirus. Ang mga sintomas nito ay lagnat, ubo, at hirap sa paghinga. Naiiwasan ito sa paghuhugas ng kamay, pagsusuot ng mask, at social distancing.",
      ceb: "Ang COVID-19 usa ka sakit tungod sa coronavirus. Ang mga sintomas niini mao ang hilanat, ubo, ug kalisod sa pagginhawa. Malikayan kini pinaagi sa paghugas sa kamot, pagsul-ob ug mask, ug social distancing.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 768,
    height: 1376,
  },
  "covid19:symptoms": {
    src: "covid-symptoms.webp",
    alt: {
      en: "Illustrated poster headed 'Mga sintomas COVID-19' with four labelled panels: cough, fever, tiredness, and difficulty breathing.",
      tl: "Nakalarawang poster na may pamagat na 'Mga sintomas COVID-19' na may apat na bahagi: ubo, lagnat, pagod, at hirap sa paghinga.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Mga sintomas COVID-19' nga adunay upat ka bahin: ubo, hilanat, kakapoy, ug kalisod sa pagginhawa.",
    },
    caption: {
      en: "Four signs: cough, fever, tiredness, and difficulty breathing. Stay safe — consult a doctor if you have any of them.",
      tl: "Apat na palatandaan: ubo, lagnat, pagod, at hirap sa paghinga. Manatiling ligtas — kumunsulta sa doktor kung may mga sintomas.",
      ceb: "Upat ka timailhan: ubo, hilanat, kakapoy, ug kalisod sa pagginhawa. Pabilin nga luwas — pagkonsulta sa doktor kung adunay sintomas.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 768,
    height: 1376,
  },
  "covid19:treatment": {
    // Replaces a crop of a DOH advisory that opened mid-list at item 5, so the
    // reader met a numbered list starting at an orphan "5". This one is whole.
    src: "covid-treatment.webp",
    alt: {
      en: "Illustrated poster headed 'Mga hakbang sa pag-alaga sa COVID-19' with four panels: symptoms, home care, when to consult, and continued precautions.",
      tl: "Nakalarawang poster na may pamagat na 'Mga hakbang sa pag-alaga sa COVID-19' na may apat na bahagi: mga sintomas, pag-aalaga sa bahay, kailan kumunsulta, at patuloy na pag-iingat.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Mga hakbang sa pag-alaga sa COVID-19' nga adunay upat ka bahin: mga sintomas, pag-atiman sa balay, kanus-a mokonsulta, ug padayon nga pag-amping.",
    },
    caption: {
      en: "A guide to care at home. The symptoms: fever, cough, difficulty breathing, loss of taste or smell. At home: rest well, drink plenty of water, eat nourishing food. When to consult: if symptoms are severe, breathing is hard, or the fever will not go — call a doctor or your barangay health worker at once. Keep taking care: wear a mask, wash your hands, and stay out of crowds.",
      tl: "Gabay sa pag-aalaga sa bahay. Ang mga sintomas: lagnat, ubo, hirap sa paghinga, pagkawala ng panlasa o amoy. Sa bahay: magpahinga nang mabuti, uminom ng maraming tubig, kumain ng masusustansyang pagkain. Kailan kumunsulta: kung malala ang sintomas, hirap huminga, o matagal na ang lagnat — tumawag agad sa doktor o BHW. Patuloy na pag-iingat: magsuot ng mask, maghugas ng kamay, at iwasan ang matataong lugar.",
      ceb: "Giya sa pag-atiman sa balay. Ang mga sintomas: hilanat, ubo, kalisod sa pagginhawa, pagkawala sa panlasa o baho. Sa balay: pagpahulay ug maayo, inom ug daghang tubig, kaon ug masustansyang pagkaon. Kanus-a mokonsulta: kung grabe ang sintomas, maglisod sa pagginhawa, o dugay na ang hilanat — tawag dayon sa doktor o BHW. Padayon nga pag-amping: magsul-ob ug mask, hugasi ang kamot, ug likayi ang tawhanong lugar.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 768,
    height: 1376,
  },
  "covid19:prevention": {
    src: "covid-prevention.webp",
    alt: {
      en: "Illustrated poster headed 'Paano maiiwasan COVID-19' with four circular panels: wear a face mask, wash your hands, keep social distance, and cover your coughs and sneezes.",
      tl: "Nakalarawang poster na may pamagat na 'Paano maiiwasan COVID-19' na may apat na bilog: magsuot ng face mask, maghugas ng kamay, panatilihin ang social distancing, at takpan ang ubo at bahin.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Paano maiiwasan COVID-19' nga adunay upat ka lingin: magsul-ob ug face mask, hugasi ang kamot, hupti ang social distancing, ug taboni ang ubo ug bahin.",
    },
    caption: {
      en: "Four ways to avoid COVID-19: wear a face mask, wash your hands, keep your distance from others, and cover your coughs and sneezes.",
      tl: "Apat na paraan sa pag-iwas sa COVID-19: magsuot ng face mask, maghugas ng kamay, panatilihin ang social distancing, at takpan ang ubo at bahin.",
      ceb: "Upat ka paagi sa paglikay sa COVID-19: magsul-ob ug face mask, hugasi ang kamot, hupti ang gilay-on sa uban, ug taboni ang ubo ug bahin.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 768,
    height: 1376,
  },
  "covid19:lifestyle": {
    // Replaces an image taken from a Google Images thumbnail proxy, whose
    // artist was unknown and whose credit line therefore named no one.
    src: "covid-lifestyle.webp",
    alt: {
      en: "Illustrated poster headed 'Gabay sa pag-recover mula sa COVID-19' with three stacked panels: drink plenty of water, sleep soundly, and return to activity gradually over one to two weeks.",
      tl: "Nakalarawang poster na may pamagat na 'Gabay sa pag-recover mula sa COVID-19' na may tatlong bahagi: uminom ng maraming tubig, matulog nang mahimbing, at dahan-dahang bumalik sa gawain sa loob ng 1 hanggang 2 linggo.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Gabay sa pag-recover mula sa COVID-19' nga adunay tulo ka bahin: inom ug daghang tubig, katulog ug maayo, ug hinay-hinay nga pagbalik sa buluhaton sulod sa 1 ngadto sa 2 ka semana.",
    },
    caption: {
      en: "Three things while you recover: drink plenty of water, sleep soundly, and come back to your usual activity gradually, over one to two weeks. Nourishing food, sleep, and a slow return to activity help the body recover — and ease long COVID symptoms.",
      tl: "Tatlong bagay habang gumagaling: uminom ng maraming tubig, matulog nang mahimbing, at dahan-dahang bumalik sa dating gawain sa loob ng isa hanggang dalawang linggo. Ang masustansyang pagkain, tulog, at unti-unting pagbalik sa gawain ay tumutulong sa paggaling at sa long COVID.",
      ceb: "Tulo ka butang samtang nagkaayo: inom ug daghang tubig, katulog ug maayo, ug hinay-hinay nga pagbalik sa naandan nga buluhaton sulod sa usa ngadto sa duha ka semana. Ang maayong pagkaon, katulog, ug hinay nga pagbalik sa buluhaton motabang sa pagkaayo ug sa long COVID.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 768,
    height: 1376,
  },

  // ─── Influenza ────────────────────────────────────────────────────────────
  // Project artwork, replacing the Quezon City Health Department posters this
  // topic carried until now, and the wikiHow sleep drawing on `lifestyle`.
  // The wikiHow image was CC BY-NC-SA, so its non-commercial condition is gone
  // with it; QC's name is gone too. Same 768×1376 phone-story shape as COVID.
  //
  // The prevention poster carries small official-looking seals in the bottom
  // corner, belonging to no agency this project can name — as on
  // `tb:treatment` and `covid19:treatment`.
  "influenza:overview": {
    src: "influenza-overview.webp",
    alt: {
      en: "Illustrated poster headed 'Ano ang influenza (flu)?' with a small figure in a lab coat at the centre and four cards: what it is, how it spreads, its common symptoms, and how to avoid it.",
      tl: "Nakalarawang poster na may pamagat na 'Ano ang influenza (flu)?' na may maliit na tauhang naka-lab coat sa gitna at apat na card: kung ano ito, paano kumakalat, karaniwang sintomas, at pag-iwas.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Ano ang influenza (flu)?' nga adunay gamay nga tawo nga naka-lab coat sa tunga ug upat ka card: unsa kini, unsaon pagkatap, komon nga sintomas, ug paglikay.",
    },
    caption: {
      en: "Flu is an infection caused by a virus that affects the lungs, nose, and throat. It spreads easily through the air, by coughing and sneezing. Its common symptoms are high fever, cough, headache, and heavy tiredness. To avoid it: wash your hands, get vaccinated, and cover your mouth when you cough. See a doctor if the symptoms are severe.",
      tl: "Ang trangkaso ay impeksiyon na dulot ng virus na nakakaapekto sa baga, ilong, at lalamunan. Madaling makahawa sa pamamagitan ng hangin — ubo at bahin. Ang mga karaniwang sintomas ay mataas na lagnat, ubo, sakit ng ulo, at matinding pagod. Pag-iwas: maghugas ng kamay, magpabakuna, takpan ang bibig kapag umuubo. Konsultahin ang doktor kung may malubhang sintomas.",
      ceb: "Ang trangkaso usa ka impeksyon tungod sa virus nga moigo sa baga, ilong, ug tutunlan. Sayon kini makatakod pinaagi sa hangin — ubo ug bahin. Ang komon nga sintomas mao ang taas nga hilanat, ubo, labad sa ulo, ug grabe nga kakapoy. Paglikay: hugasi ang kamot, magpabakuna, taboni ang baba kung mo-ubo. Pagkonsulta sa doktor kung grabe ang sintomas.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 768,
    height: 1376,
  },
  "influenza:symptoms": {
    src: "influenza-symptoms.webp",
    alt: {
      en: "Illustrated poster headed 'Trangkaso (flu): sintomas ng trangkaso' with a child holding a thermometer above six labelled panels.",
      tl: "Nakalarawang poster na may pamagat na 'Trangkaso (flu): sintomas ng trangkaso' na may batang may termometro at anim na bahagi.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Trangkaso (flu): sintomas ng trangkaso' nga adunay bata nga may termometro ug unom ka bahin.",
    },
    caption: {
      en: "Six signs: fever, cough, sore throat, a runny or blocked nose, body aches, and headache. Flu tends to arrive all at once, within a day, rather than creeping up. Take care and rest.",
      tl: "Anim na palatandaan: lagnat, ubo, pananakit ng lalamunan, sipon o baradong ilong, pananakit ng katawan, at sakit ng ulo. Biglaan ang pagdating ng trangkaso, sa loob ng isang araw, hindi unti-unti. Mag-ingat at magpahinga.",
      ceb: "Unom ka timailhan: hilanat, ubo, sakit sa tutunlan, sip-on o barado nga ilong, sakit sa lawas, ug labad sa ulo. Kalit ang pag-abot sa trangkaso, sulod sa usa ka adlaw, dili hinay-hinay. Pag-amping ug pagpahulay.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 768,
    height: 1376,
  },
  "influenza:treatment": {
    // LEAKED INSTRUCTION IN THE ARTWORK — the footer reads "Isang paalala para
    // sa kalusugan. Tagalog Only Poster." That second sentence is a direction
    // to whatever drew the poster, printed onto the poster itself. It is not
    // health advice, it is not addressed to the reader, and it should not be
    // on a page anyone is asked to trust. Paint it out.
    src: "influenza-treatment.webp",
    alt: {
      en: "Illustrated poster headed 'Trangkaso (flu) paggamot' with four panels: rest and sleep, water and broth, medicine as prescribed, and consulting a doctor if it worsens.",
      tl: "Nakalarawang poster na may pamagat na 'Trangkaso (flu) paggamot' na may apat na bahagi: pahinga at tulog, tubig at sabaw, gamot ayon sa reseta, at pagkonsulta sa doktor kung lumala.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Trangkaso (flu) paggamot' nga adunay upat ka bahin: pahulay ug katulog, tubig ug sabaw, tambal sumala sa reseta, ug pagkonsulta sa doktor kung mograbe.",
    },
    caption: {
      en: "Rest and sleep enough, drink plenty of water and broth, take medicine — paracetamol or ibuprofen — as prescribed, and consult a doctor if it turns severe. Antivirals help most when started in the first two days, which is why going early matters.",
      tl: "Magpahinga at matulog nang sapat, uminom ng maraming tubig at sabaw, uminom ng gamot — paracetamol o ibuprofen — ayon sa reseta, at magpakonsulta sa doktor kung lumala. Pinakamabisa ang antiviral kapag sinimulan sa unang dalawang araw, kaya mahalaga ang maagang pagpapatingin.",
      ceb: "Pagpahulay ug katulog ug igo, inom ug daghang tubig ug sabaw, inom ug tambal — paracetamol o ibuprofen — sumala sa reseta, ug pagkonsulta sa doktor kung mograbe. Labing epektibo ang antiviral kung sugdan sa unang duha ka adlaw, mao nga importante ang sayo nga pagpatan-aw.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 768,
    height: 1376,
  },
  "influenza:prevention": {
    src: "influenza-prevention.webp",
    alt: {
      en: "Illustrated poster headed 'Iwasan ang trangkaso (flu)' with four panels: washing hands, covering coughs and sneezes, eating well and sleeping enough, and keeping your distance.",
      tl: "Nakalarawang poster na may pamagat na 'Iwasan ang trangkaso (flu)' na may apat na bahagi: paghuhugas ng kamay, pagtatakip kapag umuubo o bumabahin, masustansyang pagkain at sapat na tulog, at pagpapanatili ng distansya.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Iwasan ang trangkaso (flu)' nga adunay upat ka bahin: paghugas sa kamot, pagtabon kung mo-ubo o mobahin, masustansyang pagkaon ug igong katulog, ug paghupot sa gilay-on.",
    },
    caption: {
      en: "Four ways to avoid flu: wash your hands, cover your mouth when you cough or sneeze and bin the tissue, eat nourishing food and sleep enough, and keep your distance from others. A yearly flu shot on top of these is the most reliable protection, especially for elders and children.",
      tl: "Apat na paraan sa pag-iwas sa trangkaso: maghugas ng kamay, magtakip ng bibig kapag umuubo o bumabahin at itapon ang tisyu, kumain ng masustansya at matulog nang sapat, at panatilihin ang distansya. Ang taunang bakuna sa trangkaso kasama ng mga ito ang pinakamaaasahang proteksyon, lalo na sa matatanda at bata.",
      ceb: "Upat ka paagi sa paglikay sa trangkaso: hugasi ang kamot, taboni ang baba kung mo-ubo o mobahin ug ilabay ang tisyu, kaon ug masustansya ug katulog ug igo, ug hupti ang gilay-on sa uban. Ang tinuig nga bakuna sa trangkaso uban niini mao ang labing kasaligan nga proteksyon, ilabi na sa tigulang ug bata.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 768,
    height: 1376,
  },
  "influenza:lifestyle": {
    // GARBLED FOOTER — the closing bar reads "TRANGKASO  Mabilis na (Flu)",
    // with the words of the heading shuffled out of order. The three panels
    // above it are fine; the bar under them is word salad and wants redrawing.
    src: "influenza-lifestyle.webp",
    alt: {
      en: "Illustrated poster headed 'Trangkaso (flu): mga paraan sa mabilis na paggaling' with three panels: enough sleep, drinking plenty of water, and nourishing food.",
      tl: "Nakalarawang poster na may pamagat na 'Trangkaso (flu): mga paraan sa mabilis na paggaling' na may tatlong bahagi: sapat na tulog, pag-inom ng maraming tubig, at masustansyang pagkain.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Trangkaso (flu): mga paraan sa mabilis na paggaling' nga adunay tulo ka bahin: igong katulog, pag-inom ug daghang tubig, ug masustansyang pagkaon.",
    },
    caption: {
      en: "Enough sleep, plenty of water, and nourishing food are what speed recovery. Stay home while the fever lasts, drink plenty, and eat what you can — flu wears the body down quickly.",
      tl: "Ang sapat na tulog, pag-inom ng tubig, at masustansyang pagkain ay nakakatulong sa mabilis na paggaling. Manatili sa bahay habang may lagnat, uminom nang marami, at kumain ng kaya — mabilis manghina ang katawan sa trangkaso.",
      ceb: "Ang igong katulog, pag-inom ug tubig, ug masustansyang pagkaon makatabang sa paspas nga pagkaayo. Pabilin sa balay samtang naghilanat, pag-inom ug daghan, ug pagkaon sa imong makaya — paspas maluya ang lawas sa trangkaso.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 768,
    height: 1376,
  },

  // ─── Bronchitis ───────────────────────────────────────────────────────────
  // These five are project artwork, supplied for this topic rather than sourced
  // from a publisher: they carry no agency logo, no photographer, and no licence
  // statement, and their style and small text errors read as machine-generated.
  // `credit` names Bantay-TB because that is honestly where they came from —
  // if any of them in fact originated elsewhere, the real source belongs here.
  //
  // Two carry a misspelling drawn into the artwork, which no caption can fix:
  // the lifestyle poster's headline reads "BONCHITIS", and the prevention
  // poster's reads "BRONKITIS". See the notes on those two entries.
  //
  // Their wording is in Filipino; the English and Cebuano `alt`/`caption`
  // carry it, as with the government posters elsewhere in this file.
  "bronchitis:overview": {
    // Fills a slot that was empty — there was no picture of inflamed bronchial
    // tubes before this.
    src: "bronchitis-overview.webp",
    alt: {
      en: "Illustrated poster headed 'Ano ang bronchitis?': a figure in a lab coat points at reddened, inflamed bronchial tubes, above three symptom panels and a row of remedies.",
      tl: "Nakalarawang poster na may pamagat na 'Ano ang bronchitis?': may nakabatang lab coat na nakaturo sa namamagang bronchial tubes, may tatlong sintomas at hanay ng lunas sa ibaba.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Ano ang bronchitis?': adunay nagsul-ob ug lab coat nga nagtudlo sa namaga nga bronchial tubes, uban sa tulo ka sintomas ug laray sa tambal sa ubos.",
    },
    caption: {
      en: "Bronchitis is inflammation of the bronchial tubes — the airways that carry air into the lungs — brought on by an infection or an irritant. It shows as cough, difficulty breathing, and weakness. Rest, plenty of water, and staying away from smoke are what help.",
      tl: "Ang bronchitis ay pamamaga ng mga bronchial tubes — ang daanan ng hangin papunta sa baga — na dulot ng impeksyon o irritant. Nagpapakita ito sa pag-ubo, hirap sa paghinga, at panghihina. Ang pahinga, pag-inom ng maraming tubig, at pag-iwas sa usok ang nakatutulong.",
      ceb: "Ang bronchitis mao ang pamaga sa bronchial tubes — ang agianan sa hangin padulong sa baga — tungod sa impeksyon o irritant. Makita kini sa ubo, kalisod sa pagginhawa, ug kaluya. Ang pahulay, pag-inom ug daghang tubig, ug paglikay sa aso mao ang makatabang.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "bronchitis:symptoms": {
    src: "bronchitis-symptoms.webp",
    alt: {
      en: "Illustrated poster headed 'Mga sintomas ng bronchitis' with a boy blowing his nose at the centre and four labelled symptom panels around him.",
      tl: "Nakalarawang poster na may pamagat na 'Mga sintomas ng bronchitis' na may batang nagsisinga sa gitna at apat na sintomas sa paligid.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Mga sintomas ng bronchitis' nga adunay bata nga nagsinga sa tunga ug upat ka sintomas sa palibot.",
    },
    caption: {
      en: "The signs of bronchitis: coughing, tightness in the chest, difficulty breathing, and tiredness with fever. The cough is the one that lingers — it often stays for weeks after everything else has passed.",
      tl: "Ang mga sintomas ng bronchitis: pag-uubo, paninikip ng dibdib, hirap sa paghinga, at pagkapagod at lagnat. Ang ubo ang pinakamatagal — madalas itong nananatili nang ilang linggo matapos mawala ang iba.",
      ceb: "Ang mga sintomas sa bronchitis: pag-ubo, paghugot sa dughan, kalisod sa pagginhawa, ug kakapoy ug hilanat. Ang ubo ang labing dugay — kasagaran magpabilin kini ug pipila ka semana human mawala ang uban.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "bronchitis:treatment": {
    // The only one of the five with no text error in the artwork, and its five
    // points are sound: acute bronchitis is treated supportively, with
    // medicine only where a doctor has prescribed it.
    src: "bronchitis-treatment.webp",
    alt: {
      en: "Illustrated poster headed 'Paggamot sa Bronchitis' showing two children wrapped in blankets beside a humidifier, above a list of five steps in Filipino.",
      tl: "Nakalarawang poster na may pamagat na 'Paggamot sa Bronchitis' na may dalawang batang nakakumot sa tabi ng humidifier, at limang hakbang sa ibaba.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Paggamot sa Bronchitis' nga adunay duha ka bata nga nagkumot tupad sa humidifier, ug lima ka lakang sa ubos.",
    },
    caption: {
      en: "Acute bronchitis usually clears on its own: rest, drink plenty of water, use a humidifier, stay away from smoke, and take medicine only where it has been prescribed. See a doctor if the cough lasts beyond three weeks or brings a fever.",
      tl: "Karaniwang gumagaling nang kusa ang acute bronchitis: magpahinga, uminom ng maraming tubig, gumamit ng humidifier, iwasan ang usok, at uminom ng gamot kung inireseta lamang. Magpatingin kung lumagpas sa tatlong linggo ang ubo o may lagnat.",
      ceb: "Kasagaran maayo ra ang acute bronchitis: pagpahulay, pag-inom ug daghang tubig, paggamit ug humidifier, paglikay sa aso, ug pag-inom ug tambal kung gireseta lamang. Pagpatan-aw kung molapas ug tulo ka semana ang ubo o adunay hilanat.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "bronchitis:prevention": {
    // The headline spells it "BRONKITIS" — a Filipinised spelling rather than
    // an outright error, but it does not match the other four posters, which
    // all use "BRONCHITIS".
    src: "bronchitis-prevention.webp",
    alt: {
      en: "Illustrated poster headed 'Pag-iwas sa bronkitis' with four circular panels: washing hands, wearing a mask, refusing cigarettes, and jogging with a basket of fruit.",
      tl: "Nakalarawang poster na may pamagat na 'Pag-iwas sa bronkitis' na may apat na bilog: paghuhugas ng kamay, pagsusuot ng mask, pagtanggi sa sigarilyo, at pag-jogging na may basket ng prutas.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Pag-iwas sa bronkitis' nga adunay upat ka lingin: paghugas sa kamot, pagsul-ob ug mask, pagbalibad sa sigarilyo, ug pagdagan nga may basket sa prutas.",
    },
    caption: {
      en: "Four ways to avoid bronchitis: wash your hands, wear a mask in crowds, keep away from cigarettes, and live healthily. Smoke is the single biggest irritant to the airways, so staying clear of it — your own and other people's — matters most of the four.",
      tl: "Apat na paraan sa pag-iwas sa bronchitis: maghugas ng kamay, magsuot ng mask sa matataong lugar, iwasan ang paninigarilyo, at mamuhay nang malusog. Ang usok ang pinakamalaking nakaiirita sa daanan ng hangin, kaya ang pag-iwas dito — sa sarili at sa iba — ang pinakamahalaga sa apat.",
      ceb: "Upat ka paagi sa paglikay sa bronchitis: paghugas sa kamot, pagsul-ob ug mask sa tawhanong lugar, paglikay sa panigarilyo, ug maayong pagkinabuhi. Ang aso mao ang labing dako nga makapasuko sa agianan sa hangin, busa ang paglikay niini — sa kaugalingon ug sa uban — mao ang labing importante sa upat.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "bronchitis:lifestyle": {
    // TWO PROBLEMS IN THE ARTWORK, both needing a redraw rather than a caption:
    // the headline misspells the disease as "BONCHITIS", and it calls itself a
    // treatment guide ("Gabay sa pag-gamot") while sitting on the sleep,
    // nutrition, and exercise section. Its three panels — water, sleep, and
    // breathing exercises — do belong here, which is why it is used as it is.
    src: "bronchitis-lifestyle.webp",
    alt: {
      en: "Illustrated poster of a child in a hooded top sitting on a cloud, above three panels: drinking enough water, enough sleep and rest, and breathing exercises.",
      tl: "Nakalarawang poster ng batang nakahood na nakaupo sa ulap, may tatlong bahagi sa ibaba: sapat na pag-inom ng tubig, sapat na tulog at pahinga, at mga ehersisyo sa paghinga.",
      ceb: "Gidrowing nga poster sa bata nga naka-hoodie nga naglingkod sa panganod, adunay tulo ka bahin sa ubos: igong pag-inom ug tubig, igong katulog ug pahulay, ug mga ehersisyo sa pagginhawa.",
    },
    caption: {
      en: "Three things speed recovery: drinking enough water, which loosens the phlegm; enough sleep and rest; and breathing exercises. Warm drinks and clean indoor air ease the cough while the airways settle.",
      tl: "Tatlong bagay ang nagpapabilis ng paggaling: sapat na pag-inom ng tubig, na nagpapalabnaw sa plema; sapat na tulog at pahinga; at mga ehersisyo sa paghinga. Ang maiinit na inumin at malinis na hangin sa loob ay nagpapagaan sa ubo habang gumagaling.",
      ceb: "Tulo ka butang ang makapapaspas sa pagkaayo: igong pag-inom ug tubig, nga makapanipis sa plema; igong katulog ug pahulay; ug mga ehersisyo sa pagginhawa. Ang init nga ilimnon ug limpyo nga hangin sa sulod makapagaan sa ubo samtang nagkaayo.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── COPD ─────────────────────────────────────────────────────────────────
  // Project artwork, same provenance as the bronchitis set above: no logo, no
  // photographer, no licence statement. `credit` names Bantay-TB for the same
  // reason. No misspellings in this set; the treatment poster's headline does
  // read "Paggamot sa COPD / Treatment", which says the same word twice in two
  // languages, but nothing on it is wrong.
  "copd:overview": {
    // Fills a slot that was empty — there was no picture of the disease at all
    // before this.
    src: "copd-overview.webp",
    alt: {
      en: "Illustrated poster headed 'Ano ang COPD? (Chronic Obstructive Pulmonary Disease)' with three panels: causes, symptoms, and prevention and management.",
      tl: "Nakalarawang poster na may pamagat na 'Ano ang COPD? (Chronic Obstructive Pulmonary Disease)' na may tatlong bahagi: mga sanhi, mga sintomas, at pag-iwas at pamamahala.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Ano ang COPD? (Chronic Obstructive Pulmonary Disease)' nga adunay tulo ka bahin: mga hinungdan, mga sintomas, ug paglikay ug pagdumala.",
    },
    caption: {
      en: "COPD is a lung disease that makes breathing hard. Smoking and air pollution cause it; it shows as a cough with phlegm, wheezing, and breathlessness. Stopping smoking, exercising, eating well, and seeing a doctor are what hold it back.",
      tl: "Ang COPD ay sakit sa baga na nagpapahirap sa paghinga. Ang paninigarilyo at polusyon sa hangin ang sanhi; nagpapakita ito sa ubo na may plema, huni sa dibdib, at hingal. Ang pagtigil sa paninigarilyo, pag-eehersisyo, wastong pagkain, at pagkonsulta sa doktor ang pumipigil dito.",
      ceb: "Ang COPD usa ka sakit sa baga nga makapalisod sa pagginhawa. Ang panigarilyo ug polusyon sa hangin mao ang hinungdan; makita kini sa ubo nga may plema, huni sa dughan, ug hangak. Ang paghunong sa panigarilyo, ehersisyo, hustong pagkaon, ug pagkonsulta sa doktor mao ang makapugong niini.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "copd:symptoms": {
    src: "copd-symptoms.webp",
    alt: {
      en: "Illustrated poster headed 'COPD: mga sintomas na dapat bantayan' with five labelled panels around a figure holding a sign reading 'Mga sintomas'.",
      tl: "Nakalarawang poster na may pamagat na 'COPD: mga sintomas na dapat bantayan' na may limang bahagi sa paligid ng batang may hawak na karatulang 'Mga sintomas'.",
      ceb: "Gidrowing nga poster nga giulohan ug 'COPD: mga sintomas na dapat bantayan' nga adunay lima ka bahin palibot sa bata nga naggunit ug karatula nga 'Mga sintomas'.",
    },
    caption: {
      en: "The signs to watch for: wheezing, a cough that keeps coming back, breathlessness — especially during activity — tightness in the chest, and tiring easily. COPD builds slowly, over years, which is why the change is easy to miss until it is well along.",
      tl: "Ang mga sintomas na dapat bantayan: huni sa dibdib, paulit-ulit na ubo, kapos sa paghinga lalo na sa aktibidad, paninikip ng dibdib, at madaling mapagod. Dahan-dahan lumalala ang COPD sa paglipas ng taon, kaya madaling hindi mapansin hanggang malubha na.",
      ceb: "Ang mga sintomas nga angay bantayan: huni sa dughan, balik-balik nga ubo, kapos sa pagginhawa ilabi na sa lihok, paghugot sa dughan, ug daling kapoyan. Hinay-hinay nga mograbe ang COPD sa mga tuig, mao nga sayon kini dili mamatikdan hangtod grabe na.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "copd:treatment": {
    src: "copd-treatment.webp",
    alt: {
      en: "Illustrated poster headed 'Paggamot sa COPD' with four panels around a doctor: inhaler use, oxygen therapy, pulmonary rehabilitation, and healthy living.",
      tl: "Nakalarawang poster na may pamagat na 'Paggamot sa COPD' na may apat na bahagi sa paligid ng doktor: paggamit ng inhaler, terapiyang oxygen, rehabilitasyon sa baga, at malusog na pamumuhay.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Paggamot sa COPD' nga adunay upat ka bahin palibot sa doktor: paggamit ug inhaler, terapiya sa oxygen, rehabilitasyon sa baga, ug maayong pagkinabuhi.",
    },
    caption: {
      en: "COPD cannot be undone, but four things keep it from taking more than it has: an inhaler, oxygen therapy where it is needed, pulmonary rehabilitation, and healthy living. Ask a doctor for the plan that fits you.",
      tl: "Hindi na maibabalik ang COPD, ngunit apat ang pumipigil sa paglala nito: ang inhaler, terapiyang oxygen kung kailangan, rehabilitasyon sa baga, at malusog na pamumuhay. Kumonsulta sa doktor para sa tamang plano.",
      ceb: "Dili na mabawi ang COPD, apan upat ang makapugong sa pagsamot niini: ang inhaler, terapiya sa oxygen kung gikinahanglan, rehabilitasyon sa baga, ug maayong pagkinabuhi. Pagkonsulta sa doktor para sa hustong plano.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "copd:prevention": {
    src: "copd-prevention.webp",
    alt: {
      en: "Illustrated poster headed 'Iwasan ang COPD' with a figure holding a shield marked with lungs, and four panels in Filipino.",
      tl: "Nakalarawang poster na may pamagat na 'Iwasan ang COPD' na may batang may hawak na kalasag na may baga, at apat na bahagi.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Iwasan ang COPD' nga adunay bata nga naggunit ug taming nga may baga, ug upat ka bahin.",
    },
    caption: {
      en: "Four ways to keep COPD away: stay clear of cigarettes and air pollution, exercise every day, eat nourishing food, and see a doctor early. Smoking causes most COPD — stopping at any age slows the damage, so it is never too late to matter.",
      tl: "Apat na paraan sa pag-iwas sa COPD: iwasan ang sigarilyo at polusyon, mag-ehersisyo araw-araw, kumain ng masustansya, at kumonsulta agad sa doktor. Ang paninigarilyo ang sanhi ng karamihan sa COPD — ang pagtigil sa anumang edad ay nagpapabagal sa pinsala.",
      ceb: "Upat ka paagi sa paglikay sa COPD: likayi ang sigarilyo ug polusyon, mag-ehersisyo kada adlaw, kaon ug masustansya, ug pagkonsulta dayon sa doktor. Ang panigarilyo mao ang hinungdan sa kadaghanan sa COPD — ang paghunong sa bisan unsang edad makapahinay sa kadaot.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "copd:lifestyle": {
    src: "copd-lifestyle.webp",
    alt: {
      en: "Illustrated poster headed 'Pangangalaga sa COPD' with four panels: pacing yourself, gentle exercise, eating properly, and staying in touch with a care team.",
      tl: "Nakalarawang poster na may pamagat na 'Pangangalaga sa COPD' na may apat na bahagi: pagdadahan-dahan, banayad na ehersisyo, wastong pagkain, at pananatiling konektado sa pangkat ng pangangalaga.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Pangangalaga sa COPD' nga adunay upat ka bahin: paghinay-hinay, hinay nga ehersisyo, hustong pagkaon, ug pagpabilin nga konektado sa tim sa pag-atiman.",
    },
    caption: {
      en: "Living with COPD: pace yourself, exercise gently, eat properly, and stay in touch with your care team. Eating well and walking a little every day keep the breathing muscles strong for longer.",
      tl: "Pamumuhay na may COPD: magdahan-dahan, mag-ehersisyo nang banayad, kumain nang wasto, at manatiling konektado sa iyong pangkat ng pangangalaga. Ang wastong pagkain at kaunting paglalakad araw-araw ay nagpapatatag sa mga kalamnan sa paghinga.",
      ceb: "Pagkinabuhi uban sa COPD: paghinay-hinay, mag-ehersisyo ug hinay, kaon ug husto, ug pabilin nga konektado sa imong tim sa pag-atiman. Ang maayong pagkaon ug gamay nga paglakaw kada adlaw makapalig-on sa kaunuran sa pagginhawa.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── Asthma ───────────────────────────────────────────────────────────────
  // Project artwork, same provenance as the bronchitis and COPD sets: no logo,
  // no photographer, no licence statement, so `credit` names Bantay-TB.
  //
  // Two of these fill slots that were deliberately left empty. The symptoms
  // one matters most: that slot was empty because the shared cough drawing
  // would have taught the wrong thing here — asthma's hallmark is wheeze and
  // chest tightness, not a productive cough — and the poster now in it leads
  // with wheezing, which is the picture that slot was waiting for.
  "asthma:overview": {
    src: "asthma-overview.webp",
    alt: {
      en: "Illustrated poster headed 'Ano ang asthma?' with a child beside a thought cloud holding three panels: breathlessness and cough, triggers, and early treatment.",
      tl: "Nakalarawang poster na may pamagat na 'Ano ang asthma?' na may batang may kaisipang ulap na naglalaman ng tatlong bahagi: hirap sa paghinga at ubo, mga trigger, at pag-agap at gamutan.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Ano ang asthma?' nga adunay bata ug panganod sa hunahuna nga may tulo ka bahin: kalisod sa pagginhawa ug ubo, mga trigger, ug sayo nga pagtambal.",
    },
    caption: {
      en: "Asthma is a lung condition that inflames the airways. It shows as breathlessness and cough, it is set off by triggers, and it answers to early treatment. Look after your lungs.",
      tl: "Ang hika ay isang kondisyon sa baga na nagdudulot ng pamamaga ng daanan ng hangin. Nagpapakita ito sa hirap sa paghinga at ubo, pinapasimulan ng mga trigger, at natutugunan ng maagap na gamutan. Alagaan ang iyong baga.",
      ceb: "Ang hubak usa ka kondisyon sa baga nga makapamaga sa agianan sa hangin. Makita kini sa kalisod sa pagginhawa ug ubo, gipahinabo sa mga trigger, ug matubag sa sayo nga pagtambal. Ampingi ang imong baga.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "asthma:symptoms": {
    src: "asthma-symptoms.webp",
    alt: {
      en: "Illustrated poster headed 'Pagtukoy sa hika (asthma attack)' with four labelled panels around an inhaler at the centre: wheezing, chest tightness, non-stop coughing, and difficulty breathing.",
      tl: "Nakalarawang poster na may pamagat na 'Pagtukoy sa hika (asthma attack)' na may apat na bahagi sa paligid ng inhaler: pagsipol ng dibdib, paninikip ng dibdib, walang tigil na pag-ubo, at hirap sa paghinga.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Pagtukoy sa hika (asthma attack)' nga adunay upat ka bahin palibot sa inhaler: huni sa dughan, paghugot sa dughan, walay hunong nga ubo, ug kalisod sa pagginhawa.",
    },
    caption: {
      en: "The four signs of an attack: wheezing, tightness in the chest, coughing that will not stop, and difficulty breathing. Stay calm and use the inhaler if you have one. If it does not ease quickly, get help at once — call emergency services if you need to.",
      tl: "Ang apat na palatandaan ng atake: pagsipol ng dibdib, paninikip ng dibdib, walang tigil na pag-ubo, at hirap sa paghinga. Manatiling kalmado at gamitin ang inhaler kung mayroon. Kung hindi agad gumaan, humingi agad ng tulong — tumawag sa emergency kung kinakailangan.",
      ceb: "Ang upat ka timailhan sa atake: huni sa dughan, paghugot sa dughan, walay hunong nga ubo, ug kalisod sa pagginhawa. Pagpakalma ug gamita ang inhaler kung aduna. Kung dili dayon mogaan, pangayo dayon ug tabang — tawag sa emergency kung gikinahanglan.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "asthma:treatment": {
    src: "asthma-treatment.webp",
    alt: {
      en: "Illustrated poster headed 'Paggamot sa Asthma' with four panels: avoiding triggers, daily medicine, emergency medicine, and an action plan agreed with a doctor.",
      tl: "Nakalarawang poster na may pamagat na 'Paggamot sa Asthma' na may apat na bahagi: pag-iwas sa mga nagdudulot, pang-araw-araw na gamot, gamot sa emergency, at planong pang-aksyon kasama ang doktor.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Paggamot sa Asthma' nga adunay upat ka bahin: paglikay sa mga trigger, tambal kada adlaw, tambal sa emergency, ug plano sa aksyon uban sa doktor.",
    },
    caption: {
      en: "Asthma is controlled, not cured, and control has four parts: keep away from your triggers — dust mites, smoke, pet dander; take the daily preventer; keep the reliever for attacks; and agree a written action plan with your doctor.",
      tl: "Kinokontrol ang hika, hindi ginagamot, at apat ang bahagi nito: iwasan ang mga nagdudulot — dust mites, usok, balahibo ng alagang hayop; uminom ng pang-araw-araw na gamot; itabi ang gamot sa emergency para sa atake; at gumawa ng nakasulat na planong pang-aksyon kasama ang doktor.",
      ceb: "Makontrol ang hubak, dili mawala, ug upat ang bahin niini: likayi ang mga trigger — dust mites, aso, balhibo sa binuhi; inoma ang tambal kada adlaw; tagoi ang tambal sa emergency para sa atake; ug paghimo ug sinulat nga plano sa aksyon uban sa doktor.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "asthma:prevention": {
    // The headline calls these "sanhi" — causes. They are triggers: they set
    // off attacks in someone who already has asthma, rather than causing the
    // condition. The caption says so, since the artwork cannot.
    src: "asthma-prevention.webp",
    alt: {
      en: "Illustrated poster headed 'Iwasan ang mga sanhi ng hika' with four crossed-out triggers around a child holding a face mask: dust, a pet dog, a cigarette, and a spray bottle.",
      tl: "Nakalarawang poster na may pamagat na 'Iwasan ang mga sanhi ng hika' na may apat na ekis na trigger sa paligid ng batang may hawak na face mask: alikabok, alagang aso, sigarilyo, at spray bottle.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Iwasan ang mga sanhi ng hika' nga adunay upat ka gi-ekisan nga trigger palibot sa bata nga naggunit ug face mask: abog, iro nga binuhi, sigarilyo, ug spray bottle.",
    },
    caption: {
      en: "Four things to keep away from: dust and mould, cigarette smoke, pets, and strong smells. These are triggers rather than causes — they set off attacks in someone who already has asthma. Knowing which ones are yours is most of the battle.",
      tl: "Apat na dapat iwasan: alikabok at amag, usok ng sigarilyo, mga alagang hayop, at matatapang na amoy. Mga trigger ang mga ito, hindi sanhi — pinapasimulan nila ang atake sa taong may hika na. Malaking tulong ang malaman kung alin ang sa iyo.",
      ceb: "Upat ka angay likayan: abog ug agup-op, aso sa sigarilyo, mga binuhi nga hayop, ug isog nga baho. Mga trigger kini, dili hinungdan — gipasugdan nila ang atake sa tawo nga naa nay hubak. Dako nga tabang ang pagkahibalo kung asa ang imoha.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "asthma:lifestyle": {
    src: "asthma-lifestyle.webp",
    alt: {
      en: "Illustrated poster headed 'Kontrolado ang hika, aktibong pamumuhay!' showing a girl running with an inhaler in hand while other children play behind her.",
      tl: "Nakalarawang poster na may pamagat na 'Kontrolado ang hika, aktibong pamumuhay!' na may batang babaeng tumatakbo na may hawak na inhaler habang naglalaro ang ibang bata sa likod.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Kontrolado ang hika, aktibong pamumuhay!' nga adunay batang babaye nga nagdagan nga naggunit ug inhaler samtang nagdula ang ubang bata sa luyo.",
    },
    caption: {
      en: "Most people with well-controlled asthma can exercise, work, and eat exactly as they please. Follow your doctor's advice, use the inhaler correctly, and warm up before exercising. Don't let asthma hold you back — talk to your doctor.",
      tl: "Karamihan sa may kontroladong hika ay nakakapag-ehersisyo, nakakapagtrabaho, at nakakakain nang normal. Sundin ang payo ng doktor, gamitin ang inhaler nang tama, at mag-warm up bago mag-ehersisyo. Huwag hayaang pigilan ka ng hika — kumonsulta sa iyong doktor.",
      ceb: "Kadaghanan sa adunay kontrolado nga hubak makahimo ug ehersisyo, trabaho, ug pagkaon sa normal. Sunda ang tambag sa doktor, gamita ang inhaler sa husto, ug mag-warm up una mag-ehersisyo. Ayaw tuguti nga pugngan ka sa hubak — pagkonsulta sa imong doktor.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── Paragonimiasis ───────────────────────────────────────────────────────
  // Project artwork, same provenance as the bronchitis, COPD, and asthma sets:
  // no logo, no photographer, no licence statement, so `credit` names Bantay-TB.
  //
  // WRONG ANIMAL, IN THREE OF THE FIVE. This topic used to carry no crab
  // picture at all, on the ground that a picture of the wrong animal teaches
  // the reader to fear the wrong food. These posters draw the crab — and get
  // it wrong in the way that note predicted. Paragonimus in the Philippines is
  // carried by FRESHWATER crabs and crayfish out of streams and rice fields.
  // It is not carried by marine shrimp, prawns, or lobster, and it is not a
  // seafood disease.
  //
  //   - overview   draws a bowl of marine shrimp and prawns, and labels the
  //                cause "pagkain ng hilaw na lamang-dagat" — raw SEAFOOD.
  //                That sentence is simply false, and it is the one line on
  //                the poster a reader will act on.
  //   - treatment  draws a plate of marine lobster and shrimp under "Paano
  //                nakukuha?".
  //   - prevention says "alimango o hipon" — crab or SHRIMP.
  //
  // Every caption below therefore says "freshwater" in all three languages,
  // and names streams and rice fields rather than the sea. A caption can add
  // what the artwork left out, but it cannot erase a drawing of a prawn: the
  // three posters want redrawing. The comparison poster on `symptoms` is the
  // one to keep as it stands — it gets the source right and is the best thing
  // in this set.
  "paragonimiasis:overview": {
    // Fills a slot that was empty. It wanted a micrograph of a Paragonimus
    // westermani egg or adult fluke; this is a drawn explainer instead, which
    // is friendlier but shows the reader nothing of the parasite itself.
    //
    // Two faults in the artwork: the panel heading is misspelt "SIMTOMAS" for
    // "SINTOMAS", and the cause is given as raw seafood. See the note above.
    src: "paragonimiasis-overview.webp",
    alt: {
      en: "Illustrated poster headed 'Ano ang paragonimiasis?' with a doctor at a whiteboard showing lungs, a crab, and a snail, above three panels on symptoms, cause, and remedy.",
      tl: "Nakalarawang poster na may pamagat na 'Ano ang paragonimiasis?' na may doktor sa whiteboard na may baga, alimango, at suso, at tatlong bahagi sa ibaba tungkol sa sintomas, sanhi, at lunas.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Ano ang paragonimiasis?' nga adunay doktor sa whiteboard nga may baga, kasag, ug kuhol, ug tulo ka bahin sa ubos bahin sa sintomas, hinungdan, ug tambal.",
    },
    caption: {
      en: "Paragonimiasis is caused by the lung fluke, a flatworm caught by eating raw or half-cooked FRESHWATER crab or crayfish — the kind from streams and rice fields, not seafood from the sea. It brings cough, fever, and chest pain. See a doctor for the right treatment.",
      tl: "Ang paragonimiasis ay dulot ng 'lung fluke', isang bulate na nakukuha sa pagkain ng hilaw o kulang sa lutong alimango o ulang na TABANG — ang mula sa sapa at palayan, hindi lamang-dagat. Nagdudulot ito ng ubo, lagnat, at sakit sa dibdib. Magpakonsulta sa doktor para sa tamang gamutan.",
      ceb: "Ang paragonimiasis tungod sa 'lung fluke', usa ka ulod nga makuha sa pagkaon ug hilaw o kulang sa luto nga kasag o ulang sa TAB-ANG nga tubig — kadtong gikan sa sapa ug basakan, dili gikan sa dagat. Maghatag kini ug ubo, hilanat, ug sakit sa dughan. Pagpakonsulta sa doktor para sa hustong tambal.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "paragonimiasis:symptoms": {
    // The best image in this batch, and the reason is that it answers the
    // question this whole app exists around: a cough of weeks, in someone who
    // eats freshwater crab, is not automatically TB. Side-by-side it gives the
    // two tells — rust-brown phlegm and little or no fever on one side, night
    // sweats and clear weight loss on the other.
    src: "paragonimiasis-symptoms.webp",
    alt: {
      en: "Illustrated poster headed 'Paragonimiasis vs. Tuberculosis (TB)', comparing the two side by side with a doctor at the centre pointing to each.",
      tl: "Nakalarawang poster na may pamagat na 'Paragonimiasis vs. Tuberculosis (TB)', magkatabing paghahambing na may doktor sa gitna na nakaturo sa bawat panig.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Paragonimiasis vs. Tuberculosis (TB)', nag-tapad nga pagtandi nga adunay doktor sa tunga nga nagtudlo sa matag kilid.",
    },
    caption: {
      en: "This is the comparison that matters: the cough is why paragonimiasis is mistaken for TB. Paragonimiasis is foodborne, from raw or half-cooked freshwater crab, and its tell is rust-brown or chocolate-coloured phlegm with little or no fever. TB is airborne, and its tells are heavy night sweats, clear weight loss, and afternoon fever. Don't guess — see a doctor and be tested.",
      tl: "Ito ang paghahambing na mahalaga: ang ubo ang dahilan kung bakit napagkakamalang TB ang paragonimiasis. Ang paragonimiasis ay nakukuha sa pagkain — hilaw o kulang sa lutong alimango o ulang na tabang — at ang palatandaan nito ay plemang kulay-kalawang o tsokolate na walang lagnat o mababa lang. Ang TB ay kumakalat sa hangin, at ang palatandaan nito ay matinding pawis sa gabi, malinaw na pagbaba ng timbang, at lagnat sa hapon. Huwag manghula — magpatingin agad sa doktor para sa tamang pagsusuri.",
      ceb: "Kini ang pagtandi nga importante: ang ubo mao ang hinungdan nga masaypan nga TB ang paragonimiasis. Ang paragonimiasis makuha sa pagkaon — hilaw o kulang sa luto nga kasag o ulang sa tab-ang nga tubig — ug ang timailhan niini mao ang plema nga kolor taya o tsokolate nga walay hilanat o ubos ra. Ang TB mokatap sa hangin, ug ang timailhan niini mao ang grabeng singot sa gabii, klaro nga pagniwang, ug hilanat sa hapon. Ayaw pagtag-an — pagpatan-aw dayon sa doktor para sa hustong pagsusi.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "paragonimiasis:treatment": {
    // Praziquantel is right — that is the drug for paragonimiasis, and naming
    // it is genuinely useful. The "Paano nakukuha?" panel beside it draws
    // marine lobster and shrimp; see the note at the top of this block.
    src: "paragonimiasis-treatment.webp",
    alt: {
      en: "Illustrated poster headed 'Paragonimiasis: alamin at labanan!' with three numbered treatment steps beside a panel showing how the infection is caught.",
      tl: "Nakalarawang poster na may pamagat na 'Paragonimiasis: alamin at labanan!' na may tatlong bilang na hakbang sa gamutan katabi ng bahaging nagpapakita kung paano ito nakukuha.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Paragonimiasis: alamin at labanan!' nga adunay tulo ka numerado nga lakang sa tambal tupad sa bahin nga nagpakita kung unsaon kini makuha.",
    },
    caption: {
      en: "Three steps: see a doctor promptly for the right diagnosis, take praziquantel — or whatever is prescribed — on schedule, and finish the whole course. Tell the doctor if you have ever eaten raw or half-cooked freshwater crab. That one sentence is what redirects the whole diagnosis.",
      tl: "Tatlong hakbang: magpakonsulta agad sa doktor para sa tamang diagnosis, inumin ang praziquantel — o kung ano ang inireseta — nang ayon sa oras, at tapusin ang buong kurso. Sabihin sa doktor kung nakakain ka ng hilaw o kulang sa lutong alimango na tabang. Ang isang pangungusap na iyon ang nagbabago sa buong diagnosis.",
      ceb: "Tulo ka lakang: pagpakonsulta dayon sa doktor para sa hustong diagnosis, inoma ang praziquantel — o bisan unsay gireseta — sumala sa oras, ug humana ang tibuok kurso. Isulti sa doktor kung nakakaon ka na ug hilaw o kulang sa luto nga kasag sa tab-ang nga tubig. Kana nga usa ka tudling mao ang mo-usab sa tibuok diagnosis.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "paragonimiasis:prevention": {
    // Fills a slot that was empty. It wanted freshwater crab being thoroughly
    // cooked, and the rice-field setting is right — but the caption panel says
    // "alimango o hipon", crab or shrimp, and shrimp does not carry the fluke.
    // See the note at the top of this block.
    src: "paragonimiasis-prevention.webp",
    alt: {
      en: "Illustrated poster headed 'Iwasan ang paragonimiasis!' with two young people in a rice-field setting above three panels: don't eat it raw, cook it thoroughly, and keep clean.",
      tl: "Nakalarawang poster na may pamagat na 'Iwasan ang paragonimiasis!' na may dalawang kabataan sa palayan at tatlong bahagi: huwag kainin nang hilaw, lutuin nang mabuti, at panatilihin ang kalinisan.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Iwasan ang paragonimiasis!' nga adunay duha ka batan-on sa basakan ug tulo ka bahin: ayaw kan-a nga hilaw, lutoa ug maayo, ug ampingi ang kalimpyo.",
    },
    caption: {
      en: "Prevention is entirely in the cooking. Never eat freshwater crab or crayfish raw or half-cooked — the ones caught in streams and rice fields, not seafood from the sea. Cook them right through, and keep your hands and utensils clean.",
      tl: "Nasa pagluluto ang buong pag-iwas. Huwag kailanman kainin nang hilaw o kulang sa luto ang alimango o ulang na tabang — ang nahuhuli sa sapa at palayan, hindi ang lamang-dagat. Lutuin nang husto hanggang sa loob, at panatilihing malinis ang kamay at kagamitan.",
      ceb: "Anaa sa pagluto ang tanan nga paglikay. Ayaw gayod kan-a nga hilaw o kulang sa luto ang kasag o ulang sa tab-ang nga tubig — kadtong nakuha sa sapa ug basakan, dili ang gikan sa dagat. Lutoa gyod hangtod sa sulod, ug ampingi ang kalimpyo sa kamot ug galamiton.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "paragonimiasis:lifestyle": {
    src: "paragonimiasis-lifestyle.webp",
    alt: {
      en: "Illustrated poster headed 'Pag-unawa at pag-ingat laban sa paragonimiasis!' with four numbered steps: rest enough, eat nourishing food, look after your lungs, and come back for follow-up.",
      tl: "Nakalarawang poster na may pamagat na 'Pag-unawa at pag-ingat laban sa paragonimiasis!' na may apat na bilang na hakbang: magpahinga nang sapat, kumain ng masustansya, ingatan ang baga, at bumalik sa follow-up.",
      ceb: "Gidrowing nga poster nga giulohan ug 'Pag-unawa at pag-ingat laban sa paragonimiasis!' nga adunay upat ka numerado nga lakang: pahulay ug igo, kaon ug masustansya, ampingi ang baga, ug balik sa follow-up.",
    },
    caption: {
      en: "Four things while you recover: rest enough for the body to mend, eat nourishing food — vegetables, fruit, fish — to build your resistance, keep away from smoke, dust, and cold air, and come back for your follow-up check-up. Protein at every meal and steady fluids help the lungs repair once the flukes are cleared.",
      tl: "Apat na bagay habang gumagaling: magpahinga nang sapat upang tuluyang gumaling ang katawan, kumain ng masustansyang pagkain — gulay, prutas, isda — upang palakasin ang resistensya, umiwas sa usok, alikabok, at malamig na hangin, at bumalik sa follow-up check-up. Ang protina sa bawat pagkain at sapat na inumin ay tumutulong sa paggaling ng baga matapos mawala ang uod.",
      ceb: "Upat ka butang samtang nagkaayo: pagpahulay ug igo aron maayo ang lawas, kaon ug masustansyang pagkaon — utanon, prutas, isda — aron molig-on ang resistensya, likayi ang aso, abog, ug bugnaw nga hangin, ug balik sa imong follow-up check-up. Ang protina sa matag pagkaon ug igong ilimnon motabang sa pag-ayo sa baga human mawala ang ulod.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
};

/** The picture for one article section, in the language being read.
 *
 *  Returns undefined when the section has no picture yet, so the caller renders
 *  no figure rather than a broken image. */
export function articleImageFor(
  disease: Disease,
  category: Category,
  locale: Locale,
): ResolvedArticleImage | undefined {
  const image = ARTICLE_IMAGES[articleImageKey(disease, category)];

  if (!image.src) return undefined;

  return {
    src: imageUrl(image.src),
    alt: image.alt[locale],
    caption: image.caption[locale],
    credit: image.credit,
    creditUrl: image.creditUrl,
    fit: image.fit,
    width: image.width,
    height: image.height,
  };
}
