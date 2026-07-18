/**
 * Suspense fallback for lazy route chunks — a thin progress bar pinned to
 * the top of the viewport (YouTube/GitHub style) instead of a centered
 * spinner. The CSS keyframe holds it invisible for the first ~150ms so
 * fast chunk loads never flash it, then sweeps it toward ~90% where it
 * parks until the chunk lands and the bar unmounts.
 *
 * Lives in each layout's in-content Suspense boundary, so a cold chunk
 * only shows this bar over a still-mounted header/sidebar — it never
 * replaces the whole app shell.
 */
export function LazyFallback() {
  return <div className="route-progress" aria-hidden />;
}
