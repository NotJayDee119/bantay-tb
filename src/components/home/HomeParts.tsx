import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, type LucideIcon } from "lucide-react";
import { delay } from "../../lib/stagger";

/**
 * Building blocks shared by the staff home screens (health worker and TB
 * coordinator). Every number is paired with a sentence and a next step, so
 * the screens read without dashboard literacy.
 */

export interface Task {
  to: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip. */
  chip: string;
}

export function MainTask({ task, index }: { task: Task; index: number }) {
  const Icon = task.icon;
  return (
    <Link
      to={task.to}
      className="rise-in group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 active:translate-y-0 active:scale-[0.99]"
      style={delay(index)}
    >
      <span
        className={"grid h-12 w-12 place-items-center rounded-2xl shadow-soft " + task.chip}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div className="mt-4 font-display text-lg font-bold tracking-tight text-slate-900">
        {task.label}
      </div>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-600">
        {task.blurb}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
        Start
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export function SmallTask({ task, index }: { task: Task; index: number }) {
  const Icon = task.icon;
  return (
    <Link
      to={task.to}
      className="rise-in group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-soft transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 active:scale-[0.99]"
      style={delay(index)}
    >
      <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl " + task.chip}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900">
          {task.label}
        </div>
        <div className="truncate text-xs text-slate-500">{task.blurb}</div>
      </div>
    </Link>
  );
}

/* ── Attention cards ─────────────────────────────────────────────────── */

const TONES = {
  danger: {
    chip: "bg-red-50 text-red-600",
    num: "text-red-600",
    bar: "bg-red-500",
  },
  warning: {
    chip: "bg-amber-50 text-amber-600",
    num: "text-amber-600",
    bar: "bg-amber-500",
  },
  info: {
    chip: "bg-brand-50 text-brand-700",
    num: "text-brand-800",
    bar: "bg-brand-500",
  },
} as const;

export function AttentionCard({
  index,
  icon: Icon,
  tone,
  loading = false,
  count,
  one,
  many,
  sub,
  clear,
  action,
  to,
  onClick,
}: {
  index: number;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  loading?: boolean;
  count: number;
  one: string;
  many: string;
  sub: string;
  clear: string;
  action: string;
  to?: string;
  onClick?: () => void;
}) {
  const ok = !loading && count === 0;
  const t = TONES[tone];
  const body = (
    <>
      <span
        aria-hidden
        className={
          "absolute inset-x-0 top-0 h-1 transition-colors " +
          (ok ? "bg-emerald-400" : loading ? "bg-slate-200" : t.bar)
        }
      />
      <div className="flex items-center justify-between">
        <span
          className={
            "grid h-10 w-10 place-items-center rounded-xl " +
            (ok ? "bg-emerald-50 text-emerald-600" : t.chip)
          }
        >
          {ok ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </span>
        {ok && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            All clear
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-8 w-14 animate-pulse rounded-md bg-slate-100" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      ) : ok ? (
        <div className="mt-4">
          <div className="font-display text-lg font-bold text-slate-900">{clear}</div>
          <div className="text-sm text-slate-500">{sub}</div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className={"font-display text-4xl font-extrabold tabular-nums " + t.num}>
              {count.toLocaleString()}
            </span>
          </div>
          <div className="mt-0.5 font-semibold leading-snug text-slate-900">
            {count === 1 ? one : many}
          </div>
          <div className="text-sm text-slate-500">{sub}</div>
        </div>
      )}

      <span
        className={
          "mt-4 inline-flex items-center gap-1.5 text-sm font-semibold " +
          (ok ? "text-slate-500" : "text-brand-700")
        }
      >
        {ok ? "Open anyway" : action}
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
      </span>
    </>
  );
  const cls =
    "rise-in group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-soft transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 active:scale-[0.99]";
  return to ? (
    <Link to={to} className={cls} style={delay(index)}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} style={delay(index)}>
      {body}
    </button>
  );
}

export function SectionTitle({
  id,
  title,
  hint,
}: {
  id: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 id={id} className="font-display text-xl font-bold tracking-tight text-slate-900">
        {title}
      </h2>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function GlanceStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-1 font-display text-3xl font-extrabold tabular-nums tracking-tight text-slate-900">
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-slate-500">{sub}</div>
    </div>
  );
}
