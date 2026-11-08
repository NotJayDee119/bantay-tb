import { supabase } from "./supabase";

/** Settings for the Moran's I + Getis-Ord Gi* hotspot job (app_settings.hotspot_gi). */
export interface HotspotSettings {
  /** How many days of cases each run counts per barangay. */
  window_days: number;
  /** Random permutations for the Moran's I pseudo p-value. */
  permutations: number;
  /**
   * Count the synthetic demo rows (cases.source = 'synthetic_demo') in
   * detection. Off by default: the statistics then run on real recorded cases
   * only, so the Hotspots page reports the same Moran's I and Gi* as the
   * manuscript. Turn on to demo citywide hotspots.
   */
  include_demo: boolean;
}

/** cases.source value of the synthetic demo rows. */
export const DEMO_SOURCE = "synthetic_demo";

export const HOTSPOT_DEFAULTS: HotspotSettings = {
  window_days: 365,
  permutations: 999,
  include_demo: false,
};

const RANGES = {
  window_days: { min: 30, max: 1825 },
  permutations: { min: 99, max: 9999 },
};

export function clampHotspotSettings(s: Partial<HotspotSettings>): HotspotSettings {
  return {
    window_days: Math.round(
      clamp(
        Number(s.window_days ?? HOTSPOT_DEFAULTS.window_days),
        RANGES.window_days.min,
        RANGES.window_days.max
      )
    ),
    permutations: Math.round(
      clamp(
        Number(s.permutations ?? HOTSPOT_DEFAULTS.permutations),
        RANGES.permutations.min,
        RANGES.permutations.max
      )
    ),
    include_demo: s.include_demo === true,
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export async function loadHotspotSettings(): Promise<HotspotSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "hotspot_gi")
    .maybeSingle();
  if (error || !data?.value) return HOTSPOT_DEFAULTS;
  return clampHotspotSettings(data.value as Partial<HotspotSettings>);
}

export async function saveHotspotSettings(
  s: HotspotSettings,
  userId: string | undefined
): Promise<{ error?: string }> {
  const payload = {
    key: "hotspot_gi",
    value: s as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  };
  const { error } = await supabase
    .from("app_settings")
    .upsert(payload, { onConflict: "key" });
  return error ? { error: error.message } : {};
}
