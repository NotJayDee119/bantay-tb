import { useMemo, useState } from "react";
import { Stethoscope, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge, Card, PageHeader } from "../../components/ui";

// Simple rule-based clinical decision support for presumptive TB screening.
// Rules are based on Philippine NTP guidelines for presumptive TB and the
// WHO 4-symptom screen. This is *decision support*, not a substitute for
// clinical judgement — every recommendation links back to a doctor referral.

interface Symptom {
  key: string;
  label: string;
  helper?: string;
  weight: number; // contribution to presumption score
  red?: boolean; // red-flag (auto-refer regardless of score)
}

const SYMPTOMS: Symptom[] = [
  {
    key: "cough_2w",
    label: "Cough lasting 2 weeks or more",
    helper: "Cardinal symptom; cough <2 wk = lower priority",
    weight: 3,
  },
  { key: "fever_2w", label: "Unexplained fever ≥ 2 weeks", weight: 2 },
  { key: "night_sweats", label: "Night sweats", weight: 1 },
  { key: "weight_loss", label: "Unintentional weight loss", weight: 2 },
  {
    key: "hemoptysis",
    label: "Hemoptysis (coughing blood)",
    helper: "Red flag — refer immediately for chest X-ray and sputum AFB",
    weight: 3,
    red: true,
  },
  {
    key: "contact_tb",
    label: "Household / close contact of a known TB patient",
    helper: "Eligible for IPT screening per NTP",
    weight: 2,
  },
  { key: "chest_pain", label: "Persistent chest pain", weight: 1 },
  { key: "fatigue", label: "Marked fatigue / loss of appetite", weight: 1 },
];

const COMORBID: Symptom[] = [
  {
    key: "hiv",
    label: "Known HIV positive",
    helper: "WHO: any single symptom is presumptive; refer immediately",
    weight: 3,
    red: true,
  },
  { key: "diabetes", label: "Diabetes mellitus", weight: 1 },
  { key: "smoker", label: "Current or ex-smoker", weight: 1 },
  { key: "malnourished", label: "Underweight / malnourished", weight: 1 },
];

export function Cds() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [age, setAge] = useState<string>("");

  function toggle(key: string) {
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }

  const result = useMemo(() => evaluate(checked, age), [checked, age]);

  return (
    <>
      <PageHeader
        title="Clinical Decision Support"
        subtitle="Rule-based presumptive TB screening for BHWs, nurses, and doctors. Decision support only — final triage rests with the clinician."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Stethoscope className="h-4 w-4" /> Symptom screen
          </div>

          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-semibold text-slate-700">
              Patient age (years, optional)
            </span>
            <input
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="h-10 w-32 rounded-md border border-slate-300 px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>

          <Section title="Cardinal symptoms" items={SYMPTOMS} state={checked} onToggle={toggle} />
          <Section title="Comorbidities and risk factors" items={COMORBID} state={checked} onToggle={toggle} />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <AlertTriangle className="h-4 w-4" /> Recommendation
          </div>
          <Recommendation result={result} />
          <p className="mt-4 text-xs text-slate-400">
            Sources: NTP MOP 2020 §4.2 (Presumptive TB criteria); WHO
            consolidated guidelines on TB module 2 (screening). This tool does
            not record or transmit patient data.
          </p>
        </Card>
      </div>
    </>
  );
}

function Section({
  title,
  items,
  state,
  onToggle,
}: {
  title: string;
  items: Symptom[];
  state: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((s) => (
          <li key={s.key}>
            <label className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-slate-50">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={!!state[s.key]}
                onChange={() => onToggle(s.key)}
              />
              <span className="text-sm">
                <span className="font-medium text-slate-800">{s.label}</span>
                {s.red && (
                  <Badge tone="danger" className="ml-2 align-middle text-[10px]">
                    red flag
                  </Badge>
                )}
                {s.helper && (
                  <span className="block text-xs text-slate-500">
                    {s.helper}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CdsResult {
  level: "none" | "low" | "moderate" | "high";
  score: number;
  presumptive: boolean;
  redFlags: string[];
  triggered: string[];
  next: string[];
}

function evaluate(
  state: Record<string, boolean>,
  ageStr: string
): CdsResult {
  const all = [...SYMPTOMS, ...COMORBID];
  let score = 0;
  const triggered: string[] = [];
  const redFlags: string[] = [];
  for (const s of all) {
    if (!state[s.key]) continue;
    score += s.weight;
    triggered.push(s.label);
    if (s.red) redFlags.push(s.label);
  }
  // Cough ≥2 wk = always presumptive per NTP MOP
  const cough = !!state["cough_2w"];
  const presumptive = cough || redFlags.length > 0 || score >= 4;

  let level: CdsResult["level"] = "none";
  if (redFlags.length > 0) level = "high";
  else if (presumptive) level = score >= 6 ? "high" : "moderate";
  else if (score > 0) level = "low";

  const age = Number(ageStr);
  const isChild = !Number.isNaN(age) && age > 0 && age < 15;

  const next: string[] = [];
  if (level === "high") {
    next.push("Refer to nearest DOTS center / RHU today.");
    next.push("Order chest X-ray and sputum AFB smear / Xpert MTB/RIF.");
  }
  if (level === "moderate") {
    next.push("Refer for chest X-ray and sputum AFB smear within 1–3 days.");
  }
  if (presumptive && state["contact_tb"]) {
    next.push(
      "Initiate household contact investigation; offer IPT to eligible contacts."
    );
  }
  if (isChild && presumptive) {
    next.push(
      "Pediatric TB pathway: tuberculin skin test or IGRA, chest X-ray, refer to pediatrician."
    );
  }
  if (state["hiv"] && level !== "none") {
    next.push("HIV-TB co-management: refer to HIV clinic and start ART planning.");
  }
  if (level === "low") {
    next.push("Symptomatic management; recheck if symptoms persist or worsen.");
  }
  if (level === "none") {
    next.push("No presumptive TB indicators. Educate on symptoms to watch for.");
  }

  return { level, score, presumptive, redFlags, triggered, next };
}

function Recommendation({ result }: { result: CdsResult }) {
  const tone =
    result.level === "high"
      ? { bg: "bg-red-50", text: "text-red-800", icon: AlertTriangle }
      : result.level === "moderate"
        ? { bg: "bg-amber-50", text: "text-amber-800", icon: AlertTriangle }
        : result.level === "low"
          ? { bg: "bg-sky-50", text: "text-sky-800", icon: Stethoscope }
          : { bg: "bg-emerald-50", text: "text-emerald-800", icon: CheckCircle2 };
  const Icon = tone.icon;
  const label =
    result.level === "high"
      ? "HIGH presumption — urgent referral"
      : result.level === "moderate"
        ? "MODERATE presumption — refer for workup"
        : result.level === "low"
          ? "LOW presumption — observe"
          : "No symptoms selected";

  return (
    <div>
      <div className={`flex items-center gap-2 rounded-md ${tone.bg} px-3 py-2 ${tone.text}`}>
        <Icon className="h-4 w-4" />
        <span className="text-sm font-semibold">{label}</span>
        <span className="ml-auto text-xs">score {result.score}</span>
      </div>

      {result.redFlags.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Red flags
          </div>
          <ul className="ml-4 list-disc text-sm text-slate-800">
            {result.redFlags.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Recommended next steps
        </div>
        <ul className="ml-4 mt-1 list-disc space-y-1 text-sm text-slate-800">
          {result.next.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
