import { useEffect, useState } from "react";
import {
  AlertCircle,
  Pencil,
  Save,
  SlidersHorizontal,
  Users as UsersIcon,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  ListSkeleton,
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

// Avatar tint per role — mirrors the Badge tones so the table scans by color.
const ROLE_AVATAR: Record<AppRole, string> = {
  system_admin: "bg-sky-100 text-sky-700",
  tb_coordinator: "bg-sky-100 text-sky-700",
  barangay_admin: "bg-amber-100 text-amber-800",
  health_worker: "bg-emerald-100 text-emerald-700",
  patient: "bg-slate-100 text-slate-500",
};

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

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

  const roleCounts = rows.reduce(
    (acc, r) => {
      acc[r.role] = (acc[r.role] ?? 0) + 1;
      return acc;
    },
    {} as Record<AppRole, number>
  );

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={
          canEdit
            ? "System users, their roles, and barangay assignments. Click the pencil to reassign."
            : "System users, their roles, and barangay assignments. Contact the System Administrator to update a user's role or area."
        }
      />

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <Card className="mb-4 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <SlidersHorizontal className="h-3.5 w-3.5 text-brand-600" />
            Filters
          </div>
          <span className="font-mono text-[10px] tabular-nums text-slate-500">
            {filtered.length} / {rows.length} users
          </span>
        </div>
        {/* Role quick-filters — click a chip to toggle that role */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-3">
          {EDITABLE_ROLES.map((r) => {
            const active = filter.role === r;
            const count = roleCounts[r] ?? 0;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setFilter({ ...filter, role: active ? "all" : r })
                }
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition " +
                  (active
                    ? "border-brand-600 bg-brand-600 text-white shadow-soft"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700")
                }
              >
                {ROLE_LABELS[r]}
                <span
                  className={
                    "tabular-nums " +
                    (active ? "text-brand-200" : "text-slate-400")
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Select
            value={filter.role}
            onChange={(e) => setFilter({ ...filter, role: e.target.value })}
            aria-label="Filter by role"
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
            aria-label="Search users"
          />
        </div>
      </Card>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Directory ────────────────────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <UsersIcon className="h-3.5 w-3.5 text-accent-600" />
            User directory
          </div>
        </div>
        {loading ? (
          <ListSkeleton rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/95">
                <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pl-5 pr-3 text-left font-semibold">
                    Name
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">Email</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Role</th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Assigned area
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Joined
                  </th>
                  {canEdit && <th className="py-2.5 pl-3 pr-5"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((r) => {
                  const isEditing = editingId === r.id;
                  const initial = (r.full_name ?? r.email)
                    .trim()
                    .charAt(0)
                    .toUpperCase();
                  return (
                    <tr
                      key={r.id}
                      className={
                        "transition-colors " +
                        (isEditing ? "bg-brand-50/60" : "hover:bg-slate-50/70")
                      }
                    >
                      <td className="py-3 pl-5 pr-3 font-medium text-slate-900">
                        <span className="flex items-center gap-2.5">
                          <span
                            aria-hidden
                            className={
                              "grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold " +
                              ROLE_AVATAR[r.role]
                            }
                          >
                            {initial || "?"}
                          </span>
                          {r.full_name ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{r.email}</td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <Select
                            value={draft.role}
                            aria-label="Role"
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
                      <td className="px-3 py-3 text-slate-600">
                        {isEditing ? (
                          <Select
                            value={draft.barangay_psgc?.toString() ?? ""}
                            aria-label="Assigned area"
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
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-500">
                        {formatDate(r.created_at)}
                      </td>
                      {canEdit && (
                        <td className="py-3 pl-3 pr-5 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => save(r.id)}
                                disabled={saving}
                              >
                                {saving ? (
                                  <Spinner className="h-3.5 w-3.5 text-white" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}{" "}
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label="Cancel editing"
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
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No users match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
