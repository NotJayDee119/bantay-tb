import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Shared patient-facing detail modal: a bottom sheet that slides up on phones
 * and a centered dialog on wider screens. Matches the Health Education page —
 * grab handle, sticky header with a big friendly icon, scrollable body, and an
 * optional sticky footer for the primary action. Backdrop tap + Escape close;
 * body scroll is locked while open.
 */
export function PatientSheet({
  open,
  onClose,
  icon,
  iconClass = "bg-sky-100 text-sky-700",
  title,
  subtitle,
  accentClass = "border-sky-200",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  icon?: ReactNode;
  iconClass?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  accentClass?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-sheet-title"
    >
      <div
        aria-hidden
        className="he-backdrop-in absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className={cn(
          "he-sheet-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border-2 border-b-0 bg-white shadow-lift sm:max-h-[88vh] sm:max-w-md sm:rounded-3xl sm:border-b-2",
          accentClass
        )}
      >
        {/* Grab handle (mobile affordance) */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Sticky header */}
        <div className="flex items-start gap-3 px-5 py-4">
          {icon && (
            <span
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
                iconClass
              )}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="patient-sheet-title"
              className="font-display text-lg font-extrabold leading-tight tracking-tight text-slate-900"
            >
              {title}
            </h2>
            {subtitle && (
              <div className="mt-0.5 text-sm font-medium text-slate-500">
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {children}
        </div>

        {footer && (
          <div className="border-t-2 border-slate-100 bg-slate-50/60 p-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
