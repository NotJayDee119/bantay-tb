import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  ShieldCheck,
  Map,
  Download,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Columns3,
  History,
  Sigma,
  Table2,
} from "lucide-react";
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

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

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
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-soft">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-emerald-900">
                  {importedCount.toLocaleString()} cases imported successfully
                </p>
                <p className="mt-0.5 text-sm text-emerald-700">
                  Cases are now visible on the GIS map. Hotspot detection is
                  re-running.
                </p>
              </div>
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
        </div>
      )}

      {/* ── File drop zone ── */}
      {importedCount === null && (
        <Card className="p-6">
          <label
            htmlFor="file"
            className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50/60"
          >
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-soft transition group-hover:border-brand-200 group-hover:text-brand-600">
              <Upload className="h-6 w-6" />
            </span>
            <div>
              <div className="font-medium text-slate-900">
                {file ? file.name : "Drop or choose an Excel/CSV file"}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
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
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
              <ShieldCheck className="h-3.5 w-3.5 text-accent-600" />
              <span className={MICRO_LABEL}>PII stripped</span>
            </div>
            <div className="p-4">
              {preview.piiColumnsRemoved.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No PII columns detected in source file.
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {preview.piiColumnsRemoved.map((c) => (
                    <li key={c} className="text-slate-700">
                      <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                        {c}
                      </code>{" "}
                      — removed
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
              <Columns3 className="h-3.5 w-3.5 text-brand-600" />
              <span className={MICRO_LABEL}>Auto column mapping</span>
            </div>
            <ul className="space-y-1.5 p-4 text-sm">
              {preview.mappedColumns.map((c) => (
                <li
                  key={c.source}
                  className="flex items-center justify-between gap-2"
                >
                  <code className="truncate rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
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
          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
              <Sigma className="h-3.5 w-3.5 text-vigil-500" />
              <span className={MICRO_LABEL}>Summary</span>
            </div>
            <div className="p-4">
              <dl className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between">
                  <dt className="text-slate-500">Rows parsed</dt>
                  <dd className="font-display font-bold tabular-nums text-slate-900">
                    {preview.rawRowCount.toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-slate-500">Importable rows</dt>
                  <dd className="font-display font-bold tabular-nums text-emerald-700">
                    {preview.inserts.length.toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-slate-500">Unknown barangays</dt>
                  <dd className="font-display font-bold tabular-nums text-amber-700">
                    {preview.unknownBarangays.length.toLocaleString()}
                  </dd>
                </div>
              </dl>
              {preview.unknownBarangays.length > 0 && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  These barangay names did not match Davao City:{" "}
                  {preview.unknownBarangays.slice(0, 6).join(", ")}
                  {preview.unknownBarangays.length > 6 && "…"}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {preview && preview.preview.length > 0 && (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <Table2 className="h-3.5 w-3.5 text-brand-600" />
            <span className={MICRO_LABEL}>
              Preview — first 5 rows after de-identification
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/95">
                <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pl-5 pr-3 text-left font-semibold">#</th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Barangay
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Disease
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Class.
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">Age</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Sex</th>
                  <th className="py-2.5 pl-3 pr-5 text-left font-semibold">
                    Outcome
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {preview.preview.map((p) => (
                  <tr
                    key={p.rowIndex}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    <td className="py-3 pl-5 pr-3 tabular-nums text-slate-500">
                      {p.rowIndex}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {p.barangay}
                      {!p.barangay_psgc && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-700">
                          unmatched
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {p.disease}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {p.tb_classification ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                      {p.age ?? "—"}
                    </td>
                    <td className="px-3 py-3 capitalize text-slate-600">
                      {p.sex}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-slate-600">
                      {p.treatment_outcome.replace(/_/g, " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Replace all existing cases?
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
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
      <Card className="mt-8 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <History className="h-3.5 w-3.5 text-brand-600" />
            Upload history
          </div>
          {!uploadsLoading && uploads.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {uploads.length} file{uploads.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {uploadsLoading ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        ) : uploads.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <FileSpreadsheet className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              No files uploaded yet. Imported Excel/CSV files are archived here
              for audit.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {uploads.map((u) => (
              <li
                key={u.name}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                  <FileSpreadsheet className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {displayName(u.name)}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
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
                  aria-label={`Download ${displayName(u.name)}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDelete(u.name)}
                  title="Delete"
                  aria-label={`Delete ${displayName(u.name)}`}
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
