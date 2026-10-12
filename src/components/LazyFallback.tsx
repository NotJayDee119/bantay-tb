import { cn } from "../lib/utils";
import { Spinner } from "./ui";

/**
 * The one loading indicator the app uses while something is on its way: a
 * spinner centred in the space the content will fill, with a short label.
 *
 * It fades in after a brief delay (`.loading-delay` in index.css), so a page
 * that is already cached never flashes it.
 */
export function LoadingSpinner({
  label = "Loading…",
  tone = "light",
  className,
}: {
  label?: string;
  /** `dark` for spinners drawn over the site's navy panels. */
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "loading-delay flex flex-col items-center justify-center gap-3",
        className
      )}
    >
      <Spinner
        className={cn("h-8 w-8", tone === "dark" ? "text-accent-400" : "text-brand-600")}
      />
      <span
        className={cn(
          "text-sm font-medium",
          tone === "dark" ? "text-slate-300" : "text-slate-500"
        )}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Suspense fallback for lazy route chunks. Lives in each layout's in-content
 * Suspense boundary, so the header and sidebar stay put and only the page
 * area shows the spinner.
 *
 * A full viewport tall, so the public site's navy footer stays below the fold
 * while a page loads. Anything shorter let it ride up into view — even a
 * header-height allowance left a strip of it showing.
 */
export function LazyFallback() {
  return <LoadingSpinner className="min-h-screen" />;
}
