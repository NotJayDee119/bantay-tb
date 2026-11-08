import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
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
  ConfirmDialog,
  Input,
  ListSkeleton,
  Modal,
  PageHeader,
  Select,
} from "../../components/ui";
import { supabase, ROLE_LABELS, type AppRole } from "../../lib/supabase";
import { readFunctionError } from "../../lib/functionError";
import { useAuth } from "../../hooks/useAuth";
import { useDebounce } from "../../hooks/useDebounce";
import { formatDate } from "../../lib/utils";
import barangays from "../../data/barangays.json";

interface Row {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  barangay_psgc: number | null;
  facility_id: string | null;
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

// Mirrors canReset() in supabase/functions/staff-password — the function is
// the real check; this only decides which rows show the button.
const COORDINATOR_CAN_RESET: AppRole[] = ["health_worker", "barangay_admin"];

interface IssuedPassword {
  name: string;
  email: string;
  password: string;
}

export function Users() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState({ role: "all", search: "" });
  const search = useDebounce(filter.search, 300);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    role: AppRole;
    barangay_psgc: number | null;
    facility_id: string | null;
  }>({ role: "patient", barangay_psgc: null, facility_id: null });
  const [error, setError] = useState<string | null>(null);

  const canEdit = profile?.role === "system_admin";
  const isCoordinator = profile?.role === "tb_coordinator";
  const showActions = canEdit || isCoordinator;
  const canResetRow = (r: Row) =>
    r.id !== profile?.id &&
    (canEdit || (isCoordinator && COORDINATOR_CAN_RESET.includes(r.role)));

  const [resetTarget, setResetTarget] = useState<Row | null>(null);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  const [copied, setCopied] = useState(false);
  const closeIssued = useCallback(() => setIssued(null), []);

  const resetMutation = useMutation({
    mutationFn: async (row: Row) => {
      const { data, error } = await supabase.functions.invoke("staff-password", {
        body: { action: "reset", user_id: row.id },
      });
      if (error) throw new Error(await readFunctionError(error));
      return { row, password: (data as { temporary_password: string }).temporary_password };
    },
    onSuccess: ({ row, password }) => {
      setResetTarget(null);
      setCopied(false);
      setIssued({ name: row.full_name || row.email, email: row.email, password });
    },
    onError: (err: Error) => {
      setResetTarget(null);
      toast.error(err.message || "Could not reset the password");
    },
  });

  async function copyIssued() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.password);
      setCopied(true);
    } catch {
      toast.error("Copy failed. Select the password and copy it by hand.");
    }
  }
  // Only a health centre account reads by facility (see areaScope.ts). The
  // column stays visible for everyone so the directory tells the whole story,
  // but it is only editable — and only meaningful — on that one role.
  const draftUsesFacility = draft.role === "health_worker";

  const { data, isPending: loading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, role, barangay_psgc, facility_id, created_at"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const rows = data ?? [];

  const { data: facilities } = useQuery({
    queryKey: ["dots-centers-ref"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dots_centers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
    staleTime: 60 * 60 * 1000,
  });
  const facilityName = (id: string | null) =>
    id ? ((facilities ?? []).find((f) => f.id === id)?.name ?? "—") : null;

  const saveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          role: draft.role,
          barangay_psgc: draft.barangay_psgc,
          // Clear the posting when the role no longer reads by facility, so a
          // demoted account can't keep a clinic's register on a stale column.
          facility_id: draftUsesFacility ? draft.facility_id : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error("Could not update user");
    },
  });
  const saving = saveMutation.isPending;

  function startEdit(row: Row) {
    setEditingId(row.id);
    setDraft({
      role: row.role,
      barangay_psgc: row.barangay_psgc,
      facility_id: row.facility_id,
    });
    setError(null);
  }

  function save(id: string) {
    if (
      (draft.role === "barangay_admin" || draft.role === "health_worker") &&
      draft.barangay_psgc == null
    ) {
      setError("Barangay admins and health workers must have an assigned area.");
      return;
    }
    setError(null);
    saveMutation.mutate(id);
  }

  const filtered = rows.filter((r) => {
    if (filter.role !== "all" && r.role !== filter.role) return false;
    if (!search) return true;
    const s = search.toLowerCase();
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
            ? "System users, their roles, and what each one can see: a barangay covers its residents, a health centre also covers its own facility's register. Click the pencil to reassign, or Reset password if someone is locked out."
            : isCoordinator
              ? "Staff accounts and their areas. If a health worker or barangay admin forgot their password, click Reset password and give them the temporary one. Contact the System Administrator to change a role, area, or facility."
              : "System users, their roles, and what each one can see: a barangay covers its residents, a health centre also covers its own facility's register. Contact the System Administrator to update a user's role, area, or facility."
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
                    DOTS facility
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Joined
                  </th>
                  {showActions && (
                    <th className="py-2.5 pl-3 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
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
                      <td className="px-3 py-3 text-slate-600">
                        {isEditing && draftUsesFacility ? (
                          <Select
                            value={draft.facility_id ?? ""}
                            aria-label="DOTS facility"
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                facility_id: e.target.value || null,
                              })
                            }
                          >
                            <option value="">— No facility —</option>
                            {(facilities ?? []).map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </Select>
                        ) : isEditing ? (
                          <span className="text-xs text-slate-400">
                            Not used by this role
                          </span>
                        ) : (
                          (facilityName(r.facility_id) ?? (
                            <span className="text-slate-400">—</span>
                          ))
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-500">
                        {formatDate(r.created_at)}
                      </td>
                      {showActions && (
                        <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right">
                          {!canEdit ? (
                            canResetRow(r) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setResetTarget(r)}
                              >
                                <KeyRound className="h-3.5 w-3.5" /> Reset password
                              </Button>
                            )
                          ) : isEditing ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => save(r.id)}
                                loading={saving}
                              >
                                {!saving && <Save className="h-3.5 w-3.5" />}
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
                            <div className="flex justify-end gap-1">
                              {canResetRow(r) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setResetTarget(r)}
                                >
                                  <KeyRound className="h-3.5 w-3.5" /> Reset password
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEdit(r)}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={showActions ? 7 : 6}
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

      <ConfirmDialog
        open={resetTarget !== null}
        title="Reset this password?"
        description={
          resetTarget && (
            <>
              <strong>{resetTarget.full_name || resetTarget.email}</strong>&apos;s
              current password will stop working right away. You&apos;ll get a
              temporary one to give them, and they must choose their own the
              next time they sign in.
            </>
          )
        }
        confirmLabel="Reset password"
        loading={resetMutation.isPending}
        onConfirm={() => resetTarget && resetMutation.mutate(resetTarget)}
        onCancel={() => setResetTarget(null)}
      />

      <Modal
        open={issued !== null}
        title="Temporary password"
        icon={<KeyRound className="h-5 w-5" />}
        description={issued ? `For ${issued.name}` : undefined}
        onClose={closeIssued}
        footer={
          <Button variant="primary" size="sm" onClick={closeIssued}>
            Done
          </Button>
        }
      >
        {issued && (
          <div className="space-y-4 px-5 py-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <code className="flex-1 select-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center font-mono text-lg font-semibold tracking-wide text-slate-900">
                {issued.password}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void copyIssued()}
                aria-label="Copy temporary password"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p>
              Give this to {issued.name} in person or by text. They sign in
              with <span className="font-medium text-slate-800">{issued.email}</span>{" "}
              and this password, then choose a new one.
            </p>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              It&apos;s shown only once. If you close this before passing it on,
              reset the password again.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
