import { useState } from "react";
import { Upload, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Spinner,
} from "../../components/ui";
import { parseImportFile, type ImportPreview } from "../../lib/excel";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";

export function BulkImport() {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleFile(f: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
      toast.error(
        "Unsupported file format. Upload an .xlsx, .xls, or .csv file."
      );
      return;
    }
    setFile(f);
    setLoading(true);
    setPreview(null);
    try {
      const p = await parseImportFile(f);
      setPreview(p);
      toast.success(
        `Parsed ${p.rawRowCount} rows. PII columns stripped: ${p.piiColumnsRemoved.length}.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Parse failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setConfirming(true);
    try {
      const inserts = preview.inserts.map((r) => ({
        ...r,
        reported_by: profile?.id ?? null,
      }));
      const chunkSize = 500;
      for (let i = 0; i < inserts.length; i += chunkSize) {
        const { error } = await supabase
          .from("cases")
          .insert(inserts.slice(i, i + chunkSize));
        if (error) throw error;
      }

      // Trigger DBSCAN re-execution server-side.
      try {
        const { error } = await supabase.functions.invoke("detect-hotspots", {
          body: { trigger: "bulk_import" },
        });
        if (error) {
           
          console.warn("detect-hotspots invoke failed (non-fatal):", error);
        }
      } catch (err) {
         
        console.warn("detect-hotspots invoke failed (non-fatal):", err);
      }

      toast.success(
        `Imported ${inserts.length} cases. Hotspot detection re-running.`
      );
      setFile(null);
      setPreview(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Import failed: ${message}`);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Bulk Excel Import"
        subtitle="Upload monthly CHO TB reports. PII is stripped client-side before any data is sent to Supabase."
      />

      <Card className="p-6">
        <label
          htmlFor="file"
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-brand-500 hover:bg-brand-50"
        >
          <Upload className="h-10 w-10 text-slate-400" />
          <div>
            <div className="font-medium text-slate-900">
              {file ? file.name : "Drop or choose an Excel/CSV file"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              .xlsx · .xls · .csv — max 10 MB recommended
            </div>
          </div>
          <input
            id="file"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </label>
      </Card>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <Spinner /> Parsing file and stripping PII…
        </div>
      )}

      {preview && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> PII stripped
            </div>
            {preview.piiColumnsRemoved.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No PII columns detected in source file.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {preview.piiColumnsRemoved.map((c) => (
                  <li key={c} className="text-slate-700">
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                      {c}
                    </code>{" "}
                    — removed
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <div className="text-sm font-semibold text-slate-900">
              Auto column mapping
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {preview.mappedColumns.map((c) => (
                <li
                  key={c.source}
                  className="flex items-center justify-between"
                >
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                    {c.source}
                  </code>
                  {c.target === "_unknown" ? (
                    <Badge>ignored</Badge>
                  ) : c.target === "_pii" ? (
                    <Badge tone="warning">PII (stripped)</Badge>
                  ) : (
                    <Badge tone="info">{c.target}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-semibold text-slate-900">Summary</div>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Rows parsed</dt>
                <dd className="font-semibold">{preview.rawRowCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Importable rows</dt>
                <dd className="font-semibold text-emerald-700">
                  {preview.inserts.length}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Unknown barangays</dt>
                <dd className="font-semibold text-amber-700">
                  {preview.unknownBarangays.length}
                </dd>
              </div>
            </dl>
            {preview.unknownBarangays.length > 0 && (
              <p className="mt-3 text-xs text-amber-700">
                These barangay names did not match Davao City: {" "}
                {preview.unknownBarangays.slice(0, 6).join(", ")}
                {preview.unknownBarangays.length > 6 && "…"}
              </p>
            )}
          </Card>
        </div>
      )}

      {preview && preview.preview.length > 0 && (
        <Card className="mt-6 overflow-x-auto p-0">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            Preview — first 5 rows after de-identification
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Barangay</th>
                <th className="px-3 py-2">Disease</th>
                <th className="px-3 py-2">Class.</th>
                <th className="px-3 py-2">Age</th>
                <th className="px-3 py-2">Sex</th>
                <th className="px-3 py-2">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {preview.preview.map((p) => (
                <tr key={p.rowIndex}>
                  <td className="px-3 py-2 text-slate-500">{p.rowIndex}</td>
                  <td className="px-3 py-2 font-medium">
                    {p.barangay}
                    {!p.barangay_psgc && (
                      <span className="ml-2 text-xs text-amber-600">
                        unmatched
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 uppercase">{p.disease}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {p.tb_classification ?? "—"}
                  </td>
                  <td className="px-3 py-2">{p.age ?? "—"}</td>
                  <td className="px-3 py-2 capitalize">{p.sex}</td>
                  <td className="px-3 py-2">
                    {p.treatment_outcome.replace(/_/g, " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {preview && preview.inserts.length > 0 && (
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setFile(null);
              setPreview(null);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={confirming}>
            {confirming ? (
              <Spinner className="h-4 w-4 text-white" />
            ) : (
              `Import ${preview.inserts.length} cases`
            )}
          </Button>
        </div>
      )}
    </>
  );
}
