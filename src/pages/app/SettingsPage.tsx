import { useEffect, useState } from "react";
import { Save, RotateCcw, Settings2 } from "lucide-react";
import { Button, Card, Input, PageHeader, Spinner } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import {
  DBSCAN_DEFAULTS,
  clampDbscan,
  loadDbscanSettings,
  saveDbscanSettings,
  type DbscanSettings,
} from "../../lib/dbscanSettings";
import { toast } from "sonner";

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

export function SettingsPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<DbscanSettings | null>(null);
  const [draft, setDraft] = useState<DbscanSettings>(DBSCAN_DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDbscanSettings().then((s) => {
      setSettings(s);
      setDraft(s);
    });
  }, []);

  async function save() {
    setSaving(true);
    const cleaned = clampDbscan(draft);
    const { error } = await saveDbscanSettings(cleaned, profile?.id);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    setSettings(cleaned);
    setDraft(cleaned);
    toast.success("DBSCAN thresholds updated");
  }

  function resetDefaults() {
    setDraft(DBSCAN_DEFAULTS);
  }

  if (!settings) {
    return (
      <>
        <PageHeader
          title="Settings"
          subtitle="Configure DBSCAN thresholds used by the hotspot detection job."
        />
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      </>
    );
  }

  const dirty =
    draft.eps_km !== settings.eps_km ||
    draft.min_pts !== settings.min_pts ||
    draft.window_days !== settings.window_days;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Configure DBSCAN thresholds used by the hotspot detection job."
      />

      <Card className="max-w-2xl overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <Settings2 className="h-3.5 w-3.5 text-brand-600" />
            Spatial clustering · DBSCAN
          </div>
          {dirty && (
            <span className="inline-flex items-center rounded-full border border-vigil-400/50 bg-vigil-300/20 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-vigil-600">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="p-5">
          <p className="mb-5 text-xs leading-relaxed text-slate-500">
            The hotspot detection job groups recent TB cases into clusters using
            DBSCAN. Tighter <ParamName>eps_km</ParamName> or higher{" "}
            <ParamName>min_pts</ParamName> produce fewer / denser hotspots; a
            longer <ParamName>window_days</ParamName> aggregates more historical
            cases.
          </p>

          <div className="space-y-5">
            <Field
              param="eps_km"
              label="Neighbour radius (km)"
              help="Two cases within this distance are considered neighbours. Typical: 0.8 – 2.0."
            >
              <Input
                type="number"
                step="0.1"
                min={0.1}
                max={10}
                value={draft.eps_km}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    eps_km: Number(e.target.value),
                  }))
                }
              />
            </Field>

            <Field
              param="min_pts"
              label="Minimum cluster size"
              help="Smallest number of cases that forms a cluster. Typical: 5 – 12."
            >
              <Input
                type="number"
                step="1"
                min={2}
                max={50}
                value={draft.min_pts}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    min_pts: Number(e.target.value),
                  }))
                }
              />
            </Field>

            <Field
              param="window_days"
              label="Lookback (days)"
              help="How far back to pull TB cases. Typical: 30 – 180."
            >
              <Input
                type="number"
                step="1"
                min={7}
                max={365}
                value={draft.window_days}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    window_days: Number(e.target.value),
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
          Defaults: eps_km={DBSCAN_DEFAULTS.eps_km} · min_pts=
          {DBSCAN_DEFAULTS.min_pts} · window_days=
          {DBSCAN_DEFAULTS.window_days} — applied on the next DBSCAN run
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
