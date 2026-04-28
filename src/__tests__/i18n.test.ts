import { describe, it, expect } from "vitest";
import { detectLocale } from "../lib/i18n";

// Capstone target: ≥90% language detection accuracy on queries of 3+ words.
// The corpus below mixes typical TB-related questions a community member
// might ask in each language.
const CORPUS: { text: string; expected: "en" | "tl" | "ceb" }[] = [
  // English (20)
  { text: "What are the symptoms of tuberculosis?", expected: "en" },
  { text: "How long is TB treatment?", expected: "en" },
  { text: "Where is the nearest DOTS center?", expected: "en" },
  { text: "Can TB be cured completely?", expected: "en" },
  { text: "Is the cough always with blood?", expected: "en" },
  { text: "What medicine should I take?", expected: "en" },
  { text: "Why am I always tired?", expected: "en" },
  { text: "Can children get tuberculosis too?", expected: "en" },
  { text: "How do I prevent TB at home?", expected: "en" },
  { text: "Should I get tested for TB?", expected: "en" },
  { text: "I have had a fever for three days.", expected: "en" },
  { text: "Please tell me about pneumonia symptoms.", expected: "en" },
  { text: "Is asthma the same as TB?", expected: "en" },
  { text: "How is TB transmitted between people?", expected: "en" },
  { text: "What should I eat during treatment?", expected: "en" },
  { text: "Is the treatment really free?", expected: "en" },
  { text: "Hello doctor, I have a question about my cough.", expected: "en" },
  { text: "Can I drink alcohol while on TB medicine?", expected: "en" },
  { text: "Why is my chest hurting when I cough?", expected: "en" },
  { text: "Thank you for the information you gave me.", expected: "en" },

  // Tagalog / Filipino (20)
  { text: "Ano ang mga sintomas ng TB?", expected: "tl" },
  { text: "Gaano katagal ang gamot sa TB?", expected: "tl" },
  { text: "Saan ang pinakamalapit na DOTS center?", expected: "tl" },
  { text: "Pwede po bang gumaling sa TB?", expected: "tl" },
  { text: "May dugo ang aking ubo, ano gagawin?", expected: "tl" },
  { text: "Ano ang dapat kong gawin pag may lagnat?", expected: "tl" },
  { text: "Bakit lagi akong pagod kahit hindi nagtatrabaho?", expected: "tl" },
  { text: "Pwede bang mahawa ang anak ko?", expected: "tl" },
  { text: "Paano ko maiiwasan ang TB sa bahay?", expected: "tl" },
  { text: "Kailangan ko bang magpasuri sa DOTS?", expected: "tl" },
  { text: "Tatlong araw na akong may lagnat.", expected: "tl" },
  { text: "Pakisabi naman tungkol sa pulmonya.", expected: "tl" },
  { text: "Pareho ba ang hika at TB?", expected: "tl" },
  { text: "Paano nakakahawa ang TB sa ibang tao?", expected: "tl" },
  { text: "Ano ang dapat kainin habang gumagamot?", expected: "tl" },
  { text: "Libre ba talaga ang gamot sa DOTS?", expected: "tl" },
  { text: "Kumusta po, may tanong ako tungkol sa ubo ko.", expected: "tl" },
  { text: "Pwede ba akong uminom ng alak habang gumagamot?", expected: "tl" },
  { text: "Bakit masakit ang dibdib ko pag umuubo?", expected: "tl" },
  { text: "Salamat po sa mga impormasyon ninyo.", expected: "tl" },

  // Cebuano / Bisaya (20)
  { text: "Unsa ang mga sintomas sa TB?", expected: "ceb" },
  { text: "Pila ka bulan ang tambal sa TB?", expected: "ceb" },
  { text: "Asa ang pinakaduol nga DOTS center?", expected: "ceb" },
  { text: "Mahimo ba nga maayo gyud ang TB?", expected: "ceb" },
  { text: "Naa koy dugo sa ubo, unsa akong buhaton?", expected: "ceb" },
  { text: "Unsa akong angay buhaton kung naay hilanat?", expected: "ceb" },
  { text: "Ngano kapoy kaayo ko bisan walay trabaho?", expected: "ceb" },
  { text: "Mahawa ba ang akong anak?", expected: "ceb" },
  { text: "Unsaon nako paglikay sa TB sa balay?", expected: "ceb" },
  { text: "Kinahanglan ba ko mag-eksamen sa DOTS?", expected: "ceb" },
  { text: "Tulo ka adlaw na ko gihilantan.", expected: "ceb" },
  { text: "Palihug isulti bahin sa pulmonya.", expected: "ceb" },
  { text: "Parehas ba ang hubak ug TB?", expected: "ceb" },
  { text: "Unsaon pagkasangyaw ang TB sa tao?", expected: "ceb" },
  { text: "Unsa angay kaonon samtang nagatambal?", expected: "ceb" },
  { text: "Libre ba gyud ang tambal sa DOTS?", expected: "ceb" },
  { text: "Kumusta dok, naa koy pangutana sa akong ubo.", expected: "ceb" },
  { text: "Pwede ba ko moinom og alak samtang gatambal?", expected: "ceb" },
  { text: "Ngano nga sakit akong dughan kung ko muubo?", expected: "ceb" },
  { text: "Salamat sa mga impormasyon nga gihatag mo.", expected: "ceb" },
];

describe("detectLocale", () => {
  it("achieves ≥90% accuracy on the bundled 60-query corpus", () => {
    const total = CORPUS.length;
    const correct = CORPUS.filter((c) => detectLocale(c.text) === c.expected)
      .length;
    const accuracy = correct / total;
    // eslint-disable-next-line no-console
    console.log(
      `Language detection accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${total})`
    );
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });

  it("returns en for empty input", () => {
    expect(detectLocale("")).toBe("en");
  });
});
