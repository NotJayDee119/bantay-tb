import { CalendarRange } from "lucide-react";
import type { CaseYear } from "../hooks/useCaseYear";

/**
 * "Show cases from: All years | 2026 | 2025 | 2024" — a segmented control
 * big enough to tap, labelled in words so its job is obvious.
 */
export function YearFilter({
  value,
  years,
  onChange,
  className = "",
}: {
  value: CaseYear;
  years: number[];
  onChange: (next: CaseYear) => void;
  className?: string;
}) {
  const options: { key: CaseYear; label: string }[] = [
    { key: "all", label: "All years" },
    ...years.map((y) => ({ key: y as CaseYear, label: String(y) })),
  ];
  return (
    <div className={"flex flex-wrap items-center gap-2 " + className}>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600">
        <CalendarRange className="h-4 w-4 text-brand-600" />
        Show cases from
      </span>
      <div
        role="group"
        aria-label="Show cases from"
        className="flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-soft"
      >
        {options.map((o) => {
          const on = o.key === value;
          return (
            <button
              key={String(o.key)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.key)}
              className={
                "rounded-lg px-3.5 py-1.5 text-sm font-semibold tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 " +
                (on
                  ? "bg-brand-700 text-white shadow-soft"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
