import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
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

export function Cases() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    barangay: "",
    disease: "all",
    search: "",
  });

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

  return (
    <>
      <PageHeader
        title="Active Case Finding"
        subtitle="Encode and review TB and respiratory disease cases at the barangay level."
        actions={
          <Link
            to="/app/cases/new"
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> New case
          </Link>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            value={filter.barangay}
            onChange={(e) => setFilter({ ...filter, barangay: e.target.value })}
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
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No cases match your filters"
          description="Try changing the filters above, or encode a new case."
          action={
            <Link
              to="/app/cases/new"
              className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> New case
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Reported</th>
                <th className="px-4 py-3">Barangay</th>
                <th className="px-4 py-3">Disease</th>
                <th className="px-4 py-3">Class.</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Sex</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-600">
                    {formatDate(r.reported_at)}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {barangays.find((b) => b.psgc === r.barangay_psgc)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2 uppercase">{r.disease}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.tb_classification ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.age ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600 capitalize">{r.sex}</td>
                  <td className="px-4 py-2">
                    <Badge tone={TONE[r.treatment_outcome] ?? "default"}>
                      {r.treatment_outcome.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
