import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "../lib/utils";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
    size?: "sm" | "md" | "lg";
  }
>(function Button(
  { className, variant = "primary", size = "md", ...rest },
  ref
) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2";
  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-base",
  };
  const variants = {
    primary:
      "bg-brand-600 text-white shadow-soft hover:bg-brand-700 active:bg-brand-800",
    accent:
      "bg-accent-600 text-white shadow-soft hover:bg-accent-700 active:bg-accent-800",
    secondary:
      "bg-white border border-slate-200 text-slate-800 shadow-soft hover:bg-slate-50 hover:border-slate-300",
    ghost: "text-slate-700 hover:bg-slate-100",
    danger: "bg-red-600 text-white shadow-soft hover:bg-red-700",
  };
  return (
    <button
      ref={ref}
      className={cn(base, sizes[size], variants[variant], className)}
      {...rest}
    />
  );
});

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-soft transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60",
        className
      )}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[88px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-soft transition placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60",
        className
      )}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-soft transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-sm font-medium text-slate-700", className)}
    >
      {children}
    </label>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white shadow-soft transition-shadow",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Motion-aware Card: animates in on mount + lifts subtly on hover. Use this
 * for prominent surfaces (dashboard tiles, hero cards). Falls back to a static
 * `Card` for users who prefer reduced motion (motion/react respects this
 * automatically).
 */
export function MotionCard({
  className,
  children,
  delay = 0,
  ...rest
}: HTMLMotionProps<"div"> & { className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white shadow-soft transition-shadow hover:shadow-lift",
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info" | "accent";
  className?: string;
}) {
  const tones = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-700",
    info: "bg-sky-100 text-sky-700",
    accent: "bg-accent-100 text-accent-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin h-5 w-5 text-brand-600", className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        {eyebrow && (
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-brand-700">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="p-8 text-center">
      <div className="font-display text-base font-semibold text-slate-900">
        {title}
      </div>
      {description && (
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}
