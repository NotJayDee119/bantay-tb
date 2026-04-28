import type { Locale } from "../lib/i18n";

export type Disease = "tb" | "pneumonia" | "covid19" | "asthma";
export type Category =
  | "overview"
  | "symptoms"
  | "treatment"
  | "prevention"
  | "lifestyle";

export interface HealthArticle {
  slug: string;
  disease: Disease;
  locale: Locale;
  category: Category;
  title: string;
  summary: string;
  body_md: string;
}

export const DISEASE_LABEL: Record<Disease, Record<Locale, string>> = {
  tb: { en: "Tuberculosis", tl: "Tuberkulosis", ceb: "Tuberkulosis" },
  pneumonia: { en: "Pneumonia", tl: "Pulmonya", ceb: "Pulmonya" },
  covid19: { en: "COVID-19", tl: "COVID-19", ceb: "COVID-19" },
  asthma: { en: "Asthma", tl: "Hika", ceb: "Hubak" },
};

export const CATEGORY_LABEL: Record<Category, Record<Locale, string>> = {
  overview: { en: "Overview", tl: "Pangkalahatan", ceb: "Kinatibuk-an" },
  symptoms: { en: "Symptoms", tl: "Mga Sintomas", ceb: "Mga Sintomas" },
  treatment: { en: "Treatment", tl: "Paggamot", ceb: "Tambal" },
  prevention: { en: "Prevention", tl: "Pag-iwas", ceb: "Pag-likay" },
  lifestyle: {
    en: "Sleep, Nutrition, Exercise",
    tl: "Tulog, Nutrisyon, Ehersisyo",
    ceb: "Katulog, Nutrisyon, Ehersisyo",
  },
};

