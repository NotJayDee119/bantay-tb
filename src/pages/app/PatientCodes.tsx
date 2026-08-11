import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Copy,
  KeyRound,
  Printer,
  RefreshCw,
  Search,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  ListSkeleton,
  PageHeader,
} from "../../components/ui";
import { ClaimSlip } from "../../components/ClaimSlip";
import { supabase } from "../../lib/supabase";
import { useDebounce } from "../../hooks/useDebounce";
import { claimState } from "../../lib/enrollment";
import { formatDate } from "../../lib/utils";

/**
 * Claim codes, one row per patient.
 *
 * The code is generated at enrollment, but a health worker needs to reach it
 * again afterwards — slips get lost, and the enrollment panel only shows it
 * once. This is that place: who has a live code, who has already claimed, and
 * who needs a fresh slip printing.
 *
 * Deliberately scoped to patients who are *already enrolled*. A code with no
 * enrollment behind it would let someone hold an account with no treatment
 * record, so generating one is never an action on its own — enrolment mints
 * the first, and this page reissues.
 */

const MICRO =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

interface ClaimRow {
  code: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface PatientRow {
  id: string;
  given_name: string | null;
  family_name: string | null;
  patient_code: string | null;
  facility_id: string | null;
  enrolled_at: string | null;
  patient_profile_id: string | null;
  patient_claims: ClaimRow[];
}

type CodeStatus = "claimed" | "active" | "expired" | "none";

const STATUS_META: Record<
  CodeStatus,
  { label: string; tone: "success" | "info" | "warning" | "default" }
> = {
  claimed: { label: "Account claimed", tone: "success" },
  active: { label: "Code active", tone: "info" },
  expired: { label: "Code expired", tone: "warning" },
  none: { label: "No code", tone: "default" },
};

/** Newest claim first — reissues supersede, so only the latest matters. */
function latestClaim(row: PatientRow): ClaimRow | null {
  const sorted = [...(row.patient_claims ?? [])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return sorted[0] ?? null;
}

function statusOf(row: PatientRow): CodeStatus {
  if (row.patient_profile_id) return "claimed";
  const claim = latestClaim(row);
  if (!claim) return "none";
  if (claim.used_at) return "claimed";
  return claimState(claim) === "active" ? "active" : "expired";
}

export function PatientCodes() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useDebounce(search, 300);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [printing, setPrinting] = useState<{
    code: string;
    name: string;
    facilityName: string | null;
    expiresAt: string | null;
  } | null>(null);

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

  // RLS does the scoping: a health worker sees their own barangay's residents
  // plus their own facility's register, and nobody else's.
  const { data, isPending: loading } = useQuery({
    queryKey: ["patient-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "id, given_name, family_name, patient_code, facility_id, enrolled_at, patient_profile_id, patient_claims(code, expires_at, used_at, created_at)"
        )
        .not("enrolled_at", "is", null)
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PatientRow[];
    },
  });
  // Stable identity across renders — `data ?? []` would mint a fresh array
  // every time and re-run the filter below on every keystroke elsewhere.
  const rows = useMemo(() => data ?? [], [data]);

  const reissue = useMutation({
    mutationFn: async (caseId: string) => {
      const { data, error } = await supabase.rpc("create_patient_claim", {
        p_case_id: caseId,
      });
      if (error) throw error;
      return data as unknown as ClaimRow;
    },
    onSuccess: () => {
      toast.success("New code generated — the old one no longer works.");
      queryClient.invalidateQueries({ queryKey: ["patient-codes"] });
    },
    onError: (err: Error) =>
      toast.error(err.message || "Could not generate a code"),
  });

  const facilityName = (id: string | null) =>
    id ? ((facilities ?? []).find((f) => f.id === id)?.name ?? null) : null;

  const nameOf = (r: PatientRow) =>
    [r.given_name, r.family_name].filter(Boolean).join(" ") ||
    r.patient_code ||
    "Unnamed patient";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        nameOf(r).toLowerCase().includes(q) ||
        (r.patient_code ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  async function copyCode(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1600);
    } catch {
      toast.error("Copy failed — read the code off the screen instead.");
    }
  }

  const awaiting = rows.filter((r) => statusOf(r) !== "claimed").length;

  return (
    <>
      <PageHeader
        eyebrow="Patient onboarding"
        title="Patient Claim Codes"
        subtitle="Every enrolled patient gets a single-use code to claim their account. Print the slip and hand it over — they never sign up themselves. Lost slip? Generate a new code and the old one stops working immediately."
      />

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO}>
            <Ticket className="h-3.5 w-3.5 text-brand-600" />
            Enrolled patients
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {awaiting} awaiting claim · {rows.length} total
            </span>
            <div className="relative w-full max-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <label htmlFor="code-search" className="sr-only">
                Find a patient by name or TB code
              </label>
              <Input
                id="code-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a patient…"
                className="pl-9 pr-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <ListSkeleton rows={5} />
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400">
              <UserRound className="h-5 w-5" />
            </span>
            <p className="mt-2 text-sm font-medium text-slate-700">
              No enrolled patients yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              Codes are generated when you enrol a patient in treatment. Go to{" "}
              <span className="font-medium text-slate-700">Cases</span>, find a
              confirmed patient, and press{" "}
              <span className="font-medium text-slate-700">Enroll</span>.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            No patient matches “{search}”.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/95">
                <tr className={"text-left " + MICRO}>
                  <th className="py-2.5 pl-5 pr-3 font-semibold">Patient</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Code</th>
                  <th className="px-3 py-2.5 font-semibold">Expires</th>
                  <th className="py-2.5 pl-3 pr-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((r) => {
                  const status = statusOf(r);
                  const meta = STATUS_META[status];
                  const claim = latestClaim(r);
                  const showCode = status === "active" && claim;
                  return (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="py-3 pl-5 pr-3">
                        <div className="font-medium text-slate-900">
                          {nameOf(r)}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {r.patient_code ?? "No TB code"}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        {showCode ? (
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm font-bold tracking-wider text-slate-900">
                              {claim.code}
                            </code>
                            <button
                              type="button"
                              aria-label={`Copy code for ${nameOf(r)}`}
                              onClick={() => copyCode(claim.code, r.id)}
                              className="text-slate-400 transition hover:text-brand-600"
                            >
                              {copiedId === r.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                        {showCode ? (
                          <span className="tabular-nums">
                            {formatDate(claim.expires_at)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pl-3 pr-5">
                        {status === "claimed" ? (
                          <span className="text-xs text-slate-400">
                            No code needed
                          </span>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {showCode && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  setPrinting({
                                    code: claim.code,
                                    name: nameOf(r),
                                    facilityName: facilityName(r.facility_id),
                                    expiresAt: claim.expires_at,
                                  })
                                }
                              >
                                <Printer className="h-3.5 w-3.5" /> Print
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant={showCode ? "ghost" : "primary"}
                              loading={
                                reissue.isPending &&
                                reissue.variables === r.id
                              }
                              onClick={() => reissue.mutate(r.id)}
                            >
                              {!(
                                reissue.isPending && reissue.variables === r.id
                              ) &&
                                (showCode ? (
                                  <RefreshCw className="h-3.5 w-3.5" />
                                ) : (
                                  <KeyRound className="h-3.5 w-3.5" />
                                ))}
                              {showCode ? "New code" : "Generate"}
                            </Button>
                          </div>
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

      {printing && (
        <ClaimSlip
          code={printing.code}
          patientName={printing.name}
          facilityName={printing.facilityName}
          expiresAt={printing.expiresAt}
          onDone={() => setPrinting(null)}
        />
      )}
    </>
  );
}
