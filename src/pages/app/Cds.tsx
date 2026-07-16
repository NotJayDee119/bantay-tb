import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import { Badge, Card, Input, Label, PageHeader } from "../../components/ui";

// Rule-based clinical decision support for presumptive TB screening.
// Rules derived from Philippine NTP MOP 5th ed. (2020) §4.2 and WHO
// Consolidated Guidelines on TB Module 2: Screening (2021).
// This tool is DECISION SUPPORT ONLY — final triage rests with the clinician.

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

interface Symptom {
  key: string;
  label: string;
  helper?: string;
  weight: number;
  red?: boolean;
}

const SYMPTOMS: Symptom[] = [
  {
    key: "cough_2w",
    label: "Cough lasting 2 weeks or more",
    helper: "Cardinal symptom; cough < 2 wk = lower priority",
    weight: 3,
  },
  {
    key: "fever_2w",
    label: "Unexplained fever ≥ 2 weeks",
    weight: 2,
  },
  {
    key: "night_sweats",
    label: "Night sweats",
    weight: 1,
  },
  {
    key: "weight_loss",
    label: "Unintentional weight loss",
    weight: 2,
  },
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
  {
    key: "chest_pain",
    label: "Persistent chest pain",
    weight: 1,
  },
  {
    key: "fatigue",
    label: "Marked fatigue / loss of appetite",
    weight: 1,
  },
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

const REFERENCES = [
  {
    num: 1,
    short: "DOH Philippines — NTP MOP 5th ed. (2020), §4.2",
    full: "Department of Health Philippines, National Tuberculosis Control Program. Manual of Procedures, 5th edition (2020). Section 4.2: Identification of Presumptive TB Cases.",
  },
  {
    num: 2,
    short: "WHO — Consolidated Guidelines on TB, Module 2: Screening (2021)",
    full: "World Health Organization. WHO Consolidated Guidelines on Tuberculosis, Module 2: Screening — Systematic Screening for Tuberculosis Disease. Geneva: WHO; 2021. ISBN 978-92-4-003399-2.",
  },
  {
    num: 3,
    short: "WHO — Latent TB Infection Guidelines (2018)",
    full: "World Health Organization. Latent Tuberculosis Infection: Updated and Consolidated Guidelines for Programmatic Management. Geneva: WHO; 2018. ISBN 978-92-4-155023-9. (Basis for IPT eligibility of household contacts.)",
  },
  {
    num: 4,
    short: "PhilCAT — Philippine Clinical Standards Manual on TB (2016)",
    full: "Philippine College of Chest Physicians (PhilCAT). Philippine Clinical Standards Manual on Tuberculosis (PCSMTB), 2016 edition. (Basis for clinical TB risk stratification used in this tool.)",
  },
];

export function Cds() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [age, setAge] = useState<string>("");

  function toggle(key: string) {
    setChecked((c) => ({ ...c, [key]: !c[key] }));
  }

  const result = useMemo(() => evaluate(checked, age), [checked, age]);

  const anyChecked = Object.values(checked).some(Boolean);

  return (
    <>
      <PageHeader
        title="Clinical Decision Support"
        subtitle="Rule-based presumptive TB screening for BHWs, nurses, and doctors. Decision support only — final triage rests with the clinician."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* ── Left: Symptom input ── */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
              <Stethoscope className="h-3.5 w-3.5 text-brand-600" />
              Symptom screen
            </div>
            {anyChecked && (
              <button
                type="button"
                onClick={() => {
                  setChecked({});
                  setAge("");
                }}
                className="text-xs font-medium text-slate-400 transition hover:text-red-500 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="p-5">
            {/* Age */}
            <div className="mb-5 space-y-1.5">
              <Label htmlFor="cds-age">
                Patient age{" "}
                <span className="font-normal text-slate-400">
                  (years, optional)
                </span>
              </Label>
              <Input
                id="cds-age"
                type="number"
                min={0}
                max={120}
                placeholder="e.g. 34"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-36"
              />
            </div>

            <SymptomSection
              title="Cardinal symptoms"
              items={SYMPTOMS}
              state={checked}
              onToggle={toggle}
            />
            <SymptomSection
              title="Comorbidities and risk factors"
              items={COMORBID}
              state={checked}
              onToggle={toggle}
              last
            />
          </div>
        </Card>

        {/* ── Right: Recommendation + References ── */}
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
              <AlertTriangle className="h-3.5 w-3.5 text-vigil-500" />
              <span className={MICRO_LABEL}>Recommendation</span>
            </div>
            <div className="p-5">
              <Recommendation result={result} />
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
              <BookOpen className="h-3.5 w-3.5 text-brand-600" />
              <span className={MICRO_LABEL}>References</span>
            </div>
            <div className="p-5">
              <p className="mb-3 text-xs text-slate-500">
                This tool applies rule-based logic derived from the following
                clinical guidelines. Recommendations are indicative only.
              </p>
              <ol className="space-y-3">
                {REFERENCES.map((r) => (
                  <li key={r.num} className="flex gap-2.5 text-xs text-slate-600">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                      {r.num}
                    </span>
                    <span>
                      <span className="font-semibold text-slate-800">{r.short}</span>
                      <span className="block mt-0.5 leading-relaxed text-slate-500">
                        {r.full}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                <ExternalLink className="h-3 w-3 shrink-0" />
                This tool does not record, store, or transmit any patient data.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function SymptomSection({
  title,
  items,
  state,
  onToggle,
  last = false,
}: {
  title: string;
  items: Symptom[];
  state: Record<string, boolean>;
  onToggle: (key: string) => void;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-5"}>
      <div className={"mb-2 " + MICRO_LABEL}>{title}</div>
      <ul className="space-y-1">
        {items.map((s) => {
          const active = !!state[s.key];
          return (
            <li key={s.key}>
              <label
                className={
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition " +
                  (s.red
                    ? active
                      ? "border-red-300 bg-red-50"
                      : "border-red-100 bg-red-50/40 hover:bg-red-50"
                    : active
                      ? "border-brand-200 bg-brand-50/60"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50")
                }
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={active}
                  onChange={() => onToggle(s.key)}
                />
                <span className="flex-1 text-sm">
                  <span className="inline-flex flex-wrap items-center gap-1.5 font-medium text-slate-800">
                    {s.label}
                    {s.red && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        <ShieldAlert className="h-2.5 w-2.5" />
                        red flag
                      </span>
                    )}
                  </span>
                  {s.helper && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                      {s.helper}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
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
  refNums: number[]; // citation numbers that drove this result
}

function evaluate(state: Record<string, boolean>, ageStr: string): CdsResult {
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

  const cough = !!state["cough_2w"];
  const presumptive = cough || redFlags.length > 0 || score >= 4;

  let level: CdsResult["level"] = "none";
  if (redFlags.length > 0) level = "high";
  else if (presumptive) level = score >= 6 ? "high" : "moderate";
  else if (score > 0) level = "low";

  const age = Number(ageStr);
  const isChild = !Number.isNaN(age) && age > 0 && age < 15;

  const next: string[] = [];
  const refNums = new Set<number>();

  if (level === "high") {
    next.push("Refer to nearest DOTS center / RHU today.");
    next.push("Order chest X-ray and sputum AFB smear / Xpert MTB/RIF.");
    refNums.add(1);
    refNums.add(2);
  }
  if (level === "moderate") {
    next.push("Refer for chest X-ray and sputum AFB smear within 1–3 days.");
    refNums.add(1);
    refNums.add(2);
  }
  if (presumptive && state["contact_tb"]) {
    next.push(
      "Initiate household contact investigation; offer IPT to eligible contacts."
    );
    refNums.add(3);
  }
  if (isChild && presumptive) {
    next.push(
      "Pediatric TB pathway: tuberculin skin test or IGRA, chest X-ray, refer to pediatrician."
    );
    refNums.add(4);
  }
  if (state["hiv"] && level !== "none") {
    next.push("HIV-TB co-management: refer to HIV clinic and start ART planning.");
    refNums.add(2);
  }
  if (level === "low") {
    next.push("Symptomatic management; recheck if symptoms persist or worsen.");
    refNums.add(1);
  }
  if (level === "none") {
    next.push("No presumptive TB indicators. Educate patient on warning symptoms.");
  }

  return {
    level,
    score,
    presumptive,
    redFlags,
    triggered,
    next,
    refNums: [...refNums].sort((a, b) => a - b),
  };
}

function Recommendation({ result }: { result: CdsResult }) {
  const config =
    result.level === "high"
      ? {
          bg: "bg-red-50 border-red-200",
          text: "text-red-800",
          iconColor: "text-red-600",
          barClass: "bg-red-500",
          icon: AlertTriangle,
          label: "HIGH presumption — urgent referral",
        }
      : result.level === "moderate"
        ? {
            bg: "bg-amber-50 border-amber-200",
            text: "text-amber-800",
            iconColor: "text-amber-600",
            barClass: "bg-amber-500",
            icon: AlertTriangle,
            label: "MODERATE presumption — refer for workup",
          }
        : result.level === "low"
          ? {
              bg: "bg-sky-50 border-sky-200",
              text: "text-sky-800",
              iconColor: "text-sky-600",
              barClass: "bg-sky-500",
              icon: Stethoscope,
              label: "LOW presumption — observe",
            }
          : {
              bg: "bg-accent-50 border-accent-200",
              text: "text-accent-800",
              iconColor: "text-accent-600",
              barClass: "bg-accent-500",
              icon: CheckCircle2,
              label: "No symptoms selected",
            };

  const Icon = config.icon;

  return (
    <div className="space-y-4">
      {/* Level banner */}
      <div
        className={`relative overflow-hidden rounded-xl border p-4 ${config.bg}`}
      >
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1 ${config.barClass}`}
        />
        <div className="flex items-center gap-3 pl-2">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/70 ${config.iconColor}`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className={`font-display text-base font-bold leading-tight tracking-tight ${config.text}`}>
              {config.label}
            </div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Composite score
            </div>
          </div>
          <span className={`font-display text-2xl font-extrabold tabular-nums ${config.text}`}>
            {result.score}
          </span>
        </div>
      </div>

      {/* Red flags */}
      {result.redFlags.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-700">
            <ShieldAlert className="h-3.5 w-3.5" />
            Red flags present
          </div>
          <ul className="space-y-1">
            {result.redFlags.map((r) => (
              <li key={r} className="flex items-start gap-1.5 text-sm text-red-800">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Triggered symptoms (summary) */}
      {result.triggered.length > 0 && (
        <div>
          <div className={"mb-1.5 " + MICRO_LABEL}>
            Symptoms / factors reported ({result.triggered.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.triggered.map((t) => (
              <Badge key={t} tone="default">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Next steps */}
      <div>
        <div className={"mb-2 " + MICRO_LABEL}>Recommended next steps</div>
        <ul className="space-y-2">
          {result.next.map((n) => (
            <li
              key={n}
              className="flex items-start gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
              {n}
            </li>
          ))}
        </ul>
        {result.refNums.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-400">
            Based on reference{result.refNums.length > 1 ? "s" : ""}{" "}
            {result.refNums.map((n) => `[${n}]`).join(" ")} below.
          </p>
        )}
      </div>

      {result.level !== "none" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>Disclaimer:</strong> This tool provides decision support only.
          Final clinical triage and diagnosis rest solely with the attending
          clinician.
        </div>
      )}
    </div>
  );
}
