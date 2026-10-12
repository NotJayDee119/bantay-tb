import type { CSSProperties } from "react";

/** Staggered entrance for `.rise-in` blocks: each one ~40ms after the last. */
export function delay(i: number): CSSProperties {
  return { animationDelay: `${i * 40}ms` };
}
