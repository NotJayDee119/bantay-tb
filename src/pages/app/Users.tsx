import { useEffect, useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "../../components/ui";
import { supabase, ROLE_LABELS, type AppRole } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
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
  system_admin: "info",
  tb_coordinator: "info",
  health_worker: "success",
  barangay_admin: "warning",
  patient: "default",
};

const EDITABLE_ROLES: AppRole[] = [
  "system_admin",
  "tb_coordinator",
  "barangay_admin",
  "health_worker",
  "patient",
];

export function Users() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ role: "all", search: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    role: AppRole;
    barangay_psgc: number | null;
  }>({ role: "patient", barangay_psgc: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = profile?.role === "system_admin";

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, barangay_psgc, created_at")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(row: Row) {
    setEditingId(row.id);
    setDraft({ role: row.role, barangay_psgc: row.barangay_psgc });
    setError(null);
  }

  async function save(id: string) {
    if (
      (draft.role === "barangay_admin" || draft.role === "health_worker") &&
      draft.barangay_psgc == null
    ) {
      setError("Barangay admins and health workers must have an assigned area.");
      return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from("profiles")
      .update({
        role: draft.role,
        barangay_psgc: draft.barangay_psgc,
      })
      .eq("id", id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditingId(null);
    await load();
  }

  const filtered = rows.filter((r) => {
    if (filter.role !== "all" && r.role !== filter.role) return false;
    if (!filter.search) return true;
    const s = filter.search.toLowerCase();
    return (
      (r.full_name ?? "").toLowerCase().includes(s) ||
      r.email.toLowerCase().includes(s)
    );
  });

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={
          canEdit
            ? "System users, their roles, and barangay assignments. Click the pencil to reassign."
            : "System users, their roles, and barangay assignments."
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            value={filter.role}
            onChange={(e) => setFilter({ ...filter, role: e.target.value })}
          >
            <option value="all">All roles</option>
            {EDITABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Search by name or email…"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Showing {filtered.length} of {rows.length} users
        </div>
      </Card>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

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
                <th className="px-4 py-3">Assigned area</th>
                <th className="px-4 py-3">Joined</th>
                {canEdit && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((r) => {
                const isEditing = editingId === r.id;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {r.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{r.email}</td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <Select
                          value={draft.role}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              role: e.target.value as AppRole,
                            })
                          }
                        >
                          {EDITABLE_ROLES.map((opt) => (
                            <option key={opt} value={opt}>
                              {ROLE_LABELS[opt]}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge tone={ROLE_TONE[r.role]}>
                          {ROLE_LABELS[r.role]}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {isEditing ? (
                        <Select
                          value={draft.barangay_psgc?.toString() ?? ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              barangay_psgc: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        >
                          <option value="">— No area —</option>
                          {barangays.map((b) => (
                            <option key={b.psgc} value={b.psgc}>
                              {b.name}
                            </option>
                          ))}
                        </Select>
                      ) : r.barangay_psgc ? (
                        barangays.find((b) => b.psgc === r.barangay_psgc)
                          ?.name ?? "—"
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {formatDate(r.created_at)}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => save(r.id)}
                              disabled={saving}
                            >
                              <Save className="h-3.5 w-3.5" /> Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(null);
                                setError(null);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(r)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={canEdit ? 6 : 5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No users match your filters.
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
