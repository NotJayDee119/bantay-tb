import type { Locale } from "../lib/i18n";

/**
 * What the public chatbot knows about BANTAY-TB itself. Ingested into the
 * `kb_documents` / `kb_chunks` knowledge base by scripts/ingest-kb.ts along
 * with the disease articles in healthContent.ts.
 *
 * Keep this in step with the product: the chatbot answers system questions
 * only from what is written here, so a feature described wrongly here is a
 * feature the assistant will describe wrongly to the public.
 */
export interface SystemDoc {
  slug: string;
  locale: Locale;
  title: string;
  body: string;
}

export const SYSTEM_KNOWLEDGE: SystemDoc[] = [
  // ---------- What BANTAY-TB is ----------
  {
    slug: "about-en",
    locale: "en",
    title: "What is BANTAY-TB?",
    body: "BANTAY-TB is Davao City's tuberculosis surveillance and care platform. It tracks TB cases at the barangay level, maps hotspots (areas with a high concentration of TB cases), helps health workers follow patients through their treatment, and can share case data securely with other health systems using the HL7 FHIR standard. The public website and this assistant are available in English, Filipino, and Cebuano.",
  },
  {
    slug: "about-tl",
    locale: "tl",
    title: "Ano ang BANTAY-TB?",
    body: "Ang BANTAY-TB ay plataporma ng Davao City para sa pagbabantay at pangangalaga sa tuberkulosis. Sinusubaybayan nito ang mga kaso ng TB sa antas ng barangay, ipinapakita sa mapa ang mga hotspot (mga lugar na maraming kaso ng TB), tinutulungan ang mga health worker na subaybayan ang paggamot ng pasyente, at ligtas na nakapagbabahagi ng datos sa ibang health system gamit ang HL7 FHIR. Ang website at ang assistant na ito ay nasa English, Filipino, at Cebuano.",
  },
  {
    slug: "about-ceb",
    locale: "ceb",
    title: "Unsa ang BANTAY-TB?",
    body: "Ang BANTAY-TB mao ang plataporma sa Davao City alang sa pagbantay ug pag-atiman sa tuberkulosis. Gisubay niini ang mga kaso sa TB matag barangay, gipakita sa mapa ang mga hotspot (mga lugar nga daghang kaso sa TB), gitabangan ang mga health worker sa pagsubay sa pagtambal sa pasyente, ug luwas nga makapaambit og datos sa ubang health system gamit ang HL7 FHIR. Ang website ug kini nga assistant anaa sa English, Filipino, ug Cebuano.",
  },

  // ---------- Public features ----------
  {
    slug: "public-features-en",
    locale: "en",
    title: "What can visitors do on the website?",
    body: "Anyone can use the public website without an account:\n- DOTS Center Locator: a map of DOTS centers in Davao City, where TB screening and treatment are free, with directions to the nearest one.\n- Health Education (Learn): articles on the overview, symptoms, treatment, prevention, and healthy habits for tuberculosis, pneumonia, COVID-19, influenza, bronchitis, COPD, asthma, and paragonimiasis, in English, Filipino, and Cebuano.\n- This chatbot: ask questions about BANTAY-TB and these diseases.\nThe public map shows only barangay-level totals. No patient's name or personal information is ever shown to the public.",
  },
  {
    slug: "public-features-tl",
    locale: "tl",
    title: "Ano ang magagawa ng bisita sa website?",
    body: "Kahit sino ay puwedeng gumamit ng website kahit walang account:\n- DOTS Center Locator: mapa ng mga DOTS center sa Davao City, kung saan libre ang TB screening at paggamot, na may direksyon papunta sa pinakamalapit.\n- Health Education (Learn): mga artikulo tungkol sa pangkalahatan, sintomas, paggamot, pag-iwas, at malusog na gawi para sa tuberkulosis, pulmonya, COVID-19, trangkaso, bronchitis, COPD, hika, at paragonimiasis, sa English, Filipino, at Cebuano.\n- Ang chatbot na ito: magtanong tungkol sa BANTAY-TB at sa mga sakit na ito.\nAng pampublikong mapa ay nagpapakita lamang ng kabuuang bilang bawat barangay. Hindi kailanman ipinapakita sa publiko ang pangalan o personal na impormasyon ng pasyente.",
  },
  {
    slug: "public-features-ceb",
    locale: "ceb",
    title: "Unsa ang mahimo sa bisita sa website?",
    body: "Bisan kinsa makagamit sa website bisan walay account:\n- DOTS Center Locator: mapa sa mga DOTS center sa Davao City, diin libre ang TB screening ug pagtambal, nga adunay direksyon paingon sa pinaka-duol.\n- Health Education (Learn): mga artikulo bahin sa kinatibuk-an, sintomas, tambal, paglikay, ug himsog nga batasan alang sa tuberkulosis, pulmonya, COVID-19, trangkaso, bronchitis, COPD, hubak, ug paragonimiasis, sa English, Filipino, ug Cebuano.\n- Kini nga chatbot: pangutana bahin sa BANTAY-TB ug niining mga sakita.\nAng publiko nga mapa nagpakita lang sa kinatibuk-ang ihap matag barangay. Wala gyud gipakita sa publiko ang ngalan o personal nga impormasyon sa pasyente.",
  },

  // ---------- Patient accounts ----------
  {
    slug: "patient-accounts-en",
    locale: "en",
    title: "Do patients need an account?",
    body: "No. BANTAY-TB accounts are for health staff only — patients and residents never need to sign up or log in. Everything for the public is open on the website: the DOTS Center Locator, Health Education, and this assistant. Your treatment is recorded by the nurse or doctor at your DOTS center, so just keep going to your scheduled visits and collect your medicine there.",
  },
  {
    slug: "patient-accounts-tl",
    locale: "tl",
    title: "Kailangan ba ng account ang pasyente?",
    body: "Hindi. Ang mga account sa BANTAY-TB ay para lamang sa mga health staff — hindi kailangang mag-sign up o mag-log in ang mga pasyente at residente. Bukas sa website ang lahat ng para sa publiko: ang DOTS Center Locator, Health Education, at ang assistant na ito. Ang iyong paggamot ay itinatala ng nars o doktor sa iyong DOTS center, kaya ituloy lang ang pagpunta sa iyong mga nakatakdang bisita at doon kunin ang iyong gamot.",
  },
  {
    slug: "patient-accounts-ceb",
    locale: "ceb",
    title: "Kinahanglan ba og account ang pasyente?",
    body: "Dili. Ang mga account sa BANTAY-TB para lang sa mga health staff — dili kinahanglan nga mag-sign up o mag-log in ang mga pasyente ug residente. Abli sa website ang tanan para sa publiko: ang DOTS Center Locator, Health Education, ug kini nga assistant. Ang imong pagtambal girekord sa nars o doktor sa imong DOTS center, busa padayon lang sa pag-adto sa imong mga naka-iskedyul nga bisita ug didto kuhaa ang imong tambal.",
  },

  // ---------- Staff ----------
  {
    slug: "staff-en",
    locale: "en",
    title: "What do health workers and coordinators use BANTAY-TB for?",
    body: "Health workers, nurses, doctors, barangay admins, and TB coordinators sign in to: record and update TB cases (one by one or by Excel import), see the GIS surveillance map and heatmaps, identify hotspots, get alerts when a new high-severity hotspot is found, enroll patients and follow their treatment, and view analytics. Each staff member sees the cases for their assigned area or facility. Staff accounts are created through the staff registration page with an invite code from the TB coordinator; the role is assigned on the server, not chosen by the user.",
  },
  {
    slug: "staff-tl",
    locale: "tl",
    title: "Para saan ginagamit ng health worker at coordinator ang BANTAY-TB?",
    body: "Ang mga health worker, nars, doktor, barangay admin, at TB coordinator ay nag-si-sign in para: magtala at mag-update ng kaso ng TB (isa-isa o sa Excel import), makita ang GIS surveillance map at heatmap, matukoy ang mga hotspot, makatanggap ng alerto kapag may bagong mataas na hotspot, mag-enroll ng pasyente at subaybayan ang paggamot, at makita ang analytics. Bawat staff ay nakakakita lamang ng kaso sa kanilang nakatalagang lugar o pasilidad. Ang staff account ay ginagawa sa staff registration page gamit ang invite code mula sa TB coordinator.",
  },
  {
    slug: "staff-ceb",
    locale: "ceb",
    title: "Unsa ang gamit sa BANTAY-TB alang sa health worker ug coordinator?",
    body: "Ang mga health worker, nars, doktor, barangay admin, ug TB coordinator mo-sign in aron: magrekord ug mag-update sa kaso sa TB (tagsa-tagsa o pinaagi sa Excel import), makita ang GIS surveillance map ug heatmap, mailhan ang mga hotspot, makadawat og alerto kung adunay bag-ong taas nga hotspot, mag-enroll og pasyente ug subayon ang pagtambal, ug makita ang analytics. Matag staff makakita lang sa mga kaso sa ilang gi-assign nga lugar o pasilidad. Ang staff account himoon sa staff registration page gamit ang invite code gikan sa TB coordinator.",
  },

  // ---------- Cost and where to go ----------
  {
    slug: "free-care-en",
    locale: "en",
    title: "Is TB testing and treatment free?",
    body: "Yes. TB screening and DOTS treatment are free at DOTS centers in Davao City. If you have a cough lasting two weeks or more, fever, night sweats, weight loss, or blood in your sputum, visit the nearest DOTS center. Use the DOTS Center Locator on this website to find one and get directions. This assistant gives information only; it cannot diagnose you.",
  },
  {
    slug: "free-care-tl",
    locale: "tl",
    title: "Libre ba ang pagsusuri at paggamot sa TB?",
    body: "Oo. Libre ang TB screening at DOTS treatment sa mga DOTS center sa Davao City. Kung may ubo ka nang dalawang linggo o higit pa, lagnat, pagpapawis sa gabi, pagbaba ng timbang, o may dugo ang plema, pumunta sa pinakamalapit na DOTS center. Gamitin ang DOTS Center Locator sa website na ito para mahanap ito at makakuha ng direksyon. Impormasyon lamang ang ibinibigay ng assistant na ito; hindi ka nito ma-diagnose.",
  },
  {
    slug: "free-care-ceb",
    locale: "ceb",
    title: "Libre ba ang pagsusi ug pagtambal sa TB?",
    body: "Oo. Libre ang TB screening ug DOTS treatment sa mga DOTS center sa Davao City. Kung naa kay ubo nga duha ka semana o labaw pa, hilanat, singot sa gabii, pagkunhod sa timbang, o dugo sa plema, adto sa pinaka-duol nga DOTS center. Gamita ang DOTS Center Locator niini nga website aron makit-an kini ug makakuha og direksyon. Impormasyon lang ang gihatag niini nga assistant; dili ka niini ma-diagnose.",
  },
];
