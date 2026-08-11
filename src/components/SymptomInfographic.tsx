import { cn } from "../lib/utils";
import { SymptomIcon } from "./SymptomIcon";
import {
  DISEASE_SYMPTOMS,
  SYMPTOM_GRID_HEADING,
  SYMPTOM_GRID_NOTE,
  SYMPTOM_HALLMARK_LABEL,
} from "../data/symptomVisuals";
import type { Disease } from "../data/healthContent";
import type { Locale } from "../lib/i18n";

/**
 * The symptom grid: one labelled drawing per sign, shown above the symptoms
 * article.
 *
 * The signs that most distinguish the disease are drawn filled and tinted
 * rather than merely bigger, so the emphasis survives being read on a cheap
 * phone in daylight — and it is carried in text too ("Watch closely") rather
 * than by colour alone.
 */
export function SymptomInfographic({
  disease,
  locale,
  className,
}: {
  disease: Disease;
  locale: Locale;
  className?: string;
}) {
  const symptoms = DISEASE_SYMPTOMS[disease];
  if (!symptoms?.length) return null;

  return (
    <section
      aria-labelledby="symptom-grid-heading"
      className={cn(
        "rounded-3xl border-2 border-amber-200 bg-amber-50/60 p-4 sm:p-5",
        className
      )}
    >
      <h3
        id="symptom-grid-heading"
        className="font-display text-base font-extrabold tracking-tight text-slate-900"
      >
        {SYMPTOM_GRID_HEADING[locale]}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
        {SYMPTOM_GRID_NOTE[locale]}
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {symptoms.map((s) => (
          <li
            key={s.icon + s.label.en}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border-2 bg-white p-3 text-center",
              s.hallmark
                ? "border-amber-300 shadow-soft"
                : "border-slate-200"
            )}
          >
            <span
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
                s.hallmark
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              <SymptomIcon name={s.icon} className="h-7 w-7" />
            </span>
            <span className="text-[12px] font-bold leading-snug text-slate-800">
              {s.label[locale]}
            </span>
            {s.hallmark && (
              <span className="text-[9px] font-extrabold uppercase tracking-wide text-amber-700">
                {SYMPTOM_HALLMARK_LABEL[locale]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SymptomInfographic;
