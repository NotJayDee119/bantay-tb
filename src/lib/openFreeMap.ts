/** OpenFreeMap (https://openfreemap.org) vector styles, served free with no API key. */
export const OFM_STYLES = {
  positron: "https://tiles.openfreemap.org/styles/positron",
  bright: "https://tiles.openfreemap.org/styles/bright",
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export type OfmStyleName = keyof typeof OFM_STYLES;
