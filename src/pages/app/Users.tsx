import { useEffect, useState } from "react";
import { Badge, Card, PageHeader, Spinner } from "../../components/ui";
import { supabase, ROLE_LABELS, type AppRole } from "../../lib/supabase";
import { formatDate } from "../../lib/utils";
import barangays from "../../data/barangays.json";

interface Row {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  barangay_psgc: number | null;
  created_at: string;
}

const ROLE_TONE: Record<AppRole, "info" | "success" | "warning" | "default"> = {
  tb_coordinator: "info",
  health_worker: "success",
  barangay_admin: "warning",
  patient: "default",
};

export function Users() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, email, full_name, role, barangay_psgc, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="System users, their roles, and barangay assignments."
      />
      <Card className="overflow-x-auto p-0">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Barangay</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {r.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.email}</td>
                  <td className="px-4 py-2">
                    <Badge tone={ROLE_TONE[r.role]}>{ROLE_LABELS[r.role]}</Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.barangay_psgc
                      ? barangays.find((b) => b.psgc === r.barangay_psgc)?.name ?? "—"
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {formatDate(r.created_at)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
