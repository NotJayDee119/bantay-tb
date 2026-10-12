import { useState, type MouseEvent } from "react";
import { SERIES, type Slice } from "../lib/chartPalette";

/**
 * Dependency-free charts for the staff dashboards. Kept deliberately small:
 * a donut for part-to-whole and a column chart for ordered series (months,
 * age bands). Both carry a hover readout and a legend/axis so identity never
 * rests on colour alone.
 */

const R = 40;
const STROKE = 14;
const C = 2 * Math.PI * R;

export function DonutChart({
  slices,
  centerLabel = "Total",
  formatLabel = (s: string) => s.replace(/_/g, " "),
  size = "md",
  selected = null,
  onSelect,
}: {
  slices: Slice[];
  centerLabel?: string;
  formatLabel?: (s: string) => string;
  size?: "md" | "lg";
  /** Index held highlighted when nothing is hovered. */
  selected?: number | null;
  /** Makes slices and legend rows clickable. */
  onSelect?: (index: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? selected;
  const pick = (i: number) => (e: MouseEvent) => {
    if (!onSelect) return;
    e.stopPropagation();
    onSelect(i);
  };
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No data.</p>;
  }

  // 2-unit surface gap between segments, only when there is more than one.
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 1.6 : 0;
  let offset = 0;
  const arcs = slices.map((s, i) => {
    const len = (s.value / total) * C;
    const arc = {
      i,
      dash: Math.max(0, len - gap),
      offset: -offset,
      color: s.color ?? SERIES[i % SERIES.length],
    };
    offset += len;
    return arc;
  });

  const focus = active != null ? slices[active] : null;
  const pct = (v: number) => {
    const p = (v / total) * 100;
    return p < 10 ? p.toFixed(1) : Math.round(p).toString();
  };

  return (
    <div className="flex flex-col items-center gap-5 p-4 sm:flex-row sm:items-center">
      <div className={"relative shrink-0 " + (size === "lg" ? "h-56 w-56" : "h-40 w-40")}>
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={slices
            .map((s) => `${formatLabel(s.label)} ${s.value} (${pct(s.value)}%)`)
            .join(", ")}
        >
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={STROKE}
          />
          {arcs.map((a) => (
            <circle
              key={a.i}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={active === a.i ? STROKE + 4 : STROKE}
              strokeDasharray={`${a.dash} ${C}`}
              strokeDashoffset={a.offset}
              opacity={active == null || active === a.i ? 1 : 0.35}
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHover(a.i)}
              onMouseLeave={() => setHover(null)}
              onClick={pick(a.i)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={"font-display font-extrabold " + (size === "lg" ? "text-3xl" : "text-2xl") + " tabular-nums text-slate-900"}>
            {focus ? `${pct(focus.value)}%` : total.toLocaleString()}
          </span>
          <span className="max-w-[5.5rem] truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {focus ? formatLabel(focus.label) : centerLabel}
          </span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1">
        {slices.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={pick(i)}
            className={
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors " +
              (onSelect ? "cursor-pointer " : "") +
              (active === i ? "bg-slate-100" : "")
            }
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: arcs[i].color }}
            />
            <span className="min-w-0 flex-1 truncate font-medium capitalize text-slate-700">
              {formatLabel(s.label)}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-slate-500">
              {pct(s.value)}%
            </span>
            <span className="w-10 text-right font-display font-bold tabular-nums text-slate-900">
              {s.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface Column {
  /** Short axis label. */
  label: string;
  /** Longer label for the hover readout; defaults to `label`. */
  title?: string;
  value: number;
}

/**
 * Vertical columns on a shared baseline with a recessive grid, an optional
 * dashed average reference, and a per-column hover readout. The last column
 * can be emphasised to mark "the current period".
 */
export function ColumnChart({
  columns,
  color = "#486581",
  emphasisColor,
  showAverage = false,
  unit = "cases",
  height = 200,
  selected = null,
  onSelect,
}: {
  columns: Column[];
  color?: string;
  emphasisColor?: string;
  showAverage?: boolean;
  unit?: string;
  height?: number;
  /** Index held highlighted when nothing is hovered. */
  selected?: number | null;
  /** Makes columns clickable. */
  onSelect?: (index: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? selected;
  if (columns.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No data.</p>;
  }
  const rawMax = Math.max(1, ...columns.map((c) => c.value));
  const max = niceCeil(rawMax);
  const ticks = [0, max / 2, max];
  const avg = columns.reduce((s, c) => s + c.value, 0) / columns.length;

  return (
    <div className="p-4">
      <div className="flex gap-2">
        {/* y-axis */}
        <div
          className="relative w-7 shrink-0 font-mono text-[10px] tabular-nums text-slate-400"
          style={{ height }}
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0"
              style={{ bottom: `${(t / max) * 100}%`, transform: "translateY(50%)" }}
            >
              {Math.round(t).toLocaleString()}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1" style={{ height }}>
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden
              className={
                "absolute inset-x-0 border-t " +
                (t === 0 ? "border-slate-300" : "border-dashed border-slate-200")
              }
              style={{ bottom: `${(t / max) * 100}%` }}
            />
          ))}

          {showAverage && avg > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dotted border-vigil-500"
              style={{ bottom: `${(avg / max) * 100}%` }}
            >
              <span className="absolute -top-4 right-0 rounded bg-white/90 px-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-vigil-600">
                avg {avg.toFixed(1)}
              </span>
            </div>
          )}

          <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5">
            {columns.map((c, i) => {
              const isLast = i === columns.length - 1;
              const fill = emphasisColor && isLast ? emphasisColor : color;
              return (
                <div
                  key={c.label + i}
                  className={
                    "relative flex h-full min-w-0 flex-1 items-end justify-center " +
                    (onSelect ? "cursor-pointer" : "cursor-default")
                  }
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => {
                    if (!onSelect) return;
                    e.stopPropagation();
                    onSelect(i);
                  }}
                >
                  <div
                    className="w-full max-w-[44px] rounded-t-[4px] transition-opacity duration-150"
                    style={{
                      height: `${(c.value / max) * 100}%`,
                      minHeight: c.value > 0 ? 3 : 0,
                      background: fill,
                      opacity: active == null || active === i ? 1 : 0.45,
                    }}
                  />
                  {hover === i && (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute z-20 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lift"
                      style={{
                        bottom: `calc(${(c.value / max) * 100}% + 6px)`,
                        left: i > columns.length / 2 ? "auto" : 0,
                        right: i > columns.length / 2 ? 0 : "auto",
                      }}
                    >
                      <div className="font-medium text-slate-500">
                        {c.title ?? c.label}
                      </div>
                      <div className="font-display text-sm font-bold tabular-nums text-slate-900">
                        {c.value.toLocaleString()} {unit}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* x-axis */}
      <div className="ml-9 mt-1.5 flex gap-[3px] sm:gap-1.5">
        {columns.map((c, i) => (
          <span
            key={c.label + i}
            className={
              "min-w-0 flex-1 truncate text-center font-mono text-[10px] tabular-nums " +
              (active === i ? "font-semibold text-slate-800" : "text-slate-400")
            }
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function niceCeil(v: number) {
  if (v <= 4) return 4;
  // Even steps only, so the midpoint gridline lands on a whole number.
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const step of [2, 4, 6, 8, 10]) {
    if (step * mag >= v) return step * mag;
  }
  return 10 * mag;
}
