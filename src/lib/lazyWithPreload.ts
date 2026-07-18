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
  preload: Importer;
};

export function lazyWithPreload(importer: Importer): PreloadableComponent {
  const Component = lazy(importer) as PreloadableComponent;
  Component.preload = importer;
  return Component;
}
