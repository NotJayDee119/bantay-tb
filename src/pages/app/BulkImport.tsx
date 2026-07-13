import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, ShieldCheck, Map, Download, FileSpreadsheet, Trash2, AlertTriangle } from "lucide-react";
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

interface UploadedFile {
  name: string;
  created_at: string;
  metadata: { size?: number };
}

export function BulkImport() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [showReplaceWarning, setShowReplaceWarning] = useState(false);
  const [existingCount, setExistingCount] = useState(0);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);

  const loadUploadHistory = useCallback(async () => {
    if (!profile?.id) return;
    setUploadsLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("excel-imports")
        .list(profile.id, { sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      setUploads((data ?? []) as UploadedFile[]);
    } catch {
      // non-fatal
    } finally {
      setUploadsLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    void loadUploadHistory();
  }, [loadUploadHistory]);

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
    setImportedCount(null);
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

  async function promptReplace() {
    const { count } = await supabase
      .from("cases")
      .select("id", { count: "exact", head: true });
    setExistingCount(count ?? 0);
    setShowReplaceWarning(true);
  }

  async function handleConfirm() {
    if (!preview) return;
    setShowReplaceWarning(false);
    setConfirming(true);
    try {
      // Step 1: Delete all existing cases (replace-all strategy).
      const { error: deleteError } = await supabase
        .from("cases")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (deleteError) throw deleteError;

      // Step 2: Insert all mapped rows.
      const filePath = file?.name ?? null;
      const inserts = preview.inserts.map((r) => ({
        ...r,
        reported_by: profile?.id ?? null,
        source_file_path: filePath,
      }));
      const chunkSize = 500;
      for (let i = 0; i < inserts.length; i += chunkSize) {
        const { error } = await supabase
          .from("cases")
          .insert(inserts.slice(i, i + chunkSize));
        if (error) throw error;
      }

      // Step 3: Upload original file to storage for audit trail.
      if (file && profile?.id) {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const path = `${profile.id}/${ts}_${file.name}`;
        const { error: storageErr } = await supabase.storage
          .from("excel-imports")
          .upload(path, file, { upsert: false });
        if (storageErr) {
          console.warn("Storage upload failed (non-fatal):", storageErr);
        }
      }

      // Step 4: Trigger DBSCAN re-execution server-side.
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

      setImportedCount(inserts.length);
      setFile(null);
      setPreview(null);
      void loadUploadHistory();
      toast.success(
        `Replaced all cases with ${inserts.length} new rows. Hotspot detection re-running.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Import failed: ${message}`);
    } finally {
      setConfirming(false);
    }
  }

  async function handleDownload(fileName: string) {
    if (!profile?.id) return;
    const { data, error } = await supabase.storage
      .from("excel-imports")
      .download(`${profile.id}/${fileName}`);
    if (error) {
      toast.error("Download failed.");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/^\d{4}-\d{2}-\d{2}T[\d-]+_/, "");
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(fileName: string) {
    if (!profile?.id) return;
    const { error } = await supabase.storage
      .from("excel-imports")
      .remove([`${profile.id}/${fileName}`]);
    if (error) {
      toast.error("Delete failed.");
      return;
    }
    toast.success("File deleted.");
    setUploads((prev) => prev.filter((u) => u.name !== fileName));
  }

  function formatFileSize(bytes?: number) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function displayName(raw: string) {
    return raw.replace(/^\d{4}-\d{2}-\d{2}T[\d-]+_/, "");
  }

  return (
    <>
      <PageHeader
        title="Bulk Excel Import"
        subtitle="Upload monthly CHO TB reports. PII is stripped client-side before any data is sent to Supabase."
      />

      {/* ── Success banner after import ── */}
      {importedCount !== null && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-emerald-900">
                {importedCount} cases imported successfully
              </p>
              <p className="mt-0.5 text-sm text-emerald-700">
                Cases are now visible on the GIS map. Hotspot detection is
                re-running.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => navigate("/app/map")}
              >
                <Map className="h-4 w-4" />
                View on Map
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setImportedCount(null)}
              >
                Import more
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── File drop zone ── */}
      {importedCount === null && (
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
      )}

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
                These barangay names did not match Davao City:{" "}
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
          <Button onClick={promptReplace} disabled={confirming}>
            {confirming ? (
              <Spinner className="h-4 w-4 text-white" />
            ) : (
              `Import ${preview.inserts.length} cases`
            )}
          </Button>
        </div>
      )}

      {/* ── Replace-all confirmation dialog ── */}
      {showReplaceWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="mx-4 max-w-md p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Replace all existing cases?
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  This will permanently delete{" "}
                  <strong>{existingCount.toLocaleString()}</strong> existing
                  case(s) and replace them with{" "}
                  <strong>{preview?.inserts.length.toLocaleString()}</strong> new
                  rows from this file. This action cannot be undone.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowReplaceWarning(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleConfirm}
                  >
                    Replace All Cases
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Upload History ── */}
      <Card className="mt-8 p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Upload History
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Previously uploaded Excel/CSV files stored in Supabase
          </p>
        </div>
        {uploadsLoading ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        ) : uploads.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            No files uploaded yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {uploads.map((u) => (
              <li
                key={u.name}
                className="flex items-center gap-3 px-5 py-3"
              >
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {displayName(u.name)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(u.created_at).toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {formatFileSize(u.metadata?.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDownload(u.name)}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDelete(u.name)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
