import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Clock,
  Copy,
  KeyRound,
  Plus,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Label,
  ListSkeleton,
  PageHeader,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { formatDateTime } from "../../lib/utils";

interface InviteRow {
  id: string;
  code: string;
  note: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

type InviteStatus = "active" | "used" | "expired";

function statusOf(row: InviteRow): InviteStatus {
  if (row.used_at) return "used";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}

const STATUS_META: Record<
  InviteStatus,
  { label: string; tone: "success" | "default" | "warning" }
> = {
  active: { label: "Active", tone: "success" },
  used: { label: "Used", tone: "default" },
  expired: { label: "Expired", tone: "warning" },
};

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

/** "in 23h 14m" / "in 12m" — how long an active code has left. */
function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

export function InviteCodes() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [justCreated, setJustCreated] = useState<InviteRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<InviteRow | null>(null);

  const { data, isPending: loading } = useQuery({
    queryKey: ["invite_codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("id, code, note, created_at, expires_at, used_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InviteRow[];
    },
  });
  const rows = data ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_invite_code", {
        p_note: note.trim() || null,
      });
      if (error) throw error;
      return data as unknown as InviteRow;
    },
    onSuccess: (row) => {
      setJustCreated(row);
      setNote("");
      toast.success("Invite code generated");
      queryClient.invalidateQueries({ queryKey: ["invite_codes"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not generate code"),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invite_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRevoking(null);
      toast.success("Invite code revoked");
      queryClient.invalidateQueries({ queryKey: ["invite_codes"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not revoke code"),
  });

  async function copyCode(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1600);
    } catch {
      toast.error("Copy failed — select and copy the code manually.");
    }
  }

  const activeCount = rows.filter((r) => statusOf(r) === "active").length;

  return (
    <>
      <PageHeader
        title="Invite Codes"
        eyebrow="Staff onboarding"
        subtitle="Generate a single-use code for a new staff member. Each code works once and expires 24 hours after it is created. Share it directly with the person — they enter it during staff registration, then pick their own role and assigned area."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* ── Generate ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className={"mb-4 flex items-center gap-1.5 " + MICRO_LABEL}>
              <Plus className="h-3.5 w-3.5 text-brand-600" />
              Generate a code
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="inv-note">
                  Note{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </Label>
                <Input
                  id="inv-note"
                  placeholder="e.g. Juan dela Cruz — BHW, Buhangin"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <p className="text-xs text-slate-400">
                  Just for your own reference — a reminder of who this code is
                  for.
                </p>
              </div>

              <Button
                className="w-full gap-2"
                onClick={() => createMutation.mutate()}
                loading={createMutation.isPending}
              >
                {!createMutation.isPending && <KeyRound className="h-4 w-4" />}
                Generate code
              </Button>
            </div>
          </Card>

          {/* Freshly-created code — shown once, prominently, to copy & share. */}
          {justCreated && (
            <Card className="border-brand-200 bg-brand-50/60 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
                  <Ticket className="h-3.5 w-3.5 text-brand-600" />
                  New code — share it now
                </div>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setJustCreated(null)}
                  className="text-slate-400 transition hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-brand-200 bg-white px-3 py-2.5 text-center font-mono text-xl font-bold tracking-[0.3em] text-brand-900">
                  {justCreated.code}
                </code>
                <Button
                  variant="secondary"
                  size="md"
                  aria-label="Copy code"
                  onClick={() => copyCode(justCreated.code, justCreated.id)}
                >
                  {copiedId === justCreated.id ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-brand-700">
                <Clock className="h-3.5 w-3.5" />
                Expires {formatDateTime(justCreated.expires_at)} · single use
              </p>
            </Card>
          )}
        </div>

        {/* ── History ─────────────────────────────────────────────────── */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
              <Ticket className="h-3.5 w-3.5 text-accent-600" />
              Issued codes
            </div>
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {activeCount} active · {rows.length} total
            </span>
          </div>

          {loading ? (
            <ListSkeleton rows={5} />
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              No invite codes yet. Generate one to onboard a staff member.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/95">
                  <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pl-5 pr-3 text-left font-semibold">
                      Code
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold">Note</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Status</th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      Expires
                    </th>
                    <th className="py-2.5 pl-3 pr-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((r) => {
                    const status = statusOf(r);
                    const meta = STATUS_META[status];
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                        <td className="py-3 pl-5 pr-3">
                          <div className="flex items-center gap-2">
                            <code
                              className={
                                "font-mono text-sm font-bold tracking-wider " +
                                (status === "active"
                                  ? "text-slate-900"
                                  : "text-slate-400 line-through")
                              }
                            >
                              {r.code}
                            </code>
                            {status === "active" && (
                              <button
                                type="button"
                                aria-label="Copy code"
                                onClick={() => copyCode(r.code, r.id)}
                                className="text-slate-400 transition hover:text-brand-600"
                              >
                                {copiedId === r.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {r.note ? (
                            <span className="block max-w-[18rem] truncate">
                              {r.note}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                          {status === "active" ? (
                            <span className="tabular-nums">
                              {timeLeft(r.expires_at)}
                            </span>
                          ) : status === "used" ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span className="tabular-nums text-slate-400">
                              {formatDateTime(r.expires_at)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right">
                          {status === "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setRevoking(r)}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Revoke
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!revoking}
        title="Revoke this invite code?"
        description={
          revoking
            ? `Code ${revoking.code} will stop working immediately. This can't be undone.`
            : undefined
        }
        confirmLabel="Revoke"
        loading={revokeMutation.isPending}
        onConfirm={() => revoking && revokeMutation.mutate(revoking.id)}
        onCancel={() => setRevoking(null)}
      />
    </>
  );
}
