import { useEffect, useState } from "react";
import { Save, RotateCcw } from "lucide-react";
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
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
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

      <Card className="max-w-2xl p-5">
        <div className="mb-4 text-sm font-semibold text-slate-900">
          Spatial clustering (DBSCAN)
        </div>
        <p className="mb-4 text-xs text-slate-500">
          The hotspot detection job groups recent TB cases into clusters using
          DBSCAN. Tighter <code>eps_km</code> or higher{" "}
          <code>min_pts</code> produce fewer / denser hotspots; a longer{" "}
          <code>window_days</code> aggregates more historical cases.
        </p>

        <div className="space-y-4">
          <Field
            label="eps_km — neighbour radius (km)"
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
            label="min_pts — minimum cluster size"
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
            label="window_days — lookback (days)"
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

        <div className="mt-6 flex items-center gap-2">
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button variant="secondary" onClick={resetDefaults} disabled={saving}>
            <RotateCcw className="h-4 w-4" /> Reset to defaults
          </Button>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Defaults: eps_km={DBSCAN_DEFAULTS.eps_km}, min_pts=
          {DBSCAN_DEFAULTS.min_pts}, window_days=
          {DBSCAN_DEFAULTS.window_days}. Changes apply on the next DBSCAN run
          (Hotspots → Re-run DBSCAN, or scheduled trigger).
        </p>
      </Card>
    </>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-800">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}
    </label>
  );
}
