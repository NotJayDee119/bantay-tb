import { useEffect, useState } from "react";
import { Save, RotateCcw, Settings2 } from "lucide-react";
import { Button, Card, Input, PageHeader, Spinner } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import {
  HOTSPOT_DEFAULTS,
  clampHotspotSettings,
  loadHotspotSettings,
  saveHotspotSettings,
  type HotspotSettings,
} from "../../lib/hotspotSettings";
import { toast } from "sonner";

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

const SUBTITLE =
  "Configure the Moran's I and Getis-Ord Gi* hotspot detection job.";

export function SettingsPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<HotspotSettings | null>(null);
  const [draft, setDraft] = useState<HotspotSettings>(HOTSPOT_DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHotspotSettings().then((s) => {
      setSettings(s);
      setDraft(s);
    });
  }, []);

  async function save() {
    setSaving(true);
    const cleaned = clampHotspotSettings(draft);
    const { error } = await saveHotspotSettings(cleaned, profile?.id);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    setSettings(cleaned);
    setDraft(cleaned);
    toast.success("Hotspot settings updated");
  }

  function resetDefaults() {
    setDraft(HOTSPOT_DEFAULTS);
  }

  if (!settings) {
    return (
      <>
        <PageHeader title="Settings" subtitle={SUBTITLE} />
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      </>
    );
  }

  const dirty =
    draft.window_days !== settings.window_days ||
    draft.permutations !== settings.permutations;

  return (
    <>
      <PageHeader title="Settings" subtitle={SUBTITLE} />

      <Card className="max-w-2xl overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <Settings2 className="h-3.5 w-3.5 text-brand-600" />
            Spatial statistics · Moran&rsquo;s I + Gi*
          </div>
          {dirty && (
            <span className="inline-flex items-center rounded-full border border-vigil-400/50 bg-vigil-300/20 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-vigil-600">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="p-5">
          <p className="mb-5 text-xs leading-relaxed text-slate-500">
            Each run counts TB cases per barangay of residence over the last{" "}
            <ParamName>window_days</ParamName>, tests citywide clustering with
            Global Moran&rsquo;s I, then gives every barangay a Getis-Ord Gi*
            z-score using queen-contiguity neighbours. A barangay is a hotspot
            at z &ge; 1.96 (95%) or z &ge; 2.58 (99%). The confidence thresholds
            are fixed by the method and are not configurable.
          </p>

          <div className="space-y-5">
            <Field
              param="window_days"
              label="Lookback (days)"
              help="Cases reported in this many days are counted. 365 gives an annual rate, the usual basis for TB notification rates."
            >
              <Input
                type="number"
                step="1"
                min={30}
                max={1825}
                value={draft.window_days}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    window_days: Number(e.target.value),
                  }))
                }
              />
            </Field>

            <Field
              param="permutations"
              label="Moran's I permutations"
              help="Random reshuffles used for the pseudo p-value. 999 is the standard; more gives a finer p-value but a slower run."
            >
              <Input
                type="number"
                step="1"
                min={99}
                max={9999}
                value={draft.permutations}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    permutations: Number(e.target.value),
                  }))
                }
              />
            </Field>
          </div>

          <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4">
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? (
                <Spinner className="h-4 w-4 text-white" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
            <Button variant="secondary" onClick={resetDefaults} disabled={saving}>
              <RotateCcw className="h-4 w-4" /> Reset to defaults
            </Button>
          </div>
        </div>

        <p className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-slate-400">
          Defaults: window_days={HOTSPOT_DEFAULTS.window_days} · permutations=
          {HOTSPOT_DEFAULTS.permutations} — applied on the next detection run
        </p>
      </Card>
    </>
  );
}

function ParamName({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">
      {children}
    </code>
  );
}

function Field({
  param,
  label,
  help,
  children,
}: {
  param: string;
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-xs font-semibold text-brand-700">
          {param}
        </span>
        <span className="text-sm font-medium text-slate-800">{label}</span>
      </span>
      {children}
      {help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}
    </label>
  );
}
