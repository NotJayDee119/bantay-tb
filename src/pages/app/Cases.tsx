import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  MapPin,
  Plus,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";
import {
  Badge,
  Card,
  Input,
  ListSkeleton,
  PageHeader,
  Select,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { formatDate } from "../../lib/utils";
import barangays from "../../data/barangays.json";

interface Row {
  id: string;
  reported_at: string;
  barangay_psgc: number;
  disease: string;
  tb_classification: string | null;
  age: number | null;
  sex: string;
  treatment_outcome: string;
  source: string;
}

const TONE: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  cured: "success",
  completed: "success",
  ongoing: "info",
  failed: "danger",
  died: "danger",
  lost_to_followup: "warning",
  not_evaluated: "default",
};

// Dot colors matching the Badge tones so the outcome reads without color alone.
const TONE_DOT: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  default: "bg-slate-400",
};

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

export function Cases() {
  const { profile } = useAuth();
  const canCreateCase =
    profile?.role === "tb_coordinator" || profile?.role === "barangay_admin";
  const assignedPsgc = profile?.barangay_psgc ?? null;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    barangay: "",
    disease: "all",
    search: "",
  });

  // Pre-select the assigned barangay for health_worker / barangay_admin once
  // the profile is available so they land on their area by default.
  useEffect(() => {
    if (
      (profile?.role === "health_worker" || profile?.role === "barangay_admin") &&
      profile.barangay_psgc
    ) {
      setFilter((f) => ({ ...f, barangay: String(profile.barangay_psgc) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    setLoading(true);
    let q = supabase
      .from("cases")
      .select(
        "id, reported_at, barangay_psgc, disease, tb_classification, age, sex, treatment_outcome, source"
      )
      .order("reported_at", { ascending: false })
      .limit(500);
    if (filter.barangay) q = q.eq("barangay_psgc", Number(filter.barangay));
    if (filter.disease !== "all")
      q = q.eq(
        "disease",
        filter.disease as "tb" | "pneumonia" | "covid19" | "asthma"
      );
    q.then(({ data }) => {
      setRows((data ?? []) as Row[]);
      setLoading(false);
    });
  }, [filter.barangay, filter.disease]);

  const filtered = rows.filter((r) => {
    if (!filter.search) return true;
    const s = filter.search.toLowerCase();
    return (
      r.disease.toLowerCase().includes(s) ||
      (r.tb_classification ?? "").toLowerCase().includes(s) ||
      r.treatment_outcome.toLowerCase().includes(s)
    );
  });

  const hasActiveFilter =
    Boolean(filter.barangay) || filter.disease !== "all" || Boolean(filter.search);

  return (
    <>
      <PageHeader
        title="Active Case Finding"
        subtitle="Encode and review TB and respiratory disease cases at the barangay level."
        actions={
          canCreateCase ? (
            <Link
              to="/app/cases/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" /> New case
            </Link>
          ) : null
        }
      />

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <Card className="mb-4 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <SlidersHorizontal className="h-3.5 w-3.5 text-brand-600" />
            Filters
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {filtered.length}
              {filtered.length !== rows.length && ` / ${rows.length}`}{" "}
              {filtered.length === 1 ? "case" : "cases"}
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                className="font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-700 transition hover:text-brand-900 hover:underline"
                onClick={() =>
                  setFilter({ barangay: "", disease: "all", search: "" })
                }
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Select
            value={filter.barangay}
            onChange={(e) => setFilter({ ...filter, barangay: e.target.value })}
            aria-label="Filter by barangay"
          >
            <option value="">All barangays</option>
            {barangays.map((b) => (
              <option key={b.psgc} value={b.psgc}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            value={filter.disease}
            onChange={(e) => setFilter({ ...filter, disease: e.target.value })}
            aria-label="Filter by disease"
          >
            <option value="all">All diseases</option>
            <option value="tb">Tuberculosis</option>
            <option value="pneumonia">Pneumonia</option>
            <option value="covid19">COVID-19</option>
            <option value="asthma">Asthma</option>
          </Select>
          <Input
            placeholder="Search classification, outcome…"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            aria-label="Search cases"
          />
        </div>
      </Card>

      {/* ── Case register ────────────────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <ClipboardList className="h-3.5 w-3.5 text-accent-600" />
            Case register
          </div>
          {!loading && filtered.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              latest 500 · newest first
            </span>
          )}
        </div>

        {loading ? (
          <ListSkeleton rows={8} />
        ) : filtered.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <SearchX className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              No cases match your filters.
              {canCreateCase && " Try changing the filters, or encode a new case."}
            </p>
            {canCreateCase && (
              <Link
                to="/app/cases/new"
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" /> New case
              </Link>
            )}
          </div>
        ) : (
          <div className="max-h-[38rem] overflow-x-auto overflow-y-auto overscroll-contain">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pl-5 pr-3 text-left font-semibold">
                    Reported
                  </th>
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
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Outcome
                  </th>
                  <th className="py-2.5 pl-3 pr-5 text-left font-semibold">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((r) => {
                  const isAssigned =
                    assignedPsgc !== null && r.barangay_psgc === assignedPsgc;
                  const tone = TONE[r.treatment_outcome] ?? "default";
                  return (
                    <tr
                      key={r.id}
                      className={
                        "transition-colors " +
                        (isAssigned
                          ? "bg-brand-50/60 hover:bg-brand-50"
                          : "hover:bg-slate-50/70")
                      }
                    >
                      <td className="whitespace-nowrap py-3 pl-5 pr-3 tabular-nums text-slate-600">
                        {formatDate(r.reported_at)}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900">
                        <span className="inline-flex items-center gap-1.5">
                          {barangays.find((b) => b.psgc === r.barangay_psgc)
                            ?.name ?? "—"}
                          {isAssigned && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-brand-200 bg-brand-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-brand-700">
                              <MapPin className="h-2.5 w-2.5" /> Your area
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                          {r.disease}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {r.tb_classification ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                        {r.age ?? "—"}
                      </td>
                      <td className="px-3 py-3 capitalize text-slate-600">
                        {r.sex}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={tone}>
                          <span
                            aria-hidden
                            className={
                              "mr-1.5 h-1.5 w-1.5 rounded-full " + TONE_DOT[tone]
                            }
                          />
                          {r.treatment_outcome.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3 pl-3 pr-5 text-xs text-slate-500">
                        {r.source}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
