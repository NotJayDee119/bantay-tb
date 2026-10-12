import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type Importer = () => Promise<{ default: ComponentType<any> }>;

/**
 * A `React.lazy` component that also exposes `.preload()` — call it to kick
 * off the chunk's dynamic import ahead of time (e.g. on nav-link hover) so
 * the module is already in the browser cache by the time the route mounts.
 * Repeated calls are cheap: the bundler/ESM layer caches the import promise,
 * so `preload()` after the chunk has loaded is effectively a no-op.
 */
export type PreloadableComponent = LazyExoticComponent<ComponentType<any>> & {
  preload: () => Promise<unknown>;
};

const RELOAD_KEY = "bantay:chunk-reload-at";
/** Don't reload again within this window — a second failure is a real outage. */
const RELOAD_COOLDOWN_MS = 30_000;

/**
 * Two ways a page chunk fails to load, and both used to leave a blank screen:
 *
 * - A deploy replaced the hashed chunk files. A tab opened before it still asks
 *   for the old names, and the hosting rewrite answers with index.html, which
 *   the browser refuses as a module.
 * - The connection dropped mid-download.
 *
 * One quick retry covers the dropped connection. If that fails too, reload the
 * page once: it fetches the current index.html and with it the current chunk
 * names. The cooldown stops a genuinely offline user from reload-looping; the
 * error then reaches the ErrorBoundary, which says what happened.
 */
function resilient(importer: Importer): Importer {
  return async () => {
    try {
      return await importer();
    } catch (first) {
      await new Promise((r) => setTimeout(r, 800));
      try {
        return await importer();
      } catch {
        let last = 0;
        try {
          last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        } catch {
          // Storage blocked — fall through and let the boundary handle it.
        }
        if (navigator.onLine && Date.now() - last > RELOAD_COOLDOWN_MS) {
          try {
            sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          } catch {
            // Without the flag the cooldown can't be enforced, so don't reload.
            throw first;
          }
          window.location.reload();
          // Hold the Suspense fallback on screen until the reload lands.
          return new Promise<never>(() => {});
        }
        throw first;
      }
    }
  };
}

export function lazyWithPreload(importer: Importer): PreloadableComponent {
  const Component = lazy(resilient(importer)) as PreloadableComponent;
  // A hover warm-up is best effort: a failure here must never reload the page
  // under the user. The real navigation goes through the resilient loader.
  Component.preload = () => importer().catch(() => undefined);
  return Component;
}