export const HEALTH_ARTICLES: HealthArticle[] = [
  // ---------- TB ----------
  {
    slug: "tb-overview-en",
    disease: "tb",
    locale: "en",
    category: "overview",
    title: "What is Tuberculosis?",
    summary:
      "Tuberculosis (TB) is an infectious disease caused by Mycobacterium tuberculosis, mainly affecting the lungs.",
    body_md:
      "Tuberculosis (TB) spreads through the air when an infected person coughs, sneezes, or speaks. Most cases affect the lungs (pulmonary TB), but TB can also affect the kidneys, spine, and brain (extra-pulmonary TB). Early diagnosis through sputum testing or X-ray and complete treatment can fully cure TB.",
  },
  {
    slug: "tb-overview-tl",
    disease: "tb",
    locale: "tl",
    category: "overview",
    title: "Ano ang Tuberkulosis?",
    summary:
      "Ang Tuberkulosis (TB) ay isang nakakahawang sakit na sanhi ng bakteryang Mycobacterium tuberculosis.",
    body_md:
      "Ang TB ay kumakalat sa hangin kapag umuubo, bumabahin, o nagsasalita ang taong may sakit. Karamihan sa kaso ay nakakaapekto sa baga, ngunit maaari rin itong makaapekto sa bato, gulugod, at utak. Ang maagang pagsusuri at kumpletong paggamot ay maaaring lubusang mag-pagaling ng TB.",
  },
  {
    slug: "tb-overview-ceb",
    disease: "tb",
    locale: "ceb",
    category: "overview",
    title: "Unsa ang Tuberkulosis?",
    summary:
      "Ang Tuberkulosis (TB) usa ka makatakod nga sakit nga gipahinabo sa Mycobacterium tuberculosis.",
    body_md:
      "Mokatap ang TB pinaagi sa hangin kung ang tawo nga adunay sakit nag-ubo, nagbahaon, o nagsulti. Kasagaran maapektohan ang baga, apan mahimo usab kini moapekto sa kidney, gulugod, ug utok. Ang sayo nga diagnosis ug kompleto nga tambal makahatag og hingpit nga pag-ayo.",
  },
  {
    slug: "tb-symptoms-en",
    disease: "tb",
    locale: "en",
    category: "symptoms",
    title: "TB Symptoms to Watch For",
    summary: "Persistent cough lasting 2 weeks or more is the key warning sign.",
    body_md:
      "Common TB symptoms include: cough lasting 2 weeks or longer; cough with blood or sputum; chest pain; weight loss; loss of appetite; fever; night sweats; fatigue. If you experience any of these, visit the nearest DOTS center immediately for free TB screening.",
  },
  {
    slug: "tb-symptoms-tl",
    disease: "tb",
    locale: "tl",
    category: "symptoms",
    title: "Mga Sintomas ng TB na Dapat Bantayan",
    summary: "Ang ubo na lampas dalawang linggo ay pangunahing palatandaan.",
    body_md:
      "Mga karaniwang sintomas ng TB: ubo nang lampas dalawang linggo; ubong may dugo o plema; sakit sa dibdib; pagbaba ng timbang; kawalan ng gana sa pagkain; lagnat; pagpapawis sa gabi; pagkapagod. Kung mararanasan ang mga ito, agad bumisita sa pinakamalapit na DOTS Center para sa libreng pagsusuri.",
  },
  {
    slug: "tb-symptoms-ceb",
    disease: "tb",
    locale: "ceb",
    category: "symptoms",
    title: "Mga Sintomas sa TB nga Bantayan",
    summary: "Ang ubo nga molabaw sa duha ka semana mao ang panguna nga ilhanan.",
    body_md:
      "Kasagaran nga mga sintomas: ubo nga molabaw sa duha ka semana; ubo nga adunay dugo o plema; kasakit sa dughan; pagniwang; kawad-on sa gana sa pagkaon; hilanat; paghigwaos sa gabii; kakapoy. Kung gibati ang mga sintomas, dali nga adto sa pinaka-suod nga DOTS Center alang sa libre nga eksamen.",
  },
  {
    slug: "tb-treatment-en",
    disease: "tb",
    locale: "en",
    category: "treatment",
    title: "TB Treatment",
    summary:
      "TB is curable. Standard treatment lasts 6 months under DOTS supervision.",
    body_md:
      "Standard drug-sensitive TB treatment uses 4 first-line antibiotics (Isoniazid, Rifampicin, Pyrazinamide, Ethambutol) for 2 months, followed by 4 months of Isoniazid + Rifampicin. Drug-resistant TB requires longer regimens supervised by an MDR-TB specialist. Always complete the full course — stopping early can cause drug resistance.",
  },
  {
    slug: "tb-treatment-tl",
    disease: "tb",
    locale: "tl",
    category: "treatment",
    title: "Paggamot sa TB",
    summary:
      "Magagamot ang TB. Ang karaniwang paggamot ay 6 na buwan sa ilalim ng DOTS.",
    body_md:
      "Ang karaniwang gamot para sa drug-sensitive TB ay 4 na first-line antibiotics na iniinom ng 2 buwan, na sinusundan ng 4 na buwang Isoniazid + Rifampicin. Ang drug-resistant TB ay nangangailangan ng mas mahabang paggamot. Kumpletuhin ang gamot — ang pagtigil bago matapos ay maaaring magdulot ng drug resistance.",
  },
  {
    slug: "tb-treatment-ceb",
    disease: "tb",
    locale: "ceb",
    category: "treatment",
    title: "Tambal sa TB",
    summary:
      "Maayo nga TB. Ang standard nga tambal molungtad og 6 ka bulan ilawom sa DOTS.",
    body_md:
      "Ang standard nga tambal alang sa drug-sensitive TB mao ang 4 ka first-line antibiotics sulod sa 2 ka bulan, gisundan og 4 ka bulan nga Isoniazid + Rifampicin. Ang drug-resistant TB nanginahanglan og mas taas nga tambal. Humanon gyud ang tambal — ang pagsulod sa wala pa matapos makahatag og drug resistance.",
  },
  {
    slug: "tb-prevention-en",
    disease: "tb",
    locale: "en",
    category: "prevention",
    title: "Preventing the Spread of TB",
    summary:
      "Cover coughs, ventilate rooms, and screen close contacts of TB patients.",
    body_md:
      "Key prevention steps: cover your mouth/nose when coughing; open windows for natural ventilation; avoid crowded enclosed spaces if you have symptoms; ensure infants receive the BCG vaccine; have all household contacts of TB patients screened.",
  },
  {
    slug: "tb-prevention-tl",
    disease: "tb",
    locale: "tl",
    category: "prevention",
    title: "Pag-iwas sa Pagkalat ng TB",
    summary:
      "Takpan ang ubo, magpa-bentilasyon, at pasuriin ang mga kasamahan sa bahay.",
    body_md:
      "Mahahalagang hakbang: takpan ang bibig at ilong kapag umuubo; buksan ang mga bintana para sa sariwang hangin; iwasan ang masisikip na lugar kung may sintomas; tiyakin ang BCG vaccine sa sanggol; pasuriin ang lahat ng kasama sa bahay ng pasyente.",
  },
  {
    slug: "tb-prevention-ceb",
    disease: "tb",
    locale: "ceb",
    category: "prevention",
    title: "Pag-likay sa Pagkatag sa TB",
    summary:
      "Tabuni ang ubo, abrihi ang bintana, ug pasuhi ang mga sila sa balay.",
    body_md:
      "Importante nga lakang: tabuni ang baba ug ilong kung mag-ubo; ablihi ang bintana para sa lab-as nga hangin; likayan ang piot nga lugar kung adunay sintomas; siguraduha ang BCG vaccine sa bata; pasuhi ang tanan nga sila sa balay sa pasyente.",
  },
  {
    slug: "tb-lifestyle-en",
    disease: "tb",
    locale: "en",
    category: "lifestyle",
    title: "Sleep, Nutrition & Exercise for TB Recovery",
    summary:
      "Recovery is faster when paired with rest, balanced meals, and gentle activity.",
    body_md:
      "Sleep: aim for 7–9 hours per night; recovery happens during deep sleep. Nutrition: eat protein (eggs, fish, beans) at every meal, plus vegetables and fruit; vitamin D from morning sun helps. Exercise: gentle daily walks of 20–30 minutes once you feel stronger; avoid heavy exertion until cleared by your doctor.",
  },
  {
    slug: "tb-lifestyle-tl",
    disease: "tb",
    locale: "tl",
    category: "lifestyle",
    title: "Tulog, Nutrisyon at Ehersisyo sa Paggaling sa TB",
    summary:
      "Mas mabilis ang paggaling kapag may sapat na tulog, balanseng pagkain, at banayad na ehersisyo.",
    body_md:
      "Tulog: 7–9 oras kada gabi. Nutrisyon: kainin ang protina (itlog, isda, monggo) sa bawat pagkain, kasama ang gulay at prutas; ang araw sa umaga ay magandang pinagmumulan ng vitamin D. Ehersisyo: 20–30 minutong paglalakad araw-araw kapag medyo malakas na, iwasan ang mabigat na trabaho hanggang payagan ng doktor.",
  },
  {
    slug: "tb-lifestyle-ceb",
    disease: "tb",
    locale: "ceb",
    category: "lifestyle",
    title: "Katulog, Nutrisyon ug Ehersisyo sa Pag-ayo sa TB",
    summary:
      "Mas paspas mo-ayo kung adunay igong katulog, balansiyado nga pagkaon, ug humok nga ehersisyo.",
    body_md:
      "Katulog: 7–9 ka oras kada gabii. Nutrisyon: kaona ang protina (itlog, isda, batong) sa matag kaon, lakip ang utan ug prutas; ang adlaw sa buntag tinubdan sa vitamin D. Ehersisyo: 20–30 minuto nga paglakaw kada adlaw kung medyo kusgan na, likayi ang bug-at nga trabaho hangtud nga tugotan sa doktor.",
  },

  // ---------- Pneumonia ----------
  {
    slug: "pneumonia-overview-en",
    disease: "pneumonia",
    locale: "en",
    category: "overview",
    title: "What is Pneumonia?",
    summary:
      "Pneumonia is an infection that inflames the air sacs in one or both lungs.",
    body_md:
      "Pneumonia is caused by bacteria, viruses, or fungi. The lungs fill with fluid or pus, making it hard to breathe. It is most dangerous for children under 5, adults over 65, and people with weak immune systems. Most cases respond well to early antibiotics and rest.",
  },
  {
    slug: "pneumonia-overview-tl",
    disease: "pneumonia",
    locale: "tl",
    category: "overview",
    title: "Ano ang Pulmonya?",
    summary: "Ang pulmonya ay impeksyon na nagdudulot ng pamamaga sa baga.",
    body_md:
      "Sanhi ng bacteria, virus, o fungi. Napupuno ng tubig o nana ang baga, na nagpapahirap sa paghinga. Pinaka-delikado sa mga bata at matatanda. Karamihan ay napapagaling sa antibiyotiko at pamamahinga.",
  },
  {
    slug: "pneumonia-overview-ceb",
    disease: "pneumonia",
    locale: "ceb",
    category: "overview",
    title: "Unsa ang Pulmonya?",
    summary: "Ang pulmonya usa ka impeksyon nga makapahubag sa baga.",
    body_md:
      "Gipahinabo sa bacteria, virus, o fungi. Mapuno og tubig o nana ang baga, lisod magginhawa. Mas delikado sa mga bata ug tigulang. Kasagaran maayo sa antibiotic ug pahuway.",
  },
  {
    slug: "pneumonia-symptoms-en",
    disease: "pneumonia",
    locale: "en",
    category: "symptoms",
    title: "Pneumonia Symptoms",
    summary:
      "Cough with phlegm, fever, fast breathing, and chest pain are typical.",
    body_md:
      "Watch for: cough with green/yellow phlegm; fever and chills; fast or shallow breathing; chest pain when breathing deeply; fatigue; loss of appetite. Seek care immediately if breathing becomes labored.",
  },
  {
    slug: "pneumonia-symptoms-tl",
    disease: "pneumonia",
    locale: "tl",
    category: "symptoms",
    title: "Mga Sintomas ng Pulmonya",
    summary:
      "Karaniwan ang ubo na may plema, lagnat, mabilis na paghinga, at sakit sa dibdib.",
    body_md:
      "Bantayan: ubo na may berde/dilaw na plema; lagnat at panginginig; mabilis o mababaw na paghinga; sakit sa dibdib sa malalim na paghinga; pagkapagod. Kumonsulta agad kung mahirap nang huminga.",
  },
  {
    slug: "pneumonia-symptoms-ceb",
    disease: "pneumonia",
    locale: "ceb",
    category: "symptoms",
    title: "Mga Sintomas sa Pulmonya",
    summary:
      "Kasagaran ang ubo nga adunay plema, hilanat, paspas nga gininhawa, ug kasakit sa dughan.",
    body_md:
      "Bantayan: ubo nga adunay berde/dalag nga plema; hilanat ug pangurog; paspas o gamay nga gininhawa; kasakit sa dughan; kakapoy. Pakonsulta dayon kung lisod na ang gininhawa.",
  },
  {
    slug: "pneumonia-treatment-en",
    disease: "pneumonia",
    locale: "en",
    category: "treatment",
    title: "Pneumonia Treatment",
    summary:
      "Bacterial pneumonia is treated with antibiotics; viral pneumonia with rest and care.",
    body_md:
      "Take prescribed antibiotics for the full course. Rest, drink plenty of fluids, and use paracetamol for fever. Seek hospital care if breathing is very difficult, lips turn bluish, or fever does not break after 2 days.",
  },
  {
    slug: "pneumonia-treatment-tl",
    disease: "pneumonia",
    locale: "tl",
    category: "treatment",
    title: "Paggamot sa Pulmonya",
    summary:
      "Antibiyotiko para sa bacterial pneumonia; pamamahinga at suporta para sa viral.",
    body_md:
      "Inumin nang buo ang antibiyotiko. Magpahinga, uminom ng maraming likido, at gumamit ng paracetamol para sa lagnat. Magpa-ospital kung mahirap nang huminga o kung lampas dalawang araw na ang lagnat.",
  },
  {
    slug: "pneumonia-treatment-ceb",
    disease: "pneumonia",
    locale: "ceb",
    category: "treatment",
    title: "Tambal sa Pulmonya",
    summary:
      "Antibiotic alang sa bacterial; pahuway ug atiman alang sa viral.",
    body_md:
      "Imna ang antibiotic hangtud mahuman. Pahuway, daghang tubig, ug paracetamol alang sa hilanat. Adto sa ospital kung lisod na magginhawa o kung labaw sa duha ka adlaw ang hilanat.",
  },
  {
    slug: "pneumonia-prevention-en",
    disease: "pneumonia",
    locale: "en",
    category: "prevention",
    title: "Preventing Pneumonia",
    summary:
      "Vaccination, hand hygiene, and good ventilation reduce pneumonia risk.",
    body_md:
      "Get the pneumococcal vaccine for children and seniors; flu vaccine yearly; wash hands often; avoid smoking; keep rooms well ventilated.",
  },
  {
    slug: "pneumonia-prevention-tl",
    disease: "pneumonia",
    locale: "tl",
    category: "prevention",
    title: "Pag-iwas sa Pulmonya",
    summary:
      "Bakuna, paghuhugas ng kamay, at maayos na bentilasyon.",
    body_md:
      "Kumuha ng pneumococcal vaccine para sa mga bata at matatanda; flu vaccine kada taon; madalas na paghuhugas ng kamay; iwasan ang sigarilyo; siguraduhing may sariwang hangin sa bahay.",
  },
  {
    slug: "pneumonia-prevention-ceb",
    disease: "pneumonia",
    locale: "ceb",
    category: "prevention",
    title: "Pag-likay sa Pulmonya",
    summary: "Bakuna, panghugas sa kamot, ug maayong bentilasyon.",
    body_md:
      "Kuhaa ang pneumococcal vaccine alang sa mga bata ug tigulang; flu vaccine kada tuig; kanunay nga panghugas sa kamot; likayi ang sigarilyo; siguruha ang lab-as nga hangin sa balay.",
  },
  {
    slug: "pneumonia-lifestyle-en",
    disease: "pneumonia",
    locale: "en",
    category: "lifestyle",
    title: "Sleep, Nutrition & Exercise While Recovering",
    summary:
      "Rest deeply, eat protein-rich meals, and resume activity gradually.",
    body_md:
      "Sleep: at least 8 hours during recovery. Nutrition: warm soups, fruits, vegetables, and lean protein; sip water often to thin phlegm. Exercise: gentle stretching and short walks once fever-free for 48 hours.",
  },
  {
    slug: "pneumonia-lifestyle-tl",
    disease: "pneumonia",
    locale: "tl",
    category: "lifestyle",
    title: "Tulog, Nutrisyon at Ehersisyo Habang Naggaling",
    summary:
      "Mahabang tulog, masustansyang pagkain, at unti-unting paggalaw.",
    body_md:
      "Tulog: hindi bababa sa 8 oras. Nutrisyon: mainit na sabaw, prutas, gulay, at protina; uminom ng tubig para mapanipis ang plema. Ehersisyo: banayad na pag-unat at maikling lakad kapag walang lagnat ng 48 oras.",
  },
  {
    slug: "pneumonia-lifestyle-ceb",
    disease: "pneumonia",
    locale: "ceb",
    category: "lifestyle",
    title: "Katulog, Nutrisyon ug Ehersisyo Samtang Nag-Ayo",
    summary:
      "Taas nga katulog, masustansiya nga pagkaon, ug hinay-hinay nga paglihok.",
    body_md:
      "Katulog: di moubos sa 8 oras. Nutrisyon: init nga sabaw, prutas, utan, ug protina; daghang tubig aron manipisin ang plema. Ehersisyo: humok nga inat ug mubo nga paglakaw kung wala nay hilanat sulod sa 48 oras.",
  },

  // ---------- COVID-19 ----------
  {
    slug: "covid-overview-en",
    disease: "covid19",
    locale: "en",
    category: "overview",
    title: "What is COVID-19?",
    summary:
      "COVID-19 is a respiratory illness caused by the SARS-CoV-2 virus.",
    body_md:
      "COVID-19 spreads through respiratory droplets and aerosols. Symptoms range from mild (cough, fever) to severe (pneumonia, breathing difficulty). Vaccination and boosters reduce risk of severe disease.",
  },
  {
    slug: "covid-overview-tl",
    disease: "covid19",
    locale: "tl",
    category: "overview",
    title: "Ano ang COVID-19?",
    summary:
      "Ang COVID-19 ay sakit sa respiratoryo na sanhi ng SARS-CoV-2.",
    body_md:
      "Kumakalat sa pamamagitan ng patak ng laway at aerosol. Maaaring banayad lang ang sintomas o malala. Ang bakuna at booster ay nakatutulong para hindi lumala.",
  },
  {
    slug: "covid-overview-ceb",
    disease: "covid19",
    locale: "ceb",
    category: "overview",
    title: "Unsa ang COVID-19?",
    summary:
      "Ang COVID-19 usa ka sakit sa baga gikan sa SARS-CoV-2 nga virus.",
    body_md:
      "Mokatap pinaagi sa laway ug aerosol. Mahimong humok o grabi ang sintomas. Ang bakuna ug booster makapakunhod sa risgo nga grabi.",
  },
  {
    slug: "covid-symptoms-en",
    disease: "covid19",
    locale: "en",
    category: "symptoms",
    title: "COVID-19 Symptoms",
    summary:
      "Fever, cough, sore throat, fatigue, and loss of taste/smell are common.",
    body_md:
      "Watch for fever, cough, sore throat, headache, body aches, fatigue, loss of smell or taste, and shortness of breath. Test if symptoms appear after exposure or travel.",
  },
  {
    slug: "covid-symptoms-tl",
    disease: "covid19",
    locale: "tl",
    category: "symptoms",
    title: "Mga Sintomas ng COVID-19",
    summary:
      "Lagnat, ubo, masakit na lalamunan, pagod, at pagkawala ng panlasa/pang-amoy.",
    body_md:
      "Bantayan ang lagnat, ubo, masakit na lalamunan, sakit ng ulo, pananakit ng katawan, pagkapagod, pagkawala ng amoy o panlasa, at hirap sa paghinga. Magpa-test kung lumitaw matapos magkalapit sa may COVID o pagbiyahe.",
  },
  {
    slug: "covid-symptoms-ceb",
    disease: "covid19",
    locale: "ceb",
    category: "symptoms",
    title: "Mga Sintomas sa COVID-19",
    summary:
      "Hilanat, ubo, sakit sa tutonlan, kakapoy, ug pagkawala sa panimho/panlami.",
    body_md:
      "Bantayan ang hilanat, ubo, sakit sa tutonlan, sakit sa ulo, kasakit sa lawas, kakapoy, pagkawala sa baho o lami, ug kalisud sa pagginhawa. Pagpa-test kung mosulpot ang sintomas.",
  },
  {
    slug: "covid-treatment-en",
    disease: "covid19",
    locale: "en",
    category: "treatment",
    title: "COVID-19 Treatment",
    summary: "Most cases recover at home with rest, fluids, and fever control.",
    body_md:
      "Rest, drink fluids, and take paracetamol for fever. Antiviral medication may be prescribed for high-risk patients. Seek emergency care for chest pain, persistent shortness of breath, or oxygen saturation below 94%.",
  },
  {
    slug: "covid-treatment-tl",
    disease: "covid19",
    locale: "tl",
    category: "treatment",
    title: "Paggamot sa COVID-19",
    summary:
      "Karamihan ay gumagaling sa bahay sa pamamagitan ng pamamahinga at maraming likido.",
    body_md:
      "Magpahinga, uminom ng maraming likido, at gumamit ng paracetamol para sa lagnat. Maaaring mag-reseta ng antiviral sa high-risk. Magpa-emergency kung may sakit sa dibdib, hirap huminga, o mababang oxygen.",
  },
  {
    slug: "covid-treatment-ceb",
    disease: "covid19",
    locale: "ceb",
    category: "treatment",
    title: "Tambal sa COVID-19",
    summary:
      "Kasagaran mo-ayo sa balay nga pahuway ug daghan tubig.",
    body_md:
      "Pahuway, daghang tubig, paracetamol alang sa hilanat. Mahimong hatagan og antiviral ang high-risk. Adto dayon sa ospital kung adunay kasakit sa dughan o ubos ang oxygen.",
  },
  {
    slug: "covid-prevention-en",
    disease: "covid19",
    locale: "en",
    category: "prevention",
    title: "Preventing COVID-19",
    summary:
      "Vaccination, masks in crowds, and good ventilation remain key.",
    body_md:
      "Stay up to date on vaccines and boosters; wear a mask in crowded indoor settings; wash hands frequently; ventilate rooms; stay home if symptomatic and test before contact with vulnerable people.",
  },
  {
    slug: "covid-prevention-tl",
    disease: "covid19",
    locale: "tl",
    category: "prevention",
    title: "Pag-iwas sa COVID-19",
    summary:
      "Bakuna, mask sa matataong lugar, at maayong bentilasyon.",
    body_md:
      "Updated sa bakuna at booster; mag-mask sa matataong saradong lugar; madalas na paghuhugas ng kamay; bentilasyon; manatili sa bahay kung may sintomas at magpa-test bago lumapit sa mga matatanda o sanggol.",
  },
  {
    slug: "covid-prevention-ceb",
    disease: "covid19",
    locale: "ceb",
    category: "prevention",
    title: "Pag-likay sa COVID-19",
    summary:
      "Bakuna, mask sa daghan og tawo, ug maayong bentilasyon.",
    body_md:
      "Up-to-date sa bakuna ug booster; mag-mask sa daghan ang tawo; kanunay nga panghugas sa kamot; bentilasyon; pabilin sa balay kung adunay sintomas, pagpa-test sa wala pa makig-uban sa tigulang o bata.",
  },
  {
    slug: "covid-lifestyle-en",
    disease: "covid19",
    locale: "en",
    category: "lifestyle",
    title: "Recovery: Sleep, Food & Activity",
    summary: "Hydrate, sleep well, and ease back into activity over 1–2 weeks.",
    body_md:
      "Sleep 8+ hours; eat light, nutritious meals (soup, fruits, eggs); hydrate often; resume light activity gradually after symptoms resolve and avoid strenuous exercise for at least 1–2 weeks.",
  },
  {
    slug: "covid-lifestyle-tl",
    disease: "covid19",
    locale: "tl",
    category: "lifestyle",
    title: "Pag-galing: Tulog, Pagkain at Galaw",
    summary:
      "Maraming tubig, sapat na tulog, at unti-unting pagbabalik sa aktibidad.",
    body_md:
      "8+ oras na tulog; magaan at masustansyang pagkain (sabaw, prutas, itlog); madalas na uminom; balik sa light activity unti-unti, iwasan ang mabigat na ehersisyo ng 1–2 linggo.",
  },
  {
    slug: "covid-lifestyle-ceb",
    disease: "covid19",
    locale: "ceb",
    category: "lifestyle",
    title: "Pag-Ayo: Katulog, Pagkaon ug Lihok",
    summary:
      "Daghan tubig, igong katulog, ug hinay-hinay nga pagbalik sa lihok.",
    body_md:
      "8+ ka oras nga katulog; magaan ug masustansiya (sabaw, prutas, itlog); kanunay nga tubig; balik sa light activity hinay-hinay, likayi ang bug-at nga ehersisyo sulod sa 1–2 ka semana.",
  },

  // ---------- Asthma ----------
  {
    slug: "asthma-overview-en",
    disease: "asthma",
    locale: "en",
    category: "overview",
    title: "What is Asthma?",
    summary:
      "Asthma is a long-term condition where airways narrow and swell, making breathing hard.",
    body_md:
      "Asthma causes recurring episodes of wheezing, shortness of breath, chest tightness, and coughing. Triggers include dust, pollen, smoke, exercise, and respiratory infections. With proper treatment, most people with asthma live normal lives.",
  },
  {
    slug: "asthma-overview-tl",
    disease: "asthma",
    locale: "tl",
    category: "overview",
    title: "Ano ang Hika?",
    summary:
      "Ang hika ay matagalang sakit kung saan kumikipot at namamaga ang daanan ng hangin.",
    body_md:
      "Ang hika ay nagdudulot ng paulit-ulit na kakapusan sa hininga, sipol sa dibdib, at ubo. Mga trigger: alikabok, pollen, usok, ehersisyo, at respiratory infection. Sa tamang gamot, normal ang buhay.",
  },
  {
    slug: "asthma-overview-ceb",
    disease: "asthma",
    locale: "ceb",
    category: "overview",
    title: "Unsa ang Hubak?",
    summary:
      "Ang hubak (asthma) usa ka dugay nga sakit nga ang dalan sa hangin mahubag.",
    body_md:
      "Ang hubak makahatag og pabalik-balik nga kalisud sa pagginhawa, sip-on sa dughan, ug ubo. Mga trigger: abog, pollen, aso, ehersisyo, ug impeksyon sa baga. Sa tarung nga tambal, normal ang kinabuhi.",
  },
  {
    slug: "asthma-symptoms-en",
    disease: "asthma",
    locale: "en",
    category: "symptoms",
    title: "Recognizing an Asthma Attack",
    summary:
      "Wheezing, shortness of breath, chest tightness, and coughing are warning signs.",
    body_md:
      "Watch for wheezing on exhale, difficulty speaking, chest tightness, and persistent coughing especially at night. Use a rescue inhaler immediately and seek care if it doesn't improve.",
  },
  {
    slug: "asthma-symptoms-tl",
    disease: "asthma",
    locale: "tl",
    category: "symptoms",
    title: "Pagkilala sa Atake ng Hika",
    summary:
      "Pagsipol, hirap huminga, paninikip ng dibdib, at ubo ay babala.",
    body_md:
      "Bantayan ang sipol sa paghinga, hirap magsalita, paninikip ng dibdib, at tuloy-tuloy na ubo lalo sa gabi. Gamitin agad ang rescue inhaler at kumonsulta kung hindi gumagaling.",
  },
  {
    slug: "asthma-symptoms-ceb",
    disease: "asthma",
    locale: "ceb",
    category: "symptoms",
    title: "Pag-ila sa Atake sa Hubak",
    summary:
      "Sip-on, kalisud sa gininhawa, kasamok sa dughan, ug ubo mga ilhanan.",
    body_md:
      "Bantayan ang sip-on, kalisud mosulti, kasamok sa dughan, ug padayon nga ubo ilabi sa gabii. Gamita dayon ang rescue inhaler ug pagpakonsulta kung wala mo-ayo.",
  },
  {
    slug: "asthma-treatment-en",
    disease: "asthma",
    locale: "en",
    category: "treatment",
    title: "Asthma Treatment",
    summary:
      "Asthma is controlled with daily controller inhalers and rescue inhalers for attacks.",
    body_md:
      "Daily controller inhalers (inhaled corticosteroids) reduce inflammation. Rescue inhalers (short-acting beta-agonists) relieve sudden attacks. Avoid triggers and follow your doctor's asthma action plan.",
  },
  {
    slug: "asthma-treatment-tl",
    disease: "asthma",
    locale: "tl",
    category: "treatment",
    title: "Paggamot sa Hika",
    summary:
      "Kontrolado ang hika sa araw-araw na controller inhaler at rescue inhaler para sa atake.",
    body_md:
      "Ang controller inhaler (corticosteroid) ay nagpapababa ng pamamaga. Ang rescue inhaler ay para sa biglaang atake. Iwasan ang trigger at sundin ang asthma action plan ng doktor.",
  },
  {
    slug: "asthma-treatment-ceb",
    disease: "asthma",
    locale: "ceb",
    category: "treatment",
    title: "Tambal sa Hubak",
    summary:
      "Makontrol ang hubak sa adlaw-adlaw nga controller inhaler ug rescue inhaler.",
    body_md:
      "Ang controller inhaler (corticosteroid) makapakunhod sa kahubag. Ang rescue inhaler alang sa kalit nga atake. Likayi ang trigger ug sunda ang plano sa doktor.",
  },
  {
    slug: "asthma-prevention-en",
    disease: "asthma",
    locale: "en",
    category: "prevention",
    title: "Avoiding Asthma Triggers",
    summary:
      "Identify and avoid your personal triggers; keep your environment clean.",
    body_md:
      "Common triggers include dust mites, pet dander, smoke, strong fragrances, cold air, and respiratory infections. Keep bedding clean, vacuum often, avoid smoking, and get the flu shot yearly.",
  },
  {
    slug: "asthma-prevention-tl",
    disease: "asthma",
    locale: "tl",
    category: "prevention",
    title: "Pag-iwas sa Trigger ng Hika",
    summary:
      "Kilalanin at iwasan ang sariling trigger; panatilihing malinis ang kapaligiran.",
    body_md:
      "Karaniwang trigger: alikabok, balahibo ng alaga, usok, mabangong amoy, malamig na hangin, at trangkaso. Linisin ang kama at sahig, iwasan ang sigarilyo, at magpa-flu shot kada taon.",
  },
  {
    slug: "asthma-prevention-ceb",
    disease: "asthma",
    locale: "ceb",
    category: "prevention",
    title: "Pag-likay sa Trigger sa Hubak",
    summary:
      "Ilha ug likayi ang kaugalingong trigger; limpyo ang palibot.",
    body_md:
      "Komon nga trigger: abog, balhibo sa hayop, aso, kusog nga humot, bugnaw nga hangin, ug trangkaso. Limpyo ang habol ug salog, likayi ang sigarilyo, ug magpa-flu shot kada tuig.",
  },
  {
    slug: "asthma-lifestyle-en",
    disease: "asthma",
    locale: "en",
    category: "lifestyle",
    title: "Sleep, Diet & Exercise with Asthma",
    summary:
      "Most people with controlled asthma can exercise and live normally.",
    body_md:
      "Sleep: keep bedroom dust-free; use fragrance-free bedding. Nutrition: omega-3 (fatty fish), fruits, and vegetables support lung health. Exercise: warm up well, choose swimming or walking; always carry your rescue inhaler.",
  },
  {
    slug: "asthma-lifestyle-tl",
    disease: "asthma",
    locale: "tl",
    category: "lifestyle",
    title: "Tulog, Diyeta at Ehersisyo sa Hika",
    summary:
      "Karamihan na may kontroladong hika ay maaaring mag-ehersisyo nang normal.",
    body_md:
      "Tulog: malinis ang kwarto, walang alikabok. Nutrisyon: omega-3 (isda), prutas at gulay. Ehersisyo: mag-warm-up, pumili ng swimming o paglalakad; laging may dalang rescue inhaler.",
  },
  {
    slug: "asthma-lifestyle-ceb",
    disease: "asthma",
    locale: "ceb",
    category: "lifestyle",
    title: "Katulog, Diyeta ug Ehersisyo sa Hubak",
    summary:
      "Kasagaran sa kontrolado nga hubak makaehersisyo og normal.",
    body_md:
      "Katulog: limpyo ang kwarto. Nutrisyon: omega-3 (isda), prutas, ug utan. Ehersisyo: mag-warm-up, mopili og swimming o paglakaw; daladala ang rescue inhaler.",
  },
];

export function articlesFor(disease: Disease, locale: Locale): HealthArticle[] {
  return HEALTH_ARTICLES.filter(
    (a) => a.disease === disease && a.locale === locale
  );
}
