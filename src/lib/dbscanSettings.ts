import { supabase } from "./supabase";

export interface DbscanSettings {
  eps_km: number;
  min_pts: number;
  window_days: number;
}

export const DBSCAN_DEFAULTS: DbscanSettings = {
  eps_km: 1.2,
  min_pts: 8,
  window_days: 90,
};

const RANGES = {
  eps_km: { min: 0.1, max: 10 },
  min_pts: { min: 2, max: 50 },
  window_days: { min: 7, max: 365 },
};

export function clampDbscan(s: Partial<DbscanSettings>): DbscanSettings {
  return {
    eps_km: clamp(
      Number(s.eps_km ?? DBSCAN_DEFAULTS.eps_km),
      RANGES.eps_km.min,
      RANGES.eps_km.max
    ),
    min_pts: Math.round(
      clamp(
        Number(s.min_pts ?? DBSCAN_DEFAULTS.min_pts),
        RANGES.min_pts.min,
        RANGES.min_pts.max
      )
    ),
    window_days: Math.round(
      clamp(
        Number(s.window_days ?? DBSCAN_DEFAULTS.window_days),
        RANGES.window_days.min,
        RANGES.window_days.max
      )
    ),
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export async function loadDbscanSettings(): Promise<DbscanSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "dbscan")
    .maybeSingle();
  if (error || !data?.value) return DBSCAN_DEFAULTS;
  return clampDbscan(data.value as Partial<DbscanSettings>);
}

export async function saveDbscanSettings(
  s: DbscanSettings,
  userId: string | undefined
): Promise<{ error?: string }> {
  const payload = {
    key: "dbscan",
    value: s as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
  };
  const { error } = await supabase
    .from("app_settings")
    .upsert(payload, { onConflict: "key" });
  return error ? { error: error.message } : {};
}
