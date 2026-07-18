import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  Plus,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  ListSkeleton,
  PageHeader,
  Select,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useDebounce } from "../../hooks/useDebounce";
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

const PAGE_SIZE = 50;

const DISEASE_LABEL: Record<string, string> = {
  tb: "Tuberculosis",
  pneumonia: "Pneumonia",
  covid19: "COVID-19",
  asthma: "Asthma",
};

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
];

const AGE_BANDS = [
  { label: "0–17", min: 0, max: 17 },
  { label: "18–34", min: 18, max: 34 },
  { label: "35–54", min: 35, max: 54 },
  { label: "55+", min: 55, max: 200 },
];

interface FreqRow {
  disease: string;
  barangay_psgc: number;
  age: number | null;
  sex: string | null;
}

async function fetchFrequency(
  barangay: string,
  disease: string,
  days: number
): Promise<FreqRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  let q = supabase
    .from("cases")
    .select("disease, barangay_psgc, age, sex")
    .gte("reported_at", since.toISOString())
    .limit(20000);
  if (barangay) q = q.eq("barangay_psgc", Number(barangay));
  if (disease !== "all")
    q = q.eq("disease", disease as "tb" | "pneumonia" | "covid19" | "asthma");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FreqRow[];
}

function countBy(rows: FreqRow[], key: (r: FreqRow) => string | null) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (k == null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

async function fetchCasesPage(
  barangay: string,
  disease: string,
  page: number
): Promise<{ rows: Row[]; total: number }> {
  let q = supabase
    .from("cases")
    .select(
      "id, reported_at, barangay_psgc, disease, tb_classification, age, sex, treatment_outcome, source",
      { count: "exact" }
    )
    .order("reported_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (barangay) q = q.eq("barangay_psgc", Number(barangay));
  if (disease !== "all")
    q = q.eq("disease", disease as "tb" | "pneumonia" | "covid19" | "asthma");
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as Row[], total: count ?? 0 };
}

export function Cases() {
  const { profile } = useAuth();
  const canCreateCase =
    profile?.role === "tb_coordinator" || profile?.role === "barangay_admin";
  const assignedPsgc = profile?.barangay_psgc ?? null;
  const [page, setPage] = useState(0);
  const [period, setPeriod] = useState(30);
  const [filter, setFilter] = useState({
    barangay: "",
    disease: "all",
    search: "",
  });
  const search = useDebounce(filter.search, 300);

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

  // Server-side pagination — cached per filter+page so revisiting a page is
  // instant; keepPreviousData keeps the current rows on screen while the next
  // page loads instead of flashing a skeleton.
  const { data, isPending, isFetching } = useQuery({
    queryKey: ["cases", filter.barangay, filter.disease, page],
    queryFn: () => fetchCasesPage(filter.barangay, filter.disease, page),
    placeholderData: keepPreviousData,
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = isPending;

  // Frequency-of-cases summary for the Active Case Finding module: grouped
  // counts over a selectable period, following the barangay/disease filters.
  const { data: freqRows } = useQuery({
    queryKey: ["case-frequency", filter.barangay, filter.disease, period],
    queryFn: () => fetchFrequency(filter.barangay, filter.disease, period),
    placeholderData: keepPreviousData,
  });
  const byDisease = countBy(freqRows ?? [], (r) => DISEASE_LABEL[r.disease] ?? r.disease);
  const byBarangay = countBy(
    freqRows ?? [],
    (r) => barangays.find((b) => b.psgc === r.barangay_psgc)?.name ?? null
  ).slice(0, 5);
  const byAgeBand = countBy(freqRows ?? [], (r) => {
    if (r.age == null) return null;
    return AGE_BANDS.find((b) => r.age! >= b.min && r.age! <= b.max)?.label ?? null;
  });
  const bySex = countBy(freqRows ?? [], (r) => r.sex);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
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
              {total.toLocaleString()} {total === 1 ? "case" : "cases"}
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                className="font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-700 transition hover:text-brand-900 hover:underline"
                onClick={() => {
                  setFilter({ barangay: "", disease: "all", search: "" });
                  setPage(0);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Select
            value={filter.barangay}
            onChange={(e) => {
              setFilter({ ...filter, barangay: e.target.value });
              setPage(0);
            }}
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
            onChange={(e) => {
              setFilter({ ...filter, disease: e.target.value });
              setPage(0);
            }}
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

      {/* ── Frequency of cases ───────────────────────────────────────── */}
      <Card className="mb-4 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <BarChart3 className="h-3.5 w-3.5 text-brand-600" />
            Frequency of cases
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {(freqRows?.length ?? 0).toLocaleString()} total
            </span>
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              aria-label="Frequency period"
              className="h-7 rounded-md border border-slate-200 bg-white px-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
            >
              {PERIODS.map((p) => (
                <option key={p.days} value={p.days}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!freqRows ? (
          <ListSkeleton rows={3} />
        ) : freqRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No cases reported in this period.
          </p>
        ) : (
          <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <FreqGroup title="By disease" bars={byDisease} />
            <FreqGroup title="Top barangays" bars={byBarangay} />
            <FreqGroup title="By age group" bars={byAgeBand} />
            <FreqGroup title="By sex" bars={bySex} />
          </div>
        )}
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
              {isFetching && "updating · "}page {page + 1} of {pageCount} ·
              newest first
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

        {/* ── Pagination ─────────────────────────────────────────────── */}
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-2.5">
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {(page * PAGE_SIZE + 1).toLocaleString()}–
              {Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of{" "}
              {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0 || isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page + 1 >= pageCount || isFetching}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

function FreqGroup({
  title,
  bars,
}: {
  title: string;
  bars: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  return (
    <div>
      <div className={MICRO_LABEL}>{title}</div>
      {bars.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No data.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {bars.map((b) => (
            <li key={b.label}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium capitalize text-slate-700">
                  {b.label}
                </span>
                <span className="font-display font-bold tabular-nums text-slate-900">
                  {b.count.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.max(3, (b.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
