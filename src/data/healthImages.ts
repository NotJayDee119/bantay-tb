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
// All forty are one set of project artwork, supplied in November 2026 and kept
// as originals under `docs/INFOGRAPHIC EDUCATION/<Disease>/<Section>.jpg`. They
// replace every picture this file carried before — the government posters
// (PIA, DOH, WHO, Ospital ng Maynila, Quezon City Health Department), the
// freely-licensed photographs, and the earlier generated sets.
//
// They are 3D-rendered posters, 896×1200, with their wording in Filipino. They
// carry no agency logo, no seal, no photographer, and no licence statement,
// and their style and small text slips read as machine-generated. `credit`
// names Bantay-TB because that is honestly where they came from — if any of
// them in fact originated elsewhere, the real source belongs here.
//
// The English and Cebuano `alt`/`caption` carry the Filipino wording across,
// as before. Every one was opened and read before being committed. Where the
// artwork misspells something, the entry says so in a comment; none of those
// slips changes the medical message, and the caption gives the right words.
//
// File names end in `-v2` on purpose. `/images/**` is served with a week-long
// Cache-Control and the service worker serves pictures stale-while-revalidate,
// so reusing the old names would have kept returning visitors on the old
// pictures for days. A future replacement set should take a new suffix too.

export const ARTICLE_IMAGES: Record<ArticleImageKey, ArticleImage> = {
  // ─── Tuberculosis ─────────────────────────────────────────────────────────
  // A quieter, lighter set than the other seven: mint background, one recurring
  // patient in a blue polo, and short labels rather than full sentences. The
  // captions carry what the labels leave out.
  "tb:overview": {
    src: "tb-overview-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Tuberkulosis (TB)' and 'Nakahahawang sakit sa baga na dulot ng bacteria', showing a man coughing into his elbow beside a pair of cartoon lungs and floating germs.",
      tl: "3D na nakalarawang poster na may pamagat na 'Tuberkulosis (TB)' at 'Nakahahawang sakit sa baga na dulot ng bacteria', na may lalaking umuubo sa kanyang siko sa tabi ng baga at mga mikrobyo.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Tuberkulosis (TB)' ug 'Nakahahawang sakit sa baga na dulot ng bacteria', nga adunay lalaki nga nag-ubo sa iyang siko tupad sa baga ug mga kagaw.",
    },
    caption: {
      en: "TB is an infectious disease caused by the bacterium Mycobacterium tuberculosis. It usually attacks the lungs, though it can reach other parts of the body. It spreads through the air when someone with active lung TB coughs or sneezes — which is why the man here coughs into his elbow. It is not caught by shaking hands or sharing a glass. And it is curable, with steady treatment.",
      tl: "Ang TB ay nakakahawang sakit na dulot ng bakteryang Mycobacterium tuberculosis. Karaniwang baga ang tinatamaan nito, pero maaari ring umabot sa ibang bahagi ng katawan. Kumakalat ito sa hangin kapag umuubo o bumabahing ang taong may aktibong TB sa baga — kaya sa siko umuubo ang lalaki sa larawan. Hindi ito nakukuha sa pakikipagkamay o sa paggamit ng iisang baso. At nagagamot ito, sa tuloy-tuloy na gamutan.",
      ceb: "Ang TB usa ka makatakod nga sakit tungod sa bakterya nga Mycobacterium tuberculosis. Kasagaran ang baga ang giigo niini, apan mahimo usab kining moabot sa ubang bahin sa lawas. Mokatap kini sa hangin kung mo-ubo o mobahing ang tawo nga adunay aktibo nga TB sa baga — mao nga sa siko nag-ubo ang lalaki sa hulagway. Dili kini makuha sa paglamano o sa paggamit sa usa ra ka baso. Ug matambalan kini, sa padayon nga tambal.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "tb:symptoms": {
    src: "tb-symptoms-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Mga Sintomas ng TB' with a man coughing into his fist at the centre and four labelled panels: a cough of two weeks or more, afternoon fever, night sweats, and weight loss.",
      tl: "3D na nakalarawang poster na may pamagat na 'Mga Sintomas ng TB' na may lalaking umuubo sa gitna at apat na bahagi: ubong 2 linggo o higit pa, lagnat sa hapon, pagpapawis sa gabi, at pagbaba ng timbang.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Mga Sintomas ng TB' nga adunay lalaki nga nag-ubo sa tunga ug upat ka bahin: ubo nga 2 ka semana o kapin, hilanat sa hapon, singot sa gabii, ug pagniwang.",
    },
    caption: {
      en: "The four signs to watch for: a cough lasting two weeks or more, fever that comes in the afternoon, sweating at night, and losing weight without trying. Coughing up blood, chest pain, and constant tiredness are warning signs too. If you have any of these, go to your barangay health centre to be checked.",
      tl: "Ang apat na palatandaang dapat bantayan: ubo na tumatagal ng dalawang linggo o higit pa, lagnat na dumarating sa hapon, pagpapawis sa gabi, at pagbaba ng timbang nang walang dahilan. Babala rin ang ubo na may dugo, sakit sa dibdib, at palaging pagkapagod. Kung mayroon ka ng alinman dito, magpasuri sa inyong barangay health center.",
      ceb: "Ang upat ka timailhan nga angay bantayan: ubo nga molungtad ug duha ka semana o kapin, hilanat nga moabot sa hapon, singot sa gabii, ug pagniwang nga walay hinungdan. Pasidaan usab ang ubo nga may dugo, sakit sa dughan, ug kanunay nga kakapoy. Kung aduna ka bisan usa niini, pagpasusi sa inyong barangay health center.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "tb:treatment": {
    src: "tb-treatment-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Paggamot sa TB' showing a nurse handing a man a cup of tablets and a glass of water in a health centre, above three tiles: take the medicine every day, finish the six-month treatment, and free at the health centre.",
      tl: "3D na nakalarawang poster na may pamagat na 'Paggamot sa TB' na may nars na nag-aabot ng gamot at isang basong tubig sa lalaki sa health center, at tatlong bahagi: inumin ang gamot araw-araw, tapusin ang 6 na buwang gamutan, at libre sa health center.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Paggamot sa TB' nga adunay nars nga mihatag ug tambal ug usa ka basong tubig sa lalaki sa health center, ug tulo ka bahin: inoma ang tambal kada adlaw, humana ang 6 ka bulan nga pagtambal, ug libre sa health center.",
    },
    caption: {
      en: "Three things to hold on to: take the medicines every day; finish the whole six months, even after you start to feel well; and know that it is free at the health centre. Stopping early is what breeds drug-resistant TB, which takes far longer to treat. If your TB is drug-resistant, your course will be longer than six months — your health worker will tell you how long.",
      tl: "Tatlong dapat tandaan: inumin ang gamot araw-araw; tapusin ang buong anim na buwan, kahit bumuti na ang pakiramdam; at libre ito sa health center. Ang pagtigil nang maaga ang nagbubunga ng TB na hindi na tinatablan ng gamot, na mas matagal gamutin. Kung drug-resistant ang iyong TB, mas mahaba sa anim na buwan ang gamutan — sasabihin ng health worker kung gaano katagal.",
      ceb: "Tulo ka butang nga hinumdoman: inoma ang tambal kada adlaw; humana ang tibuok unom ka bulan, bisan maayo na ang imong pamati; ug libre kini sa health center. Ang paghunong ug sayo mao ang mohatag ug TB nga dili na maayo sa tambal, nga mas dugay tambalan. Kung drug-resistant ang imong TB, mas taas kaysa unom ka bulan ang pagtambal — isulti sa health worker kung unsa kadugay.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "tb:prevention": {
    // The poster on the clinic wall in the BCG panel carries garbled lettering
    // ("Pacsinecned pester"). It is a few pixels tall and says nothing the
    // reader needs, but it is there.
    src: "tb-prevention-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Pag-iwas sa TB' with four panels: a nurse giving a baby the BCG vaccine, a man coughing into his elbow, a house with its windows open to the breeze, and a man being checked by a doctor.",
      tl: "3D na nakalarawang poster na may pamagat na 'Pag-iwas sa TB' na may apat na bahagi: nars na nagbabakuna ng BCG sa sanggol, lalaking umuubo sa siko, bahay na bukas ang mga bintana, at lalaking sinusuri ng doktor.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Pag-iwas sa TB' nga adunay upat ka bahin: nars nga nagbakuna ug BCG sa bata, lalaki nga nag-ubo sa siko, balay nga abli ang mga bintana, ug lalaki nga gisusi sa doktor.",
    },
    caption: {
      en: "Four ways to stop TB spreading: the BCG vaccine for newborns, which protects young children from the most severe forms; covering your mouth when you cough; opening the windows so fresh air carries the germs out; and getting checked if you have a cough. Finding and treating TB early is what stops it reaching the rest of the household.",
      tl: "Apat na paraan para mapigilan ang pagkalat ng TB: ang bakunang BCG sa bagong silang na sanggol, na nagpoprotekta sa mga bata laban sa pinakamalalang uri nito; pagtakip sa bibig kapag umuubo; pagbukas ng mga bintana para mailabas ng sariwang hangin ang mikrobyo; at pagpapasuri kapag may ubo. Ang maagang pagtuklas at paggamot ang pumipigil sa pagkalat nito sa buong pamilya.",
      ceb: "Upat ka paagi sa pagpugong sa pagkatap sa TB: ang bakuna nga BCG sa bag-ong natawo, nga nanalipod sa mga bata batok sa labing grabe nga matang niini; pagtabon sa baba kung mo-ubo; pag-abli sa mga bintana aron madala sa presko nga hangin ang kagaw; ug pagpasusi kung naay ubo. Ang sayo nga pagkakita ug pagtambal mao ang mopugong sa pagkatap niini sa tibuok pamilya.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "tb:lifestyle": {
    src: "tb-lifestyle-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Tulog, Nutrisyon, Ehersisyo' with three panels of the same man: asleep in bed at night, eating rice with greens and grilled fish, and walking in a park.",
      tl: "3D na nakalarawang poster na may pamagat na 'Tulog, Nutrisyon, Ehersisyo' na may tatlong larawan ng iisang lalaki: natutulog sa gabi, kumakain ng kanin na may gulay at inihaw na isda, at naglalakad sa parke.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Tulog, Nutrisyon, Ehersisyo' nga adunay tulo ka hulagway sa usa ka lalaki: natulog sa gabii, nagkaon ug kan-on nga may utanon ug sinugbang isda, ug naglakaw sa parke.",
    },
    caption: {
      en: "Three habits that help the body fight TB and recover from it: enough sleep, nourishing food — rice, greens, and fish or another protein at every meal — and light exercise such as walking, once you are able. TB often brings weight loss, so eating well is part of the treatment, not an extra.",
      tl: "Tatlong gawi na tumutulong sa katawan na labanan ang TB at gumaling: sapat na tulog, masustansyang pagkain — kanin, gulay, at isda o ibang protina sa bawat kain — at magaang ehersisyo gaya ng paglalakad, kapag kaya na. Madalas pumayat ang may TB, kaya bahagi ng gamutan ang maayos na pagkain, hindi dagdag lang.",
      ceb: "Tulo ka batasan nga motabang sa lawas sa pagsukol sa TB ug pag-ayo: igo nga katulog, masustansya nga pagkaon — kan-on, utanon, ug isda o laing protina sa matag kaon — ug gaan nga ehersisyo sama sa paglakaw, kung makaya na. Kasagaran mamiwang ang adunay TB, busa bahin sa pagtambal ang maayong pagkaon, dili lang dugang.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── Pneumonia ────────────────────────────────────────────────────────────
  // Same mint style as tuberculosis, built around a small boy and his mother.
  // The old set's "BAKTERYA, BIRA, BIRA, FUNGUS" error is gone with it.
  "pneumonia:overview": {
    src: "pneumonia-overview-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Pulmonya' and 'Impeksiyon sa baga', showing a mother sitting beside her smiling son in bed, next to a model of the lungs with germs on one side.",
      tl: "3D na nakalarawang poster na may pamagat na 'Pulmonya' at 'Impeksiyon sa baga', na may inang nakaupo sa tabi ng kanyang anak na nakahiga, katabi ng modelo ng baga na may mikrobyo sa isang bahagi.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Pulmonya' ug 'Impeksiyon sa baga', nga adunay inahan nga naglingkod tupad sa iyang anak nga naghigda, tupad sa modelo sa baga nga may kagaw sa usa ka bahin.",
    },
    caption: {
      en: "Pneumonia is an infection of the lungs, caused by bacteria, viruses, or fungi. It fills the tiny air sacs with fluid, which makes breathing hard. Anyone can get it, but young children and older adults are at greatest risk.",
      tl: "Ang pulmonya ay impeksiyon sa baga na dulot ng bakterya, virus, o fungus. Pinupuno nito ng likido ang maliliit na air sac, kaya nahihirapang huminga. Kahit sino ay maaaring magkaroon nito, pero pinakananganganib ang maliliit na bata at matatanda.",
      ceb: "Ang pulmonya usa ka impeksiyon sa baga tungod sa bakterya, virus, o fungus. Pun-on niini ug tubig ang gagmay nga air sac, mao nga maglisod pagginhawa. Bisan kinsa mahimong matakdan, apan labing delikado ang gagmay nga bata ug mga tigulang.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "pneumonia:symptoms": {
    src: "pneumonia-symptoms-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Mga Sintomas ng Pulmonya' with a sick boy holding a tissue and his chest, and four labelled panels: cough with phlegm, high fever, fast breathing, and chest pain.",
      tl: "3D na nakalarawang poster na may pamagat na 'Mga Sintomas ng Pulmonya' na may batang lalaking may sakit na may hawak na tisyu at dibdib, at apat na bahagi: ubong may plema, mataas na lagnat, mabilis na paghinga, at pananakit ng dibdib.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Mga Sintomas ng Pulmonya' nga adunay batang lalaki nga masakiton nga naggunit ug tisyu ug sa iyang dughan, ug upat ka bahin: ubo nga may plema, taas nga hilanat, paspas nga pagginhawa, ug sakit sa dughan.",
    },
    caption: {
      en: "Four signs: a cough with phlegm, high fever, fast breathing, and chest pain. In a small child, fast breathing — or the chest pulling in with each breath — is the sign to act on. Take them to the health centre at once.",
      tl: "Apat na palatandaan: ubong may plema, mataas na lagnat, mabilis na paghinga, at pananakit ng dibdib. Sa maliit na bata, ang mabilis na paghinga — o ang paglubog ng dibdib sa bawat hinga — ang palatandaang hindi dapat ipagwalang-bahala. Dalhin agad sa health center.",
      ceb: "Upat ka timailhan: ubo nga may plema, taas nga hilanat, paspas nga pagginhawa, ug sakit sa dughan. Sa gamay nga bata, ang paspas nga pagginhawa — o ang pagkalubong sa dughan sa matag ginhawa — mao ang timailhan nga dili angay ibalewala. Dad-a dayon sa health center.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "pneumonia:treatment": {
    src: "pneumonia-treatment-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Paggamot sa Pulmonya' showing a doctor listening to a boy's chest with a stethoscope while his mother watches, with four tiles: antibiotics as prescribed, enough rest, drink plenty of water, and see a doctor at once if breathing is hard.",
      tl: "3D na nakalarawang poster na may pamagat na 'Paggamot sa Pulmonya' na may doktor na nakikinig sa dibdib ng bata gamit ang stethoscope habang nakatingin ang ina, at apat na bahagi: antibiotic ayon sa reseta, sapat na pahinga, uminom ng maraming tubig, at magpatingin agad kung hirap huminga.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Paggamot sa Pulmonya' nga adunay doktor nga naminaw sa dughan sa bata gamit ang stethoscope samtang nagtan-aw ang inahan, ug upat ka bahin: antibiotic sumala sa reseta, igo nga pahulay, pag-inom ug daghang tubig, ug pagpatan-aw dayon kung lisod moginhawa.",
    },
    caption: {
      en: "Four steps: take antibiotics only as prescribed, and finish them; rest well; drink plenty of water; and see a doctor at once if breathing becomes hard. Antibiotics only work on pneumonia caused by bacteria, so it is the doctor who decides whether they are needed.",
      tl: "Apat na hakbang: uminom lamang ng antibiotic ayon sa reseta, at tapusin ito; magpahinga nang sapat; uminom ng maraming tubig; at magpatingin agad kapag nahihirapang huminga. Gumagana lamang ang antibiotic sa pulmonyang dulot ng bakterya, kaya ang doktor ang magpapasya kung kailangan ito.",
      ceb: "Upat ka lakang: pag-inom lang ug antibiotic sumala sa reseta, ug humana kini; pagpahulay ug igo; pag-inom ug daghang tubig; ug pagpatan-aw dayon sa doktor kung maglisod na pagginhawa. Ang antibiotic molihok lang sa pulmonya nga tungod sa bakterya, busa ang doktor ang modesisyon kung kinahanglan kini.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "pneumonia:prevention": {
    src: "pneumonia-prevention-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Pag-iwas sa Pulmonya' with four panels: a nurse vaccinating a boy, the boy washing his hands at a sink, a crossed-out cigarette, and a mother breastfeeding her baby.",
      tl: "3D na nakalarawang poster na may pamagat na 'Pag-iwas sa Pulmonya' na may apat na bahagi: nars na nagbabakuna sa bata, batang naghuhugas ng kamay sa lababo, sigarilyong may ekis, at inang nagpapasuso sa sanggol.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Pag-iwas sa Pulmonya' nga adunay upat ka bahin: nars nga nagbakuna sa bata, bata nga nanghugas ug kamot sa lababo, sigarilyo nga may ekis, ug inahan nga nagpasuso sa bata.",
    },
    caption: {
      en: "Four ways to protect against pneumonia: vaccination — including the pneumococcal and flu vaccines; washing hands; keeping away from cigarette smoke; and breastfeeding babies, which builds up their defences. Smoke in the home is one of the biggest risks for a child's lungs.",
      tl: "Apat na paraan para makaiwas sa pulmonya: pagpapabakuna — kasama ang bakuna laban sa pneumococcus at trangkaso; paghuhugas ng kamay; pag-iwas sa usok ng sigarilyo; at pagpapasuso sa sanggol, na nagpapalakas ng kanyang resistensya. Ang usok sa loob ng bahay ay isa sa pinakamalaking panganib sa baga ng bata.",
      ceb: "Upat ka paagi sa paglikay sa pulmonya: pagpabakuna — lakip ang bakuna batok sa pneumococcus ug trangkaso; paghugas sa kamot; paglikay sa aso sa sigarilyo; ug pagpasuso sa bata, nga mopalig-on sa iyang resistensya. Ang aso sulod sa balay usa sa labing dako nga peligro sa baga sa bata.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "pneumonia:lifestyle": {
    src: "pneumonia-lifestyle-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Tulog, Nutrisyon, Ehersisyo' with three panels of a boy: asleep in bed, eating a bowl of fruit and vegetables, and kicking a ball in a park.",
      tl: "3D na nakalarawang poster na may pamagat na 'Tulog, Nutrisyon, Ehersisyo' na may tatlong larawan ng bata: natutulog, kumakain ng prutas at gulay, at sumisipa ng bola sa parke.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Tulog, Nutrisyon, Ehersisyo' nga adunay tulo ka hulagway sa bata: natulog, nagkaon ug prutas ug utanon, ug nagsipa ug bola sa parke.",
    },
    caption: {
      en: "While recovering: sleep enough, eat vegetables and fruit, and get moving again little by little — play and walking at first, not hard exercise. A cough can linger for a few weeks after pneumonia; see the doctor again if it gets worse instead of better.",
      tl: "Habang nagpapagaling: matulog nang sapat, kumain ng gulay at prutas, at unti-unting gumalaw muli — laro at lakad muna, hindi mabigat na ehersisyo. Maaaring tumagal pa nang ilang linggo ang ubo pagkatapos ng pulmonya; bumalik sa doktor kung lumalala ito sa halip na gumagaan.",
      ceb: "Samtang nag-ayo: katulog ug igo, kaon ug utanon ug prutas, ug hinay-hinay nga paglihok pag-usab — dula ug lakaw una, dili bug-at nga ehersisyo. Mahimong molungtad pa ug pipila ka semana ang ubo human sa pulmonya; balik sa doktor kung nagkagrabe kini imbes nga nagkaayo.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── COVID-19 ─────────────────────────────────────────────────────────────
  // Dark blue, glowing-panel style, shared with the influenza, bronchitis,
  // COPD, asthma, and paragonimiasis sets. Unlike the old COVID set (768×1376),
  // these are the same 896×1200 as everything else. No seals, no misspellings.
  "covid19:overview": {
    src: "covid-overview-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Ano ang COVID-19?' with a doctor pointing to a virus and a pair of lungs beside the words 'Sakit sa paghinga na dulot ng virus', above three panels: spread by coughs, sneezes and the air; can be mild or severe; and there is a vaccine against it.",
      tl: "3D na nakalarawang poster na may pamagat na 'Ano ang COVID-19?' na may doktor na nakaturo sa virus at baga sa tabi ng 'Sakit sa paghinga na dulot ng virus', at tatlong bahagi: kumakalat sa ubo, bahing at hangin; pwedeng magaan o malala; at may bakuna laban dito.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Ano ang COVID-19?' nga adunay doktor nga nagtudlo sa virus ug baga tupad sa 'Sakit sa paghinga na dulot ng virus', ug tulo ka bahin: mokatap pinaagi sa ubo, bahing ug hangin; mahimong gaan o grabe; ug adunay bakuna batok niini.",
    },
    caption: {
      en: "COVID-19 is a respiratory illness caused by a virus. It spreads through coughs, sneezes, and the air around an infected person. For most people it is mild, but it can turn severe — especially in older adults and people with other illnesses. And there is a vaccine against it.",
      tl: "Ang COVID-19 ay sakit sa paghinga na dulot ng virus. Kumakalat ito sa ubo, bahing, at sa hangin sa paligid ng taong may sakit. Magaan ito sa karamihan, pero maaari itong lumala — lalo na sa matatanda at sa may ibang karamdaman. At may bakuna laban dito.",
      ceb: "Ang COVID-19 usa ka sakit sa pagginhawa tungod sa virus. Mokatap kini pinaagi sa ubo, bahing, ug sa hangin palibot sa tawo nga may sakit. Gaan kini sa kadaghanan, apan mahimo kining mograbe — labi na sa mga tigulang ug sa adunay laing sakit. Ug adunay bakuna batok niini.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "covid19:symptoms": {
    src: "covid-symptoms-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Sintomas ng COVID-19' with a waving doctor and six panels of a sick man: fever, cough, sore throat, tiredness, loss of smell or taste, and difficulty breathing, above a strip reading 'May sintomas? Magpa-test.'",
      tl: "3D na nakalarawang poster na may pamagat na 'Sintomas ng COVID-19' na may doktor na kumakaway at anim na larawan ng lalaking may sakit: lagnat, ubo, masakit ang lalamunan, pagod, walang pang-amoy o panlasa, at hirap huminga, at sa ibaba: 'May sintomas? Magpa-test.'",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Sintomas ng COVID-19' nga adunay doktor nga nagkaway ug unom ka hulagway sa lalaki nga masakiton: hilanat, ubo, sakit sa tutunlan, kakapoy, walay pang-simhot o panlami, ug lisod pagginhawa, ug sa ubos: 'May sintomas? Magpa-test.'",
    },
    caption: {
      en: "Six signs: fever, cough, sore throat, tiredness, losing your sense of smell or taste, and difficulty breathing. If you have symptoms, get tested and keep away from others until you know. Difficulty breathing is the one that cannot wait — go to a hospital.",
      tl: "Anim na palatandaan: lagnat, ubo, masakit na lalamunan, pagod, pagkawala ng pang-amoy o panlasa, at hirap sa paghinga. Kung may sintomas, magpa-test at lumayo muna sa iba hangga't hindi pa alam ang resulta. Ang hirap sa paghinga ang hindi na dapat paghintayin — pumunta sa ospital.",
      ceb: "Unom ka timailhan: hilanat, ubo, sakit sa tutunlan, kakapoy, pagkawala sa pang-simhot o panlami, ug lisod pagginhawa. Kung adunay sintomas, magpa-test ug likay una sa uban hangtod mahibal-an ang resulta. Ang lisod pagginhawa mao ang dili na angay paabuton — adto sa ospital.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "covid19:treatment": {
    src: "covid-treatment-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Paggamot sa COVID-19' and 'Karamihan ay gumagaling sa bahay', with three green tiles — rest, drink plenty of water, paracetamol for fever — above a red panel listing when to go to hospital: chest pain, difficulty breathing, and oxygen below 94%.",
      tl: "3D na nakalarawang poster na may pamagat na 'Paggamot sa COVID-19' at 'Karamihan ay gumagaling sa bahay', na may tatlong berdeng bahagi — magpahinga, uminom ng maraming tubig, paracetamol para sa lagnat — at pulang bahagi kung kailan pupunta sa ospital: masakit ang dibdib, hirap huminga, at oxygen na mababa sa 94%.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Paggamot sa COVID-19' ug 'Karamihan ay gumagaling sa bahay', nga adunay tulo ka berde nga bahin — pagpahulay, pag-inom ug daghang tubig, paracetamol para sa hilanat — ug pula nga bahin kung kanus-a moadto sa ospital: sakit sa dughan, lisod pagginhawa, ug oxygen nga ubos sa 94%.",
    },
    caption: {
      en: "Most people recover at home: rest, drink plenty of water, and take paracetamol for fever. Go to a hospital at once for chest pain, difficulty breathing, or an oxygen reading below 94% on a pulse oximeter. Older adults and people with other illnesses should talk to a doctor early, while antiviral medicine can still help.",
      tl: "Karamihan ay gumagaling sa bahay: magpahinga, uminom ng maraming tubig, at uminom ng paracetamol para sa lagnat. Pumunta agad sa ospital kung masakit ang dibdib, hirap huminga, o mababa sa 94% ang oxygen sa pulse oximeter. Ang matatanda at may ibang karamdaman ay dapat kumonsulta agad sa doktor, habang makakatulong pa ang gamot laban sa virus.",
      ceb: "Kadaghanan mamaayo sa balay: pagpahulay, pag-inom ug daghang tubig, ug pag-inom ug paracetamol para sa hilanat. Adto dayon sa ospital kung sakit ang dughan, lisod pagginhawa, o ubos sa 94% ang oxygen sa pulse oximeter. Ang mga tigulang ug adunay laing sakit angay mokonsulta dayon sa doktor, samtang makatabang pa ang tambal batok sa virus.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "covid19:prevention": {
    src: "covid-prevention-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Pag-iwas sa COVID-19' with a doctor at the centre and five panels: get vaccinated, wear a mask in crowded places, wash your hands, open the windows, and stay home when sick.",
      tl: "3D na nakalarawang poster na may pamagat na 'Pag-iwas sa COVID-19' na may doktor sa gitna at limang bahagi: magpabakuna, mag-mask sa mataong lugar, maghugas ng kamay, buksan ang bintana, at manatili sa bahay kapag may sakit.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Pag-iwas sa COVID-19' nga adunay doktor sa tunga ug lima ka bahin: pagpabakuna, pagsul-ob ug mask sa daghang tawo, paghugas sa kamot, pag-abli sa bintana, ug pagpabilin sa balay kung masakiton.",
    },
    caption: {
      en: "Five ways to avoid COVID-19: get vaccinated, wear a mask in crowded places, wash your hands, open the windows so air can move, and stay home when you are sick. The vaccine does the most to keep an infection from turning severe.",
      tl: "Limang paraan para makaiwas sa COVID-19: magpabakuna, mag-mask sa mataong lugar, maghugas ng kamay, buksan ang bintana para umikot ang hangin, at manatili sa bahay kapag may sakit. Ang bakuna ang pinakamalaking tulong para hindi lumala ang impeksiyon.",
      ceb: "Lima ka paagi sa paglikay sa COVID-19: pagpabakuna, pagsul-ob ug mask sa daghang tawo, paghugas sa kamot, pag-abli sa bintana aron molihok ang hangin, ug pagpabilin sa balay kung masakiton. Ang bakuna ang labing dako nga tabang aron dili mograbe ang impeksiyon.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "covid19:lifestyle": {
    src: "covid-lifestyle-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Paggaling sa COVID-19' with a doctor above three panels — sleep: eight hours or more; nutrition: soup, fruit, eggs, and water; exercise: light movement first — and a strip reading 'avoid heavy exercise for one to two weeks'.",
      tl: "3D na nakalarawang poster na may pamagat na 'Paggaling sa COVID-19' na may doktor at tatlong bahagi — tulog: 8 oras o higit pa; nutrisyon: sabaw, prutas, itlog at tubig; ehersisyo: magaang galaw muna — at sa ibaba: 'iwas muna sa mabigat na ehersisyo nang 1 hanggang 2 linggo'.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Paggaling sa COVID-19' nga adunay doktor ug tulo ka bahin — tulog: 8 ka oras o kapin; nutrisyon: sabaw, prutas, itlog ug tubig; ehersisyo: gaan nga lihok una — ug sa ubos: 'likayi una ang bug-at nga ehersisyo sulod sa 1 ngadto sa 2 ka semana'.",
    },
    caption: {
      en: "Recovering from COVID-19: sleep eight hours or more; eat soup, fruit, and eggs, and drink plenty of water; and start with light movement only. Hold off heavy exercise for one to two weeks — and longer, with a doctor's advice, if you still get breathless or your chest hurts.",
      tl: "Paggaling sa COVID-19: matulog nang 8 oras o higit pa; kumain ng sabaw, prutas, at itlog, at uminom ng maraming tubig; at magaang galaw lamang muna. Iwasan ang mabigat na ehersisyo nang 1 hanggang 2 linggo — at mas matagal pa, ayon sa payo ng doktor, kung hinihingal ka pa o masakit ang dibdib.",
      ceb: "Pag-ayo gikan sa COVID-19: katulog ug 8 ka oras o kapin; kaon ug sabaw, prutas, ug itlog, ug inom ug daghang tubig; ug gaan nga lihok lang una. Likayi ang bug-at nga ehersisyo sulod sa 1 ngadto sa 2 ka semana — ug mas dugay pa, sumala sa tambag sa doktor, kung naghangos ka pa o sakit ang dughan.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── Influenza ────────────────────────────────────────────────────────────
  // Same dark-blue style as COVID-19. Two posters carry slips in the artwork;
  // see `prevention` and `lifestyle`.
  "influenza:overview": {
    src: "influenza-overview-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Ano ang trangkaso?' with a doctor pointing to a virus and lungs beside 'Nakakahawang sakit sa paghinga na dulot ng virus', three panels — spread by coughs and sneezes, more common in the rainy season, recovery in one to two weeks — and a yellow strip showing a baby, an elder, a pregnant woman, and a man with an inhaler.",
      tl: "3D na nakalarawang poster na may pamagat na 'Ano ang trangkaso?' na may doktor na nakaturo sa virus at baga sa tabi ng 'Nakakahawang sakit sa paghinga na dulot ng virus', tatlong bahagi — kumakalat sa ubo at bahing, mas marami tuwing tag-ulan, gumagaling sa 1 hanggang 2 linggo — at dilaw na bahagi na may sanggol, matanda, buntis, at lalaking may inhaler.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Ano ang trangkaso?' nga adunay doktor nga nagtudlo sa virus ug baga tupad sa 'Nakakahawang sakit sa paghinga na dulot ng virus', tulo ka bahin — mokatap pinaagi sa ubo ug bahing, mas daghan panahon sa ting-ulan, mamaayo sulod sa 1 ngadto sa 2 ka semana — ug dalag nga bahin nga adunay bata, tigulang, mabdos, ug lalaki nga may inhaler.",
    },
    caption: {
      en: "Flu is a contagious respiratory illness caused by a virus. It spreads through coughs and sneezes, is more common in the rainy season, and usually clears in one to two weeks. Take extra care with babies, older adults, pregnant women, and anyone with a lung condition such as asthma — flu hits them hardest.",
      tl: "Ang trangkaso ay nakakahawang sakit sa paghinga na dulot ng virus. Kumakalat ito sa ubo at bahing, mas marami tuwing tag-ulan, at kadalasang gumagaling sa 1 hanggang 2 linggo. Mag-ingat lalo sa mga sanggol, matatanda, buntis, at sinumang may sakit sa baga gaya ng hika — sila ang pinakatinatamaan nang malala.",
      ceb: "Ang trangkaso usa ka makatakod nga sakit sa pagginhawa tungod sa virus. Mokatap kini pinaagi sa ubo ug bahing, mas daghan panahon sa ting-ulan, ug kasagaran mamaayo sulod sa 1 ngadto sa 2 ka semana. Pag-amping labi na sa mga bata, tigulang, mabdos, ug bisan kinsa nga adunay sakit sa baga sama sa hika — sila ang labing grabe nga maigo.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "influenza:symptoms": {
    src: "influenza-symptoms-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Sintomas ng trangkaso' and 'Lumalabas 1 hanggang 4 na araw matapos mahawa', with a doctor and six panels: sudden fever, chills and body aches, headache, dry cough, sore throat and runny nose, and weakness, above a red strip reading 'Hirap huminga? Magpatingin agad.'",
      tl: "3D na nakalarawang poster na may pamagat na 'Sintomas ng trangkaso' at 'Lumalabas 1 hanggang 4 na araw matapos mahawa', na may doktor at anim na bahagi: biglang lagnat, panginginig at pananakit ng katawan, sakit ng ulo, tuyong ubo, masakit ang lalamunan at sipon, at panghihina, at pulang bahagi: 'Hirap huminga? Magpatingin agad.'",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Sintomas ng trangkaso' ug 'Lumalabas 1 hanggang 4 na araw matapos mahawa', nga adunay doktor ug unom ka bahin: kalit nga hilanat, katugnaw ug sakit sa lawas, sakit sa ulo, uga nga ubo, sakit sa tutunlan ug sip-on, ug kaluya, ug pula nga bahin: 'Hirap huminga? Magpatingin agad.'",
    },
    caption: {
      en: "Flu shows itself one to four days after you catch it, and it comes on suddenly: fever, chills and body aches, headache, a dry cough, sore throat and runny nose, and weakness. The sudden start is what sets it apart from a cold. If breathing becomes hard, see a doctor at once.",
      tl: "Lumalabas ang trangkaso 1 hanggang 4 na araw matapos mahawa, at bigla itong dumarating: lagnat, panginginig at pananakit ng katawan, sakit ng ulo, tuyong ubo, masakit na lalamunan at sipon, at panghihina. Ang biglang pagdating nito ang pinagkaiba nito sa karaniwang sipon. Kung nahihirapan nang huminga, magpatingin agad.",
      ceb: "Mogawas ang trangkaso 1 ngadto sa 4 ka adlaw human matakdan, ug kalit kini nga moabot: hilanat, katugnaw ug sakit sa lawas, sakit sa ulo, uga nga ubo, sakit sa tutunlan ug sip-on, ug kaluya. Ang kalit nga pag-abot niini mao ang kalainan niini sa ordinaryong sip-on. Kung maglisod na pagginhawa, pagpatan-aw dayon.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "influenza:treatment": {
    src: "influenza-treatment-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Paggamot sa trangkaso' with a green panel of home care — rest, drink water, paracetamol for fever — a yellow panel on antiviral medicine prescribed by a doctor, two red warnings — no aspirin for children; antibiotics are not for viruses — and a strip reading 'Hirap huminga? Pumunta agad sa ospital.'",
      tl: "3D na nakalarawang poster na may pamagat na 'Paggamot sa trangkaso' na may berdeng bahagi para sa bahay — magpahinga, uminom ng tubig, paracetamol sa lagnat — dilaw na bahagi tungkol sa gamot laban sa virus na reseta ng doktor, dalawang pulang babala — walang aspirin sa bata; ang antibiyotiko ay hindi para sa virus — at sa ibaba: 'Hirap huminga? Pumunta agad sa ospital.'",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Paggamot sa trangkaso' nga adunay berde nga bahin para sa balay — pagpahulay, pag-inom ug tubig, paracetamol sa hilanat — dalag nga bahin bahin sa tambal batok sa virus nga reseta sa doktor, duha ka pula nga pasidaan — walay aspirin sa bata; ang antibiotic dili para sa virus — ug sa ubos: 'Hirap huminga? Pumunta agad sa ospital.'",
    },
    caption: {
      en: "At home, to feel better: rest, drink water, and take paracetamol for fever. There is antiviral medicine for flu, on a doctor's prescription, and it works best when started early — within the first two days. Never give aspirin to a child with flu, and do not take antibiotics for it: they do nothing against a virus. If breathing becomes hard, go to a hospital at once.",
      tl: "Sa bahay, para gumaan ang pakiramdam: magpahinga, uminom ng tubig, at uminom ng paracetamol para sa lagnat. May gamot laban sa virus ng trangkaso, sa reseta ng doktor, at pinakamabisa ito kung sinimulan nang maaga — sa unang dalawang araw. Huwag bigyan ng aspirin ang batang may trangkaso, at huwag uminom ng antibiyotiko para dito: wala itong epekto sa virus. Kung nahihirapang huminga, pumunta agad sa ospital.",
      ceb: "Sa balay, aron mogaan ang pamati: pagpahulay, pag-inom ug tubig, ug pag-inom ug paracetamol para sa hilanat. Adunay tambal batok sa virus sa trangkaso, sa reseta sa doktor, ug labing epektibo kini kung sugdan dayon — sa unang duha ka adlaw. Ayaw hatagi ug aspirin ang bata nga may trangkaso, ug ayaw pag-inom ug antibiotic para niini: walay epekto kini sa virus. Kung maglisod pagginhawa, adto dayon sa ospital.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "influenza:prevention": {
    // STRAY CHARACTER — the bottom strip reads "MAY SAKIT? SA BAHAY 7 MUNA."
    // The "7" does not belong; the line means "sick? stay home first". A
    // reader may take it as "stay home for 7 days", which is not the advice:
    // the usual rule is to stay home until a full day without fever. The
    // caption says so. The artwork wants the "7" removed.
    src: "influenza-prevention-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Pag-iwas sa trangkaso' with a man showing a plaster on his arm beside 'Magpabakuna taon-taon', a doctor, and four panels — wash your hands, cough into your elbow, cover your nose and mouth, don't touch your face — above a strip of a woman resting on a sofa.",
      tl: "3D na nakalarawang poster na may pamagat na 'Pag-iwas sa trangkaso' na may lalaking may plaster sa braso sa tabi ng 'Magpabakuna taon-taon', doktor, at apat na bahagi — maghugas ng kamay, umubo sa siko, takpan ang ilong at bibig, huwag hawakan ang mukha — at babaeng nagpapahinga sa sopa sa ibaba.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Pag-iwas sa trangkaso' nga adunay lalaki nga may plaster sa bukton tupad sa 'Magpabakuna taon-taon', doktor, ug upat ka bahin — paghugas sa kamot, pag-ubo sa siko, pagtabon sa ilong ug baba, ayaw paghikap sa nawong — ug babaye nga nagpahulay sa sopa sa ubos.",
    },
    caption: {
      en: "The yearly flu vaccine is the strongest protection, especially for elders and children. On top of it: wash your hands, cough into your elbow, cover your nose and mouth, and keep your hands off your face. If you do get sick, stay home until you have gone a full day without fever, without medicine to bring it down.",
      tl: "Ang taunang bakuna laban sa trangkaso ang pinakamatibay na proteksyon, lalo na sa matatanda at mga bata. Dagdag dito: maghugas ng kamay, umubo sa siko, takpan ang ilong at bibig, at huwag hawakan ang mukha. Kung magkasakit ka, manatili sa bahay hanggang lumipas ang isang buong araw na walang lagnat, nang hindi umiinom ng gamot pampababa nito.",
      ceb: "Ang tinuig nga bakuna batok sa trangkaso ang labing lig-on nga panalipod, labi na sa mga tigulang ug bata. Dugang niini: paghugas sa kamot, pag-ubo sa siko, pagtabon sa ilong ug baba, ug ayaw paghikap sa nawong. Kung masakit ka, pabilin sa balay hangtod molabay ang usa ka tibuok adlaw nga walay hilanat, nga wala moinom ug tambal nga mopaubos niini.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "influenza:lifestyle": {
    // FOUR SLIPS IN THE ARTWORK — the headline reads "PAGGALING SA TRANKASO"
    // (for "trangkaso"), and the panels read "FRUTAS" (for "prutas"),
    // "BUMALIC" (for "bumalik"), and "CIGARILYO" (for "sigarilyo"). The
    // nutrition panel is also headed in English, "NUTRITION", where every
    // other poster says "NUTRISYON". None changes the advice, but four on one
    // poster is enough to look careless; it wants re-lettering.
    src: "influenza-lifestyle-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Paggaling sa trangkaso' with a doctor beside three panels — sleep: eight to ten hours a night; nutrition: rice porridge, soup, fruit, and plenty of water; exercise: return to activity slowly after a day without fever — and a strip reading 'avoid alcohol and cigarettes'.",
      tl: "3D na nakalarawang poster na may pamagat na 'Paggaling sa trangkaso' na may doktor at tatlong bahagi — tulog: 8 hanggang 10 oras gabi-gabi; nutrisyon: lugaw, sabaw, prutas at maraming tubig; ehersisyo: bumalik sa gawain nang dahan-dahan kapag isang araw nang walang lagnat — at sa ibaba: 'iwasan ang alak at sigarilyo'.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Paggaling sa trangkaso' nga adunay doktor ug tulo ka bahin — tulog: 8 ngadto sa 10 ka oras matag gabii; nutrisyon: lugaw, sabaw, prutas ug daghang tubig; ehersisyo: balik sa buluhaton hinay-hinay kung usa na ka adlaw nga walay hilanat — ug sa ubos: 'likayi ang ilimnon ug sigarilyo'.",
    },
    caption: {
      en: "Recovering from flu: sleep eight to ten hours a night; eat rice porridge, soup, and fruit, and drink plenty of water; and go back to your usual activities slowly, once you have gone a full day without fever and without medicine. Stay away from alcohol and cigarettes while you heal.",
      tl: "Paggaling sa trangkaso: matulog nang 8 hanggang 10 oras gabi-gabi; kumain ng lugaw, sabaw, at prutas, at uminom ng maraming tubig; at bumalik sa karaniwang gawain nang dahan-dahan, kapag isang buong araw ka nang walang lagnat nang hindi umiinom ng gamot. Iwasan ang alak at sigarilyo habang nagpapagaling.",
      ceb: "Pag-ayo gikan sa trangkaso: katulog ug 8 ngadto sa 10 ka oras matag gabii; kaon ug lugaw, sabaw, ug prutas, ug inom ug daghang tubig; ug balik sa naandang buluhaton hinay-hinay, kung usa na ka tibuok adlaw nga walay hilanat nga wala moinom ug tambal. Likayi ang ilimnon ug sigarilyo samtang nag-ayo.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── Bronchitis ───────────────────────────────────────────────────────────
  // Same dark-blue style. This set draws the line between acute ("biglaan")
  // and chronic ("matagalan") bronchitis on three of its five posters, which
  // the old set never did. The old "BONCHITIS" / "BRONKITIS" headlines are gone.
  "bronchitis:overview": {
    src: "bronchitis-overview-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Ano ang bronchitis?' with a doctor beside inflamed airways and the words 'Pamamaga ng daanan ng hangin sa baga', two panels — acute: caused by a virus, clears in one to three weeks; chronic: usually from smoking — and a strip reading 'main symptom: cough with phlegm'.",
      tl: "3D na nakalarawang poster na may pamagat na 'Ano ang bronchitis?' na may doktor sa tabi ng namamagang daanan ng hangin at 'Pamamaga ng daanan ng hangin sa baga', dalawang bahagi — biglaan: dulot ng virus, gumagaling sa 1 hanggang 3 linggo; matagalan: kadalasan dahil sa paninigarilyo — at sa ibaba: 'pangunahing sintomas: ubo na may plema'.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Ano ang bronchitis?' nga adunay doktor tupad sa nanghubag nga agianan sa hangin ug 'Pamamaga ng daanan ng hangin sa baga', duha ka bahin — kalit: tungod sa virus, mamaayo sulod sa 1 ngadto sa 3 ka semana; dugay: kasagaran tungod sa pagpanigarilyo — ug sa ubos: 'pangunang sintomas: ubo nga may plema'.",
    },
    caption: {
      en: "Bronchitis is inflammation of the airways that carry air into the lungs. Acute bronchitis comes on suddenly, is usually caused by a virus, and clears in one to three weeks. Chronic bronchitis lasts for months and comes back, and is usually caused by smoking. Either way, the main symptom is a cough with phlegm.",
      tl: "Ang bronchitis ay pamamaga ng daanan ng hangin papunta sa baga. Ang biglaang bronchitis ay kadalasang dulot ng virus at gumagaling sa 1 hanggang 3 linggo. Ang matagalang bronchitis ay tumatagal nang ilang buwan at bumabalik, at kadalasang dahil sa paninigarilyo. Alinman dito, ubo na may plema ang pangunahing sintomas.",
      ceb: "Ang bronchitis mao ang panghubag sa agianan sa hangin paingon sa baga. Ang kalit nga bronchitis kasagaran tungod sa virus ug mamaayo sulod sa 1 ngadto sa 3 ka semana. Ang dugay nga bronchitis molungtad ug pipila ka bulan ug mobalik, ug kasagaran tungod sa pagpanigarilyo. Bisan asa niini, ubo nga may plema ang pangunang sintomas.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "bronchitis:symptoms": {
    src: "bronchitis-symptoms-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Sintomas ng bronchitis' with a waving doctor and six panels — cough with phlegm, mild fever, tight chest, wheezing, slight breathlessness, and tiredness — above a red panel: see a doctor for a cough of two weeks or more, blood in the phlegm, or high fever.",
      tl: "3D na nakalarawang poster na may pamagat na 'Sintomas ng bronchitis' na may doktor na kumakaway at anim na bahagi — ubo na may plema, bahagyang lagnat, masikip ang dibdib, may sipol ang paghinga, kaunting hirap huminga, at pagod — at pulang bahagi: magpatingin kung ubo na 2 linggo o higit, may dugo ang plema, o mataas ang lagnat.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Sintomas ng bronchitis' nga adunay doktor nga nagkaway ug unom ka bahin — ubo nga may plema, gamay nga hilanat, hugot ang dughan, may agihis ang pagginhawa, gamay nga kalisod sa pagginhawa, ug kakapoy — ug pula nga bahin: pagpatan-aw kung ubo nga 2 ka semana o kapin, may dugo ang plema, o taas ang hilanat.",
    },
    caption: {
      en: "Six signs: a cough with phlegm, mild fever, a tight chest, wheezing, some difficulty breathing, and tiredness. See a doctor if the cough lasts two weeks or more, if there is blood in the phlegm, or if the fever runs high. A cough of two weeks or more is also the point to be checked for TB.",
      tl: "Anim na palatandaan: ubo na may plema, bahagyang lagnat, masikip na dibdib, may sipol ang paghinga, kaunting hirap sa paghinga, at pagod. Magpatingin kung ang ubo ay 2 linggo o higit pa, kung may dugo ang plema, o kung mataas ang lagnat. Ang ubo na 2 linggo o higit pa ay dapat ding ipasuri para sa TB.",
      ceb: "Unom ka timailhan: ubo nga may plema, gamay nga hilanat, hugot nga dughan, may agihis ang pagginhawa, gamay nga kalisod sa pagginhawa, ug kakapoy. Pagpatan-aw kung ang ubo 2 ka semana o kapin, kung may dugo ang plema, o kung taas ang hilanat. Ang ubo nga 2 ka semana o kapin angay usab ipasusi para sa TB.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "bronchitis:treatment": {
    src: "bronchitis-treatment-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Paggamot sa bronchitis' with a green panel for acute bronchitis — rest, drink water, paracetamol for fever, avoid smoke; clears by itself in one to three weeks — a yellow panel for chronic bronchitis — needs a doctor; stop smoking and follow the prescription — a note that antibiotics are usually not needed, and a strip reading 'Hirap huminga? Pumunta agad sa ospital.'",
      tl: "3D na nakalarawang poster na may pamagat na 'Paggamot sa bronchitis' na may berdeng bahagi para sa biglaan — magpahinga, uminom ng tubig, paracetamol sa lagnat, iwasan ang usok; kusang gumagaling sa 1 hanggang 3 linggo — dilaw na bahagi para sa matagalan — kailangan ng doktor; tumigil sa paninigarilyo at sundin ang reseta — paalalang kadalasan ay hindi kailangan ang antibiyotiko, at sa ibaba: 'Hirap huminga? Pumunta agad sa ospital.'",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Paggamot sa bronchitis' nga adunay berde nga bahin para sa kalit — pagpahulay, pag-inom ug tubig, paracetamol sa hilanat, likayi ang aso; kusang mamaayo sulod sa 1 ngadto sa 3 ka semana — dalag nga bahin para sa dugay — kinahanglan ang doktor; hunong sa pagpanigarilyo ug sunda ang reseta — pahinumdom nga kasagaran dili kinahanglan ang antibiotic, ug sa ubos: 'Hirap huminga? Pumunta agad sa ospital.'",
    },
    caption: {
      en: "Acute bronchitis usually clears by itself in one to three weeks: rest, drink water, take paracetamol for fever, and keep away from smoke. Chronic bronchitis needs a doctor — stop smoking and follow the prescription. Antibiotics are usually not needed, because most bronchitis is caused by a virus. If breathing becomes hard, go to a hospital at once.",
      tl: "Ang biglaang bronchitis ay kadalasang kusang gumagaling sa 1 hanggang 3 linggo: magpahinga, uminom ng tubig, uminom ng paracetamol para sa lagnat, at iwasan ang usok. Ang matagalang bronchitis ay nangangailangan ng doktor — tumigil sa paninigarilyo at sundin ang reseta. Kadalasan ay hindi kailangan ang antibiyotiko, dahil virus ang sanhi ng karamihan ng bronchitis. Kung nahihirapang huminga, pumunta agad sa ospital.",
      ceb: "Ang kalit nga bronchitis kasagaran kusang mamaayo sulod sa 1 ngadto sa 3 ka semana: pagpahulay, pag-inom ug tubig, pag-inom ug paracetamol para sa hilanat, ug likayi ang aso. Ang dugay nga bronchitis nagkinahanglan ug doktor — hunong sa pagpanigarilyo ug sunda ang reseta. Kasagaran dili kinahanglan ang antibiotic, kay virus ang hinungdan sa kadaghanan sa bronchitis. Kung maglisod pagginhawa, adto dayon sa ospital.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "bronchitis:prevention": {
    src: "bronchitis-prevention-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Pag-iwas sa bronchitis' with a doctor beside a broken, crossed-out cigarette reading 'Huwag manigarilyo', and five panels: avoid other people's smoke, wash your hands, cover your nose and mouth against dust, open the windows, and get vaccinated against flu and pneumonia.",
      tl: "3D na nakalarawang poster na may pamagat na 'Pag-iwas sa bronchitis' na may doktor sa tabi ng sigarilyong may ekis at 'Huwag manigarilyo', at limang bahagi: iwasan ang usok ng iba, maghugas ng kamay, takpan ang ilong at bibig sa alikabok, buksan ang bintana, at magpabakuna laban sa trangkaso at pulmonya.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Pag-iwas sa bronchitis' nga adunay doktor tupad sa sigarilyo nga may ekis ug 'Huwag manigarilyo', ug lima ka bahin: likayi ang aso sa uban, paghugas sa kamot, pagtabon sa ilong ug baba sa abog, pag-abli sa bintana, ug pagpabakuna batok sa trangkaso ug pulmonya.",
    },
    caption: {
      en: "Not smoking matters most — smoke is the single biggest irritant to the airways. After that: keep away from other people's smoke, wash your hands, cover your nose and mouth in dust, open the windows, and get the flu and pneumonia vaccines, since those infections are what usually set acute bronchitis off.",
      tl: "Ang hindi paninigarilyo ang pinakamahalaga — ang usok ang pinakamalaking nakakairita sa daanan ng hangin. Kasunod nito: iwasan ang usok ng iba, maghugas ng kamay, takpan ang ilong at bibig kapag maalikabok, buksan ang bintana, at magpabakuna laban sa trangkaso at pulmonya, dahil ang mga impeksiyong ito ang kadalasang nagsisimula ng biglaang bronchitis.",
      ceb: "Ang dili pagpanigarilyo ang labing importante — ang aso mao ang labing dako nga makapasuko sa agianan sa hangin. Sunod niini: likayi ang aso sa uban, paghugas sa kamot, pagtabon sa ilong ug baba kung abogon, pag-abli sa bintana, ug pagpabakuna batok sa trangkaso ug pulmonya, kay kini nga mga impeksiyon ang kasagaran mosugod sa kalit nga bronchitis.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "bronchitis:lifestyle": {
    src: "bronchitis-lifestyle-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Paggaling sa bronchitis' with a doctor beside four panels — sleep with your head raised; plenty of water, fruit, and vegetables; a light walk once the cough eases; and breathe in through the nose, out slowly through the mouth.",
      tl: "3D na nakalarawang poster na may pamagat na 'Paggaling sa bronchitis' na may doktor at apat na bahagi — matulog nang nakataas ang ulo; maraming tubig, prutas at gulay; magaang lakad kapag gumaan na ang ubo; at huminga sa ilong, ibuga nang dahan-dahan sa bibig.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Paggaling sa bronchitis' nga adunay doktor ug upat ka bahin — katulog nga taas ang ulo; daghang tubig, prutas ug utanon; gaan nga lakaw kung mogaan na ang ubo; ug ginhawa sa ilong, buga hinay-hinay sa baba.",
    },
    caption: {
      en: "Recovering from bronchitis: sleep with your head raised, which eases the night cough; drink plenty of water and eat fruit and vegetables, since fluids loosen the phlegm; take light walks once the cough eases; and practise breathing in through your nose and out slowly through pursed lips.",
      tl: "Paggaling sa bronchitis: matulog nang nakataas ang ulo, na nagpapagaan ng ubo sa gabi; uminom ng maraming tubig at kumain ng prutas at gulay, dahil pinalalabnaw ng likido ang plema; maglakad nang magaan kapag gumaan na ang ubo; at sanayin ang paghinga sa ilong at dahan-dahang pagbuga sa bibig.",
      ceb: "Pag-ayo gikan sa bronchitis: katulog nga taas ang ulo, nga mopagaan sa ubo sa gabii; inom ug daghang tubig ug kaon ug prutas ug utanon, kay ang tubig mopanipis sa plema; lakaw nga gaan kung mogaan na ang ubo; ug batasana ang pagginhawa sa ilong ug hinay-hinay nga pagbuga sa baba.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── COPD ─────────────────────────────────────────────────────────────────
  // Same dark-blue style. Two of the five name cooking smoke from wood fires,
  // which matters here: it is a leading cause of COPD in Philippine homes
  // where nobody smokes.
  "copd:overview": {
    src: "copd-overview-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Ano ang COPD?' with a doctor beside damaged lungs and the words 'Matagalang sakit sa baga na nagpapahirap huminga', four causes — cigarettes, cooking smoke, dust at work, and polluted air — and a green strip reading 'Hindi na nawawala, pero nakokontrol'.",
      tl: "3D na nakalarawang poster na may pamagat na 'Ano ang COPD?' na may doktor sa tabi ng sirang baga at 'Matagalang sakit sa baga na nagpapahirap huminga', apat na sanhi — sigarilyo, usok sa pagluluto, alikabok sa trabaho, at maruming hangin — at berdeng bahagi: 'Hindi na nawawala, pero nakokontrol'.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Ano ang COPD?' nga adunay doktor tupad sa nadaot nga baga ug 'Matagalang sakit sa baga na nagpapahirap huminga', upat ka hinungdan — sigarilyo, aso sa pagluto, abog sa trabaho, ug hugaw nga hangin — ug berde nga bahin: 'Hindi na nawawala, pero nakokontrol'.",
    },
    caption: {
      en: "COPD is a long-term lung disease that makes breathing hard. Its four main causes: cigarettes, smoke from cooking over wood or charcoal, dust at work, and polluted air. It does not go away, but it can be controlled — and the earlier it is found, the more breath you keep.",
      tl: "Ang COPD ay matagalang sakit sa baga na nagpapahirap huminga. Ang apat na pangunahing sanhi nito: sigarilyo, usok sa pagluluto gamit ang kahoy o uling, alikabok sa trabaho, at maruming hangin. Hindi na ito nawawala, pero nakokontrol — at kapag maagang natuklasan, mas maraming hininga ang naiingatan.",
      ceb: "Ang COPD usa ka dugay nga sakit sa baga nga makapalisod sa pagginhawa. Ang upat ka pangunang hinungdan niini: sigarilyo, aso sa pagluto gamit ang kahoy o uling, abog sa trabaho, ug hugaw nga hangin. Dili na kini mawala, apan makontrol — ug kung sayo nga makit-an, mas daghang ginhawa ang maluwas.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "copd:symptoms": {
    src: "copd-symptoms-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Sintomas ng COPD' and 'Dahan-dahang lumalala', with six panels of older adults — breathless on moving, long-lasting cough with phlegm, wheezing, tight chest, tiring easily, and frequent chest infections — a red panel on when to go to hospital, and a strip reading '40 pataas at naninigarilyo? Magpasuri ng baga.'",
      tl: "3D na nakalarawang poster na may pamagat na 'Sintomas ng COPD' at 'Dahan-dahang lumalala', na may anim na larawan ng matatanda — hinihingal kapag gumagalaw, matagal na ubo na may plema, may sipol ang paghinga, masikip ang dibdib, madaling mapagod, at madalas magkasakit sa baga — pulang bahagi kung kailan pupunta sa ospital, at sa ibaba: '40 pataas at naninigarilyo? Magpasuri ng baga.'",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Sintomas ng COPD' ug 'Dahan-dahang lumalala', nga adunay unom ka hulagway sa mga tigulang — naghangos kung molihok, dugay nga ubo nga may plema, may agihis ang pagginhawa, hugot ang dughan, dali makapoy, ug kanunay magsakit ang baga — pula nga bahin kung kanus-a moadto sa ospital, ug sa ubos: '40 pataas at naninigarilyo? Magpasuri ng baga.'",
    },
    caption: {
      en: "COPD worsens slowly, so its signs are easy to mistake for ageing: breathlessness when you move, a long-lasting cough with phlegm, wheezing, a tight chest, tiring easily, and frequent chest infections. Go to a hospital at once for severe breathlessness or lips and nails turning blue. Over 40 and a smoker? Have your lungs checked.",
      tl: "Dahan-dahang lumalala ang COPD, kaya madaling mapagkamalang pagtanda lang ang mga palatandaan nito: hinihingal kapag gumagalaw, matagal na ubo na may plema, may sipol ang paghinga, masikip ang dibdib, madaling mapagod, at madalas magkasakit sa baga. Pumunta agad sa ospital kung sobrang hirap huminga o kulay asul ang labi o kuko. 40 pataas at naninigarilyo? Magpasuri ng baga.",
      ceb: "Hinay-hinay nga mograbe ang COPD, mao nga dali kining masayop nga pagkatigulang lang: naghangos kung molihok, dugay nga ubo nga may plema, may agihis ang pagginhawa, hugot ang dughan, dali makapoy, ug kanunay magsakit ang baga. Adto dayon sa ospital kung grabe ang kalisod sa pagginhawa o asul na ang ngabil o kuko. 40 pataas ug nanigarilyo? Pasusia ang baga.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "copd:treatment": {
    src: "copd-treatment-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Paggamot sa COPD' and 'Hindi na nawawala, pero nakokontrol', with a gold panel reading 'Pinakamahalaga: tumigil sa paninigarilyo', four panels — inhaler as prescribed, breathing exercises, oxygen if severe, and vaccines against flu and pneumonia — and a strip reading 'Biglang lumala ang hingal? Magpatingin agad.'",
      tl: "3D na nakalarawang poster na may pamagat na 'Paggamot sa COPD' at 'Hindi na nawawala, pero nakokontrol', na may gintong bahagi: 'Pinakamahalaga: tumigil sa paninigarilyo', apat na bahagi — inhaler ayon sa reseta ng doktor, pagsasanay sa paghinga, oxygen kung malala, at bakuna laban sa trangkaso at pulmonya — at sa ibaba: 'Biglang lumala ang hingal? Magpatingin agad.'",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Paggamot sa COPD' ug 'Hindi na nawawala, pero nakokontrol', nga adunay bulawan nga bahin: 'Pinakamahalaga: tumigil sa paninigarilyo', upat ka bahin — inhaler sumala sa reseta sa doktor, pagbansay sa pagginhawa, oxygen kung grabe, ug bakuna batok sa trangkaso ug pulmonya — ug sa ubos: 'Biglang lumala ang hingal? Magpatingin agad.'",
    },
    caption: {
      en: "COPD cannot be undone, but it can be controlled. Stopping smoking matters more than anything else. After that: use your inhaler as the doctor prescribed, practise breathing exercises, use oxygen if the disease is severe, and get the flu and pneumonia vaccines. If your breathlessness suddenly gets worse, see a doctor at once.",
      tl: "Hindi na maibabalik ang nasira ng COPD, pero nakokontrol ito. Ang pagtigil sa paninigarilyo ang pinakamahalaga sa lahat. Kasunod nito: gamitin ang inhaler ayon sa reseta ng doktor, magsanay sa paghinga, gumamit ng oxygen kung malala na, at magpabakuna laban sa trangkaso at pulmonya. Kung biglang lumala ang hingal, magpatingin agad.",
      ceb: "Dili na mabalik ang nadaot sa COPD, apan makontrol kini. Ang paghunong sa pagpanigarilyo ang labing importante sa tanan. Sunod niini: gamita ang inhaler sumala sa reseta sa doktor, pagbansay sa pagginhawa, paggamit ug oxygen kung grabe na, ug pagpabakuna batok sa trangkaso ug pulmonya. Kung kalit nga mograbe ang paghangos, pagpatan-aw dayon.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "copd:prevention": {
    src: "copd-prevention-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Pag-iwas sa COPD' with a waving doctor, a crossed-out cigarette reading 'Huwag manigarilyo, o tumigil na', and four panels: avoid other people's smoke, open the window when cooking, cover your nose and mouth at work, and have a long-lasting cough checked early.",
      tl: "3D na nakalarawang poster na may pamagat na 'Pag-iwas sa COPD' na may doktor na kumakaway, sigarilyong may ekis at 'Huwag manigarilyo, o tumigil na', at apat na bahagi: iwasan ang usok ng iba, buksan ang bintana kapag nagluluto, takpan ang ilong at bibig sa trabaho, at ipatingin agad ang matagal na ubo.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Pag-iwas sa COPD' nga adunay doktor nga nagkaway, sigarilyo nga may ekis ug 'Huwag manigarilyo, o tumigil na', ug upat ka bahin: likayi ang aso sa uban, abliha ang bintana kung nagluto, tabuni ang ilong ug baba sa trabaho, ug ipatan-aw dayon ang dugay nga ubo.",
    },
    caption: {
      en: "Don't smoke — or stop now; it is never too late for the lungs to benefit. Then: keep away from other people's smoke, open the window when you cook, cover your nose and mouth against dust and fumes at work, and have a long-lasting cough checked early, before the damage builds up.",
      tl: "Huwag manigarilyo — o tumigil na ngayon; hindi pa huli para makinabang ang baga. Kasunod nito: iwasan ang usok ng iba, buksan ang bintana kapag nagluluto, takpan ang ilong at bibig laban sa alikabok at usok sa trabaho, at ipatingin agad ang matagal na ubo, bago pa lumala ang pinsala.",
      ceb: "Ayaw panigarilyo — o hunong na karon; dili pa ulahi aron makabenepisyo ang baga. Sunod niini: likayi ang aso sa uban, abliha ang bintana kung nagluto, tabuni ang ilong ug baba batok sa abog ug aso sa trabaho, ug ipatan-aw dayon ang dugay nga ubo, sa dili pa modako ang kadaot.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "copd:lifestyle": {
    // The first panel reads "Huminga sa pagitan ng trabaho", over a picture of
    // a man resting in an armchair between chores. "Huminga" is "breathe";
    // "rest" is "magpahinga". The drawing makes the meaning plain, and the
    // caption says "rest".
    src: "copd-lifestyle-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Maayos na pamumuhay na may COPD' with a doctor beside three panels — sleep and rest: rest between chores; nutrition: small, frequent meals with protein; exercise: walk 20 to 30 minutes if you can — and two tiles: breathe in deeply through the nose and out slowly through the mouth, and always carry your inhaler.",
      tl: "3D na nakalarawang poster na may pamagat na 'Maayos na pamumuhay na may COPD' na may doktor at tatlong bahagi — tulog at hinga: magpahinga sa pagitan ng gawain; nutrisyon: paunti-unti pero madalas, kumain ng protina; ehersisyo: maglakad ng 20-30 minuto kung kaya — at dalawang bahagi: huminga nang malalim sa ilong at dahan-dahang ilabas sa bibig, at laging magdala ng inhaler.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Maayos na pamumuhay na may COPD' nga adunay doktor ug tulo ka bahin — tulog ug pahulay: pahulay taliwala sa buluhaton; nutrisyon: gamay pero kanunay, kaon ug protina; ehersisyo: lakaw ug 20-30 ka minuto kung makaya — ug duha ka bahin: ginhawa ug lawom sa ilong ug hinay-hinay nga buga sa baba, ug kanunay magdala ug inhaler.",
    },
    caption: {
      en: "Living well with COPD: rest between chores instead of pushing through; eat small, frequent meals with protein, since a full stomach crowds the lungs; walk 20 to 30 minutes a day if you can; breathe in deeply through your nose and out slowly through your mouth; and always carry your inhaler.",
      tl: "Maayos na pamumuhay na may COPD: magpahinga sa pagitan ng gawain sa halip na pilitin; kumain nang paunti-unti pero madalas, na may protina, dahil ang busog na tiyan ay sumisikip sa baga; maglakad nang 20 hanggang 30 minuto araw-araw kung kaya; huminga nang malalim sa ilong at dahan-dahang ilabas sa bibig; at laging magdala ng inhaler.",
      ceb: "Maayong pagkinabuhi uban sa COPD: pahulay taliwala sa buluhaton imbes nga pugson; kaon ug gamay pero kanunay, nga may protina, kay ang busog nga tiyan mopugos sa baga; lakaw ug 20 ngadto sa 30 ka minuto matag adlaw kung makaya; ginhawa ug lawom sa ilong ug hinay-hinay nga buga sa baba; ug kanunay magdala ug inhaler.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── Asthma ───────────────────────────────────────────────────────────────
  // Same dark-blue style. Four of the five say "hika"; the treatment poster
  // alone says "asthma", and carries this set's text slips — see that entry.
  // The symptoms poster still leads with wheezing, which is the right picture
  // for this slot: asthma's hallmark is wheeze and chest tightness, not a
  // productive cough.
  "asthma:overview": {
    src: "asthma-overview-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Ano ang hika?' with a doctor beside a normal and a narrowed, swollen airway and the words 'Sumisikip at namamaga ang daanan ng hangin', four triggers — dust, smoke, pet fur, and colds and flu — and two panels: not contagious, and controllable with the right medicine.",
      tl: "3D na nakalarawang poster na may pamagat na 'Ano ang hika?' na may doktor sa tabi ng normal at namamagang daanan ng hangin at 'Sumisikip at namamaga ang daanan ng hangin', apat na nagpapasumpong — alikabok, usok, balahibo ng alaga, at sipon at trangkaso — at dalawang bahagi: hindi nakakahawa, at kayang kontrolin sa tamang gamot.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Ano ang hika?' nga adunay doktor tupad sa normal ug nanghubag nga agianan sa hangin ug 'Sumisikip at namamaga ang daanan ng hangin', upat ka makapasumpong — abog, aso, balahibo sa binuhi, ug sip-on ug trangkaso — ug duha ka bahin: dili makatakod, ug makontrol sa hustong tambal.",
    },
    caption: {
      en: "In asthma, the airways tighten and swell, so less air gets through. Attacks are set off by triggers — dust, smoke, pet fur, and colds and flu are the common ones. Asthma is not contagious. It does not go away, but with the right medicine it can be controlled well enough to live, work, and play normally.",
      tl: "Sa hika, sumisikip at namamaga ang daanan ng hangin, kaya mas kaunting hangin ang nakakadaan. Sumusumpong ito dahil sa mga nagpapasumpong — alikabok, usok, balahibo ng alaga, at sipon at trangkaso ang karaniwan. Hindi nakakahawa ang hika. Hindi ito nawawala, pero sa tamang gamot ay kayang kontrolin para makapamuhay, makapagtrabaho, at makapaglaro nang normal.",
      ceb: "Sa hika, mohugot ug mohubag ang agianan sa hangin, mao nga gamay ra nga hangin ang makaagi. Mosumpong kini tungod sa mga makapasumpong — abog, aso, balahibo sa binuhi, ug sip-on ug trangkaso ang kasagaran. Dili makatakod ang hika. Dili kini mawala, apan sa hustong tambal makontrol kini aron makapuyo, makatrabaho, ug makadula nga normal.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "asthma:symptoms": {
    src: "asthma-symptoms-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Sintomas ng hika' and 'Dumarating at nawawala', with four panels — wheezing, difficulty breathing, tight chest, and coughing especially at night — above a red panel: go to hospital at once if it is hard to speak, lips or nails turn blue, or the inhaler does not help.",
      tl: "3D na nakalarawang poster na may pamagat na 'Sintomas ng hika' at 'Dumarating at nawawala', na may apat na bahagi — may sipol ang paghinga, hirap huminga, masikip ang dibdib, at ubo lalo na sa gabi — at pulang bahagi: pumunta agad sa ospital kung hirap nang magsalita, kulay asul ang labi o kuko, o hindi gumaan sa inhaler.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Sintomas ng hika' ug 'Dumarating at nawawala', nga adunay upat ka bahin — may agihis ang pagginhawa, lisod pagginhawa, hugot ang dughan, ug ubo labi na sa gabii — ug pula nga bahin: adto dayon sa ospital kung lisod na mosulti, asul ang ngabil o kuko, o wala mogaan sa inhaler.",
    },
    caption: {
      en: "Asthma symptoms come and go: wheezing, difficulty breathing, a tight chest, and a cough that is worse at night. Go to a hospital at once if it becomes hard to speak, if lips or nails turn blue, or if the reliever inhaler does not help.",
      tl: "Dumarating at nawawala ang sintomas ng hika: may sipol ang paghinga, hirap huminga, masikip ang dibdib, at ubo na mas malala sa gabi. Pumunta agad sa ospital kung nahihirapan nang magsalita, kung kulay asul na ang labi o kuko, o kung hindi gumaan sa reliever na inhaler.",
      ceb: "Moabot ug mawala ang sintomas sa hika: may agihis ang pagginhawa, lisod pagginhawa, hugot ang dughan, ug ubo nga mas grabe sa gabii. Adto dayon sa ospital kung lisod na mosulti, kung asul na ang ngabil o kuko, o kung wala mogaan sa reliever nga inhaler.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "asthma:treatment": {
    // FOUR SLIPS IN THE ARTWORK — the subhead reads "HINDI NAWALA" (for
    // "hindi nawawala"); the reliever panel reads "ATTAKE" (for "atake");
    // and the doctor panel reads "...NG DOKTOR AT / AT IWASAN ANG
    // NAGPPASUMPONG", doubling "at" and dropping a letter from
    // "nagpapasumpong". This is also the only poster in the set headed
    // "asthma" rather than "hika". The medicine on it is right; the lettering
    // wants fixing.
    src: "asthma-treatment-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Pag-agap sa asthma' with a green daily inhaler — reduces swelling, use it even when you feel fine — beside an orange attack inhaler — opens the airways in a sudden attack — a doctor talking to a patient about following the plan and avoiding triggers, and a strip reading 'Hindi gumaan sa inhaler? Pumunta agad sa ospital.'",
      tl: "3D na nakalarawang poster na may pamagat na 'Pag-agap sa asthma' na may berdeng pang-araw-araw na inhaler — pagbawas ng pamamaga, gamitin kahit okay ka na — at kahel na pang-atake na inhaler — pampaluwag ng hinga sa biglaang atake — doktor na kausap ang pasyente tungkol sa pagsunod sa plano at pag-iwas sa nagpapasumpong, at sa ibaba: 'Hindi gumaan sa inhaler? Pumunta agad sa ospital.'",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Pag-agap sa asthma' nga adunay berde nga inhaler para kada adlaw — mopakunhod sa panghubag, gamita bisan okay na ka — ug orange nga inhaler para sa atake — mopaluag sa ginhawa sa kalit nga atake — doktor nga nakigsulti sa pasyente bahin sa pagsunod sa plano ug paglikay sa makapasumpong, ug sa ubos: 'Hindi gumaan sa inhaler? Pumunta agad sa ospital.'",
    },
    caption: {
      en: "Asthma does not go away, but it can be controlled with two kinds of inhaler. The daily preventer brings the swelling down — keep using it even when you feel fine. The reliever opens the airways during a sudden attack. Follow the plan your doctor gives you and avoid your triggers. If the reliever does not help, go to a hospital at once.",
      tl: "Hindi nawawala ang hika, pero nakokontrol ito sa dalawang uri ng inhaler. Ang pang-araw-araw na inhaler ay nagpapababa ng pamamaga — patuloy itong gamitin kahit okay na ang pakiramdam. Ang pang-atake na inhaler ay nagpapaluwag ng hinga sa biglaang atake. Sundin ang plano ng doktor at iwasan ang nagpapasumpong. Kung hindi gumaan sa inhaler, pumunta agad sa ospital.",
      ceb: "Dili mawala ang hika, apan makontrol kini sa duha ka matang sa inhaler. Ang inhaler para kada adlaw mopaubos sa panghubag — padayon kini gamita bisan okay na ang pamati. Ang inhaler para sa atake mopaluag sa ginhawa sa kalit nga atake. Sunda ang plano sa doktor ug likayi ang makapasumpong. Kung wala mogaan sa inhaler, adto dayon sa ospital.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "asthma:prevention": {
    src: "asthma-prevention-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Pag-iwas sa atake ng hika' and 'Alamin at iwasan ang nagpapasumpong', with a waving doctor and five panels: clean the bed and room every week, no smoking in the house, avoid strong smells, keep pets out of the bedroom, and get a flu vaccine every year.",
      tl: "3D na nakalarawang poster na may pamagat na 'Pag-iwas sa atake ng hika' at 'Alamin at iwasan ang nagpapasumpong', na may doktor na kumakaway at limang bahagi: linisin ang kama at kwarto linggo-linggo, walang paninigarilyo sa bahay, iwasan ang matapang na amoy, ilayo ang alaga sa kwarto, at magpabakuna laban sa trangkaso taon-taon.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Pag-iwas sa atake ng hika' ug 'Alamin at iwasan ang nagpapasumpong', nga adunay doktor nga nagkaway ug lima ka bahin: limpyohi ang higdaanan ug kwarto kada semana, walay pagpanigarilyo sa balay, likayi ang kusog nga baho, ipahilayo ang binuhi sa kwarto, ug pagpabakuna batok sa trangkaso kada tuig.",
    },
    caption: {
      en: "Know your triggers and keep away from them: clean the bed and bedroom every week to keep dust mites down, allow no smoking in the house, avoid strong smells like perfume and sprays, keep pets out of the bedroom, and get a flu vaccine every year — a bout of flu is one of the commonest causes of a serious attack.",
      tl: "Alamin at iwasan ang iyong nagpapasumpong: linisin ang kama at kwarto linggo-linggo para mabawasan ang dust mites, bawal ang paninigarilyo sa bahay, iwasan ang matapang na amoy gaya ng pabango at spray, ilayo ang alaga sa kwarto, at magpabakuna laban sa trangkaso taon-taon — ang trangkaso ay isa sa pinakakaraniwang sanhi ng malalang atake.",
      ceb: "Ilha ug likayi ang imong makapasumpong: limpyohi ang higdaanan ug kwarto kada semana aron makunhoran ang dust mites, walay pagpanigarilyo sa balay, likayi ang kusog nga baho sama sa pabango ug spray, ipahilayo ang binuhi sa kwarto, ug pagpabakuna batok sa trangkaso kada tuig — ang trangkaso usa sa labing kasagaran nga hinungdan sa grabe nga atake.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "asthma:lifestyle": {
    src: "asthma-lifestyle-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Malusog na buhay kahit may hika' with a doctor and three panels — sleep: a clean, dust-free bedroom; nutrition: fish, vegetables, and fruit; exercise: stretch first, then walk or swim — and a strip reading 'Laging dalhin ang inhaler sa atake'.",
      tl: "3D na nakalarawang poster na may pamagat na 'Malusog na buhay kahit may hika' na may doktor at tatlong bahagi — tulog: malinis at walang alikabok ang kwarto; nutrisyon: isda, gulay at prutas; ehersisyo: mag-inat muna, maglakad o lumangoy — at sa ibaba: 'Laging dalhin ang inhaler sa atake'.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Malusog na buhay kahit may hika' nga adunay doktor ug tulo ka bahin — tulog: limpyo ug walay abog ang kwarto; nutrisyon: isda, utanon ug prutas; ehersisyo: inat una, lakaw o langoy — ug sa ubos: 'Laging dalhin ang inhaler sa atake'.",
    },
    caption: {
      en: "A healthy life with asthma: sleep in a clean, dust-free bedroom; eat fish, vegetables, and fruit; and stay active — stretch first, then walk or swim, which are gentle on the airways. Always carry your reliever inhaler in case of an attack.",
      tl: "Malusog na buhay kahit may hika: matulog sa malinis at walang alikabok na kwarto; kumain ng isda, gulay, at prutas; at manatiling aktibo — mag-inat muna, saka maglakad o lumangoy, na banayad sa daanan ng hangin. Laging dalhin ang reliever na inhaler sakaling umatake.",
      ceb: "Himsog nga kinabuhi bisan may hika: katulog sa limpyo ug walay abog nga kwarto; kaon ug isda, utanon, ug prutas; ug padayon nga aktibo — inat una, dayon lakaw o langoy, nga hinay sa agianan sa hangin. Kanunay dad-a ang reliever nga inhaler kung mosumpong.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },

  // ─── Paragonimiasis ───────────────────────────────────────────────────────
  // Same dark-blue style. This set fixes the old one's worst fault: it draws a
  // freshwater crab in a stream — "katang", "alimango sa ilog at sapa" — not
  // marine shrimp, prawns, or lobster. Paragonimus in the Philippines is
  // carried by FRESHWATER crabs and crayfish out of streams and rice fields;
  // it is not a seafood disease. The captions still say "freshwater" in all
  // three languages, because "crab" alone sends a reader to the sea.
  //
  // The treatment poster carries three text faults; see that entry.
  "paragonimiasis:overview": {
    src: "paragonimiasis-overview-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Ano ang paragonimiasis?' with a doctor beside a freshwater crab on a stream rock and the words 'Uod sa baga na galing sa hilaw na katang', and four panels: katang — crabs of rivers and streams; it looks like TB; not contagious between people; and curable in a few days.",
      tl: "3D na nakalarawang poster na may pamagat na 'Ano ang paragonimiasis?' na may doktor sa tabi ng katang sa bato sa sapa at 'Uod sa baga na galing sa hilaw na katang', at apat na bahagi: katang — alimango sa ilog at sapa; kamukha ng TB; hindi nakakahawa sa tao; at nagagamot sa ilang araw.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Ano ang paragonimiasis?' nga adunay doktor tupad sa kasag sa tab-ang nga tubig sa bato sa sapa ug 'Uod sa baga na galing sa hilaw na katang', ug upat ka bahin: katang — kasag sa suba ug sapa; susama sa TB; dili makatakod sa tawo; ug matambalan sulod sa pipila ka adlaw.",
    },
    caption: {
      en: "Paragonimiasis is caused by a lung fluke — a small flatworm — caught by eating raw or half-cooked FRESHWATER crab: the katang of rivers, streams, and rice fields, not crab from the sea. In the lungs it looks very like TB, which is why it gets mistaken for it. It does not pass from person to person, and it is cured with a few days of medicine.",
      tl: "Ang paragonimiasis ay dulot ng lung fluke — maliit na uod — na nakukuha sa pagkain ng hilaw o kulang sa lutong katang, ang alimango sa TABANG na tubig ng ilog, sapa, at palayan, hindi alimango mula sa dagat. Sa baga, kamukhang-kamukha nito ang TB, kaya madalas itong mapagkamalan. Hindi ito naipapasa sa ibang tao, at nagagamot ito sa ilang araw na gamutan.",
      ceb: "Ang paragonimiasis tungod sa lung fluke — gamay nga ulod — nga makuha sa pagkaon ug hilaw o kulang sa luto nga kasag sa TAB-ANG nga tubig: ang katang sa suba, sapa, ug basakan, dili kasag gikan sa dagat. Sa baga, susama kaayo kini sa TB, mao nga kanunay kining masaypan. Dili kini makatakod sa laing tawo, ug matambalan kini sulod sa pipila ka adlaw nga tambal.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "paragonimiasis:symptoms": {
    src: "paragonimiasis-symptoms-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Sintomas ng paragonimiasis' with six panels — a cough lasting weeks or months, difficulty breathing, rust-coloured or bloody phlegm, mild fever, chest pain, and tiredness — a yellow strip reading 'Kumain ka ba ng hilaw na katang? Sabihin sa doktor.', and a strip reading 'Ubo na 2 linggo o higit? Pumunta sa DOTS center.'",
      tl: "3D na nakalarawang poster na may pamagat na 'Sintomas ng paragonimiasis' na may anim na bahagi — ubo nang ilang linggo o buwan, hirap huminga, plema na kulay kalawang o may dugo, bahagyang lagnat, masakit ang dibdib, at pagod — dilaw na bahagi: 'Kumain ka ba ng hilaw na katang? Sabihin sa doktor.', at sa ibaba: 'Ubo na 2 linggo o higit? Pumunta sa DOTS center.'",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Sintomas ng paragonimiasis' nga adunay unom ka bahin — ubo sulod sa pipila ka semana o bulan, lisod pagginhawa, plema nga kolor taya o may dugo, gamay nga hilanat, sakit sa dughan, ug kakapoy — dalag nga bahin: 'Kumain ka ba ng hilaw na katang? Sabihin sa doktor.', ug sa ubos: 'Ubo na 2 linggo o higit? Pumunta sa DOTS center.'",
    },
    caption: {
      en: "The signs overlap with TB: a cough lasting weeks or months, difficulty breathing, rust-brown or bloody phlegm, mild fever, chest pain, and tiredness. The rust-coloured phlegm with little fever is its tell. If you have eaten raw or half-cooked freshwater crab, tell the doctor — it changes which test they run. And for any cough of two weeks or more, go to the DOTS centre to be checked.",
      tl: "Kahawig ng sa TB ang mga palatandaan: ubo nang ilang linggo o buwan, hirap huminga, plemang kulay kalawang o may dugo, bahagyang lagnat, masakit na dibdib, at pagod. Ang plemang kulay kalawang na halos walang lagnat ang tanda nito. Kung kumain ka ng hilaw o kulang sa lutong katang, sabihin sa doktor — nagbabago nito ang ipapagawang pagsusuri. At sa anumang ubo na 2 linggo o higit pa, pumunta sa DOTS center para magpasuri.",
      ceb: "Susama sa TB ang mga timailhan: ubo sulod sa pipila ka semana o bulan, lisod pagginhawa, plema nga kolor taya o may dugo, gamay nga hilanat, sakit sa dughan, ug kakapoy. Ang plema nga kolor taya nga halos walay hilanat mao ang timailhan niini. Kung mikaon ka ug hilaw o kulang sa luto nga kasag sa tab-ang nga tubig, sultihi ang doktor — kini ang mausab sa pagsusi nga ipahimo. Ug sa bisan unsang ubo nga 2 ka semana o kapin, adto sa DOTS center aron magpasusi.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "paragonimiasis:treatment": {
    // THREE TEXT FAULTS IN THE ARTWORK:
    //   - "PAG-ESKSAMEN" for "pag-eksamen".
    //   - "MAARING MAANITOD NANG 1 ARAW" — "maanitod" is not a word. The
    //     intended side effect is drowsiness ("maaaring antukin"), which is
    //     what the drawing of a sleepy man shows and what praziquantel does.
    //   - "IPASURI KASABAY NG PAGKAIN", over a family at a meal, reads as
    //     "have it checked with food". The sense that fits the drawing is
    //     "have the people you ate with checked too" — everyone who shared the
    //     raw crab is at the same risk. The caption says that.
    // The medicine itself is right: two to three days of a prescribed
    // drug, taken with food.
    src: "paragonimiasis-treatment-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Paggamot sa paragonimiasis' with a doctor at a microscope — first, testing of sputum, stool, or blood — a doctor prescribing medicine for two to three days only, three panels — take with food, may cause drowsiness for a day, have those who shared the meal checked — and a strip reading 'May TB medicine ba? Huwag itigil nang walang payo ng doktor.'",
      tl: "3D na nakalarawang poster na may pamagat na 'Paggamot sa paragonimiasis' na may doktor sa microscope — una, pagsusuri ng dura, dumi o dugo — doktor na nagrereseta ng gamot nang 2 hanggang 3 araw lang, tatlong bahagi — inumin kasabay ng pagkain, maaaring antukin nang isang araw, ipasuri ang mga kasabay sa pagkain — at sa ibaba: 'May TB medicine ba? Huwag itigil nang walang payo ng doktor.'",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Paggamot sa paragonimiasis' nga adunay doktor sa microscope — una, pagsusi sa plema, tae o dugo — doktor nga nagreseta ug tambal sulod sa 2 ngadto sa 3 ka adlaw lang, tulo ka bahin — inoma uban sa pagkaon, mahimong antokon sulod sa usa ka adlaw, ipasusi ang mga kauban sa pagkaon — ug sa ubos: 'May TB medicine ba? Huwag itigil nang walang payo ng doktor.'",
    },
    caption: {
      en: "First comes testing: the doctor looks for the fluke's eggs in sputum or stool, or runs a blood test. The prescribed medicine is short — two to three days only. Take it with food; it may make you drowsy for a day. Anyone who shared the same raw crab should be checked too. And if you are already on TB medicine, do not stop it unless your doctor tells you to.",
      tl: "Una ang pagsusuri: hinahanap ng doktor ang itlog ng uod sa dura o dumi, o nagpapasuri ng dugo. Maikli ang iniresetang gamot — 2 hanggang 3 araw lang. Inumin ito kasabay ng pagkain; maaari kang antukin nang isang araw. Dapat ding magpasuri ang sinumang kasabay mong kumain ng parehong hilaw na katang. At kung umiinom ka na ng gamot sa TB, huwag itong itigil nang walang payo ng doktor.",
      ceb: "Una ang pagsusi: pangitaon sa doktor ang itlog sa ulod sa plema o tae, o magpasusi ug dugo. Mubo ra ang gireseta nga tambal — 2 ngadto sa 3 ka adlaw lang. Inoma kini uban sa pagkaon; mahimong antokon ka sulod sa usa ka adlaw. Angay usab magpasusi ang bisan kinsa nga kauban nimo nga mikaon sa samang hilaw nga katang. Ug kung nag-inom ka na ug tambal sa TB, ayaw kini hunonga nga walay tambag sa doktor.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "paragonimiasis:prevention": {
    src: "paragonimiasis-prevention-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Pag-iwas sa paragonimiasis' with a doctor beside a pot of crabs boiling red, reading 'Lutuing mabuti ang katang hanggang mamula', a red panel showing that vinegar (kinilaw), salt, and alcohol do not kill the worm, and two panels: wash hands, knife, and chopping board, and boil water from streams.",
      tl: "3D na nakalarawang poster na may pamagat na 'Pag-iwas sa paragonimiasis' na may doktor sa tabi ng kalderong may kumukulong pulang alimango at 'Lutuing mabuti ang katang hanggang mamula', pulang bahagi na nagpapakitang hindi pumapatay sa uod ang suka (kinilaw), asin, at alak, at dalawang bahagi: hugasan ang kamay, kutsilyo at sangkalan, at pakuluan ang tubig mula sa sapa.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Pag-iwas sa paragonimiasis' nga adunay doktor tupad sa kaldero nga may nagbukal nga pula nga kasag ug 'Lutuing mabuti ang katang hanggang mamula', pula nga bahin nga nagpakita nga dili mopatay sa ulod ang suka (kinilaw), asin, ug ilimnon, ug duha ka bahin: hugasi ang kamot, kutsilyo ug tadtaran, ug pabukala ang tubig gikan sa sapa.",
    },
    caption: {
      en: "Prevention is in the cooking. Cook freshwater crab right through, until it turns red. Vinegar — as in kinilaw — salt, and alcohol do NOT kill the worm, so pickled, salted, or drunken crab is still raw crab. Wash your hands, knife, and chopping board after handling raw crab, and boil water taken from streams before drinking it.",
      tl: "Nasa pagluluto ang pag-iwas. Lutuing mabuti ang katang hanggang mamula. HINDI pumapatay sa uod ang suka — gaya ng sa kinilaw — asin, at alak, kaya hilaw pa rin ang katang na inatsara, inasnan, o binabad sa alak. Hugasan ang kamay, kutsilyo, at sangkalan pagkatapos humawak ng hilaw na katang, at pakuluan ang tubig mula sa sapa bago inumin.",
      ceb: "Naa sa pagluto ang paglikay. Lutoa pag-ayo ang katang hangtod mopula. DILI mopatay sa ulod ang suka — sama sa kinilaw — asin, ug ilimnon, busa hilaw gihapon ang katang nga gisukaan, giasinan, o gibabad sa ilimnon. Hugasi ang kamot, kutsilyo, ug tadtaran human maggunit ug hilaw nga katang, ug pabukala ang tubig gikan sa sapa sa dili pa imnon.",
    },
    credit: "Bantay-TB",
    fit: "figure",
    width: 896,
    height: 1200,
  },
  "paragonimiasis:lifestyle": {
    // The exercise panel is headed "EHERSISYO" and then says "EHERSISYO" again
    // inside it. Harmless, but it is a wasted line.
    src: "paragonimiasis-lifestyle-v2.webp",
    alt: {
      en: "3D-illustrated poster headed 'Paggaling sa paragonimiasis' with a doctor beside three panels — sleep: seven to nine hours; nutrition: fish, eggs, mung beans, chicken, and plenty of water; exercise: short walks, adding more bit by bit — and two tiles: avoid smoke, and come back for a follow-up check.",
      tl: "3D na nakalarawang poster na may pamagat na 'Paggaling sa paragonimiasis' na may doktor at tatlong bahagi — tulog: 7 hanggang 9 na oras; nutrisyon: isda, itlog, munggo, manok at maraming tubig; ehersisyo: maikling lakad, dagdagan unti-unti — at dalawang bahagi: iwasan ang usok, at bumalik para sa pagsusuri ulit.",
      ceb: "3D nga gidrowing nga poster nga giulohan ug 'Paggaling sa paragonimiasis' nga adunay doktor ug tulo ka bahin — tulog: 7 ngadto sa 9 ka oras; nutrisyon: isda, itlog, monggos, manok ug daghang tubig; ehersisyo: mubo nga lakaw, dugangi hinay-hinay — ug duha ka bahin: likayi ang aso, ug balik para sa pagsusi pag-usab.",
    },
    caption: {
      en: "While you recover: sleep seven to nine hours; eat protein — fish, eggs, mung beans, chicken — and drink plenty of water, which helps the lungs repair once the flukes are gone; start with short walks and add a little more each day; keep away from smoke; and come back for your follow-up check, to make sure the infection has cleared.",
      tl: "Habang nagpapagaling: matulog nang 7 hanggang 9 na oras; kumain ng protina — isda, itlog, munggo, manok — at uminom ng maraming tubig, na tumutulong sa paghilom ng baga kapag wala na ang uod; magsimula sa maikling lakad at dagdagan nang kaunti araw-araw; iwasan ang usok; at bumalik para sa pagsusuri ulit, para matiyak na wala na ang impeksiyon.",
      ceb: "Samtang nag-ayo: katulog ug 7 ngadto sa 9 ka oras; kaon ug protina — isda, itlog, monggos, manok — ug inom ug daghang tubig, nga motabang sa pag-ayo sa baga kung wala na ang ulod; sugdi sa mubo nga lakaw ug dugangi gamay matag adlaw; likayi ang aso; ug balik para sa pagsusi pag-usab, aron masiguro nga wala na ang impeksiyon.",
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
