/** True on touch-first devices. Read once at mount: Leaflet's interaction
 *  handlers are fixed when the map is created, and a phone doesn't stop being
 *  a phone mid-visit. */
export function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse)").matches
  );
}
