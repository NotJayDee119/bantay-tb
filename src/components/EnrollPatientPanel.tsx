import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Hospital,
  Pencil,
  Printer,
  RefreshCw,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";
import { Badge, Button, Input, Label, ListSkeleton } from "./ui";
import { ClaimSlip } from "./ClaimSlip";
import { claimState, type EnrollmentStatus } from "../lib/enrollment";
import { supabase } from "../lib/supabase";
import barangays from "../data/barangays.json";
import { formatDate } from "../lib/utils";

/**
 * Enrollment — "the nurse just verifies and assigns".
 *
 * The panel opens over a case that already exists in the facility's register.
 * Everything identifying is shown read-only, straight off that record, with an
 * inline pencil for the one field that's usually wrong. The nurse confirms, and
 * `enroll_patient` marks the case enrolled and mints the claim slip in a single
 * transaction — which is the only way a patient account comes into existence.
 */

const MICRO =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

/** Why the case can't be enrolled, in words a nurse can act on. */
const BLOCKED_REASON: Record<string, string> = {
  not_found: "This case no longer exists.",
  already_enrolled: "This patient is already enrolled in treatment.",
  not_diagnosed:
    "This case is still presumptive. Record the diagnostic result before enrolling.",
  treatment_closed:
    "This case's treatment is already closed. Reopen it before enrolling.",
  name_missing:
    "This record has no patient name yet — add it below before enrolling.",
  out_of_scope: "This case isn't in your assigned area or facility.",
  not_authenticated: "Your session expired. Sign in again.",
};

export interface EnrollableCase {
  id: string;
  given_name: string | null;
  family_name: string | null;
  contact_phone: string | null;
  address: string | null;
  barangay_psgc: number;
  facility_id: string | null;
  patient_code: string | null;
  diagnosis_status: string | null;
  tb_site: string | null;
  age: number | null;
  sex: string;
  diagnosis_date: string | null;
  /** Set at enrollment; the panel switches to claim-code mode once it is. */
  enrolled_at: string | null;
  /** Set once the patient has claimed — after which no code is needed. */
  patient_profile_id: string | null;
}

interface Props {
  caseRow: EnrollableCase;
  onClose: () => void;
  /** Fired after a successful enrollment so the register can refresh. */
  onEnrolled: () => void;
}

export function EnrollPatientPanel({ caseRow, onClose, onEnrolled }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    given_name: caseRow.given_name ?? "",
    family_name: caseRow.family_name ?? "",
    contact_phone: caseRow.contact_phone ?? "",
    address: caseRow.address ?? "",
  });
  const [issued, setIssued] = useState<{
    code: string;
    expiresAt: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Close on Escape, like the other overlays in the app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  // Already enrolled but not yet claimed — the panel becomes a place to read
  // the outstanding slip back, or print a fresh one. The result screen shows a
  // code once, and slips get lost between the counter and home.
  const alreadyEnrolled = caseRow.enrolled_at !== null;

  const { data: openClaim, isPending: loadingClaim } = useQuery({
    queryKey: ["patient-claim", caseRow.id],
    enabled: alreadyEnrolled && !issued,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_claims")
        .select("code, expires_at, used_at, created_at")
        .eq("case_id", caseRow.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as {
        code: string;
        expires_at: string;
        used_at: string | null;
        created_at: string;
      } | null;
    },
  });

  const reissue = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_patient_claim", {
        p_case_id: caseRow.id,
      });
      if (error) throw error;
      return data as { code: string; expires_at: string };
    },
    onSuccess: (row) => {
      setIssued({ code: row.code, expiresAt: row.expires_at });
      queryClient.invalidateQueries({ queryKey: ["patient-claim", caseRow.id] });
      toast.success("New code issued — the old one no longer works.");
    },
    onError: (err: Error) =>
      toast.error(err.message || "Could not issue a new code"),
  });

  // The server owns eligibility; asking it here means the button and the
  // transaction can never disagree about who may be enrolled.
  const { data: eligibility, isPending: checkingEligibility } = useQuery({
    enabled: !alreadyEnrolled,
    queryKey: ["case-enrollable", caseRow.id, draft.given_name, draft.family_name],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("case_enrollable", {
        p_case_id: caseRow.id,
      });
      if (error) throw error;
      return (data?.[0] ?? null) as { ok: boolean; reason: string } | null;
    },
  });

  const saveField = useMutation({
    mutationFn: async (patch: Partial<typeof draft>) => {
      const { error } = await supabase
        .from("cases")
        .update(patch)
        .eq("id", caseRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["case-enrollable"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not save"),
  });

  const enroll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("enroll_patient", {
        p_case_id: caseRow.id,
      });
      if (error) throw error;
      return data?.[0] as {
        ok: boolean;
        reason: string;
        claim_code: string | null;
        expires_at: string | null;
      };
    },
    onSuccess: (result) => {
      if (!result?.ok) {
        toast.error(
          BLOCKED_REASON[result?.reason ?? ""] ?? "Could not enroll this patient."
        );
        return;
      }
      setIssued({
        code: result.claim_code ?? "",
        expiresAt: result.expires_at,
      });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      onEnrolled();
    },
    onError: (err: Error) => toast.error(err.message || "Could not enroll"),
  });

  const barangayName = useMemo(
    () =>
      barangays.find((b) => b.psgc === caseRow.barangay_psgc)?.name ?? "—",
    [caseRow.barangay_psgc]
  );
  const facilityName =
    (facilities ?? []).find((f) => f.id === caseRow.facility_id)?.name ?? null;

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed — read the code off the screen instead.");
    }
  }

  const blocked = eligibility && !eligibility.ok ? eligibility.reason : null;

  // A code just minted this session wins over whatever was on file; otherwise
  // fall back to the outstanding slip, but only while it is still usable.
  const existingUsable =
    openClaim && claimState(openClaim) === "active" ? openClaim : null;
  const currentCode = issued?.code ?? existingUsable?.code ?? null;
  const currentExpiry = issued?.expiresAt ?? existingUsable?.expires_at ?? null;
  const claimed =
    caseRow.patient_profile_id !== null || openClaim?.used_at != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enroll-title"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl bg-white shadow-lift sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className={"flex items-center gap-1.5 " + MICRO}>
              <ShieldCheck className="h-3.5 w-3.5 text-accent-600" />
              {issued || alreadyEnrolled ? "Enrolled" : "Verify and assign"}
            </div>
            <h2
              id="enroll-title"
              className="font-display mt-1 text-lg font-bold tracking-tight text-slate-900"
            >
              {issued
                ? "Give this code to the patient"
                : alreadyEnrolled
                  ? "Claim code"
                  : "Enroll in treatment"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {issued || alreadyEnrolled ? (
          /* ── The code: freshly minted, or read back later ──────────── */
          <div className="space-y-4 p-5">
            {issued ? (
              <div className="flex items-start gap-3 rounded-xl border border-accent-200 bg-accent-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
                <p className="text-sm leading-relaxed text-accent-900">
                  <strong className="font-semibold">
                    {draft.given_name} {draft.family_name}
                  </strong>{" "}
                  is enrolled. Their account is ready &mdash; they claim it with
                  the code below.
                </p>
              </div>
            ) : loadingClaim ? (
              <ListSkeleton rows={2} />
            ) : claimed ? (
              <div className="flex items-start gap-3 rounded-xl border border-accent-200 bg-accent-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
                <p className="text-sm leading-relaxed text-accent-900">
                  This patient has already claimed their account
                  {openClaim?.used_at
                    ? ` on ${formatDate(openClaim.used_at)}`
                    : ""}
                  . No code is needed &mdash; they sign in with the password they
                  chose.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm leading-relaxed text-amber-900">
                  {currentCode
                    ? "This patient hasn't claimed their account yet. Give them the code below, or issue a new one if the slip was lost."
                    : "There's no usable code for this patient. Issue one and print the slip."}
                </p>
              </div>
            )}

            {!claimed && currentCode && (
              <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5">
                <div className={"flex items-center gap-1.5 " + MICRO}>
                  <Ticket className="h-3.5 w-3.5 text-brand-600" />
                  Claim code
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-brand-200 bg-white px-3 py-3 text-center font-mono text-2xl font-bold tracking-[0.25em] text-brand-900">
                    {currentCode}
                  </code>
                  <Button
                    variant="secondary"
                    size="md"
                    aria-label="Copy claim code"
                    onClick={() => copyCode(currentCode)}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {currentExpiry && (
                  <p className="mt-3 text-xs text-brand-700">
                    Single use · expires {formatDate(currentExpiry)}
                  </p>
                )}
              </div>
            )}

            {!claimed && (
              <p className="text-xs leading-relaxed text-slate-500">
                Print the slip and hand it over. The patient enters the code at{" "}
                <span className="font-medium text-slate-700">/claim</span> and
                chooses their own password &mdash; you never set one for them.
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {!claimed && currentCode && (
                <Button
                  variant="secondary"
                  className="flex-1 gap-2"
                  onClick={() => setPrinting(true)}
                >
                  <Printer className="h-4 w-4" />
                  Print slip
                </Button>
              )}
              {!claimed && (
                <Button
                  variant={currentCode ? "ghost" : "primary"}
                  className="flex-1 gap-2"
                  loading={reissue.isPending}
                  onClick={() => reissue.mutate()}
                >
                  {!reissue.isPending && <RefreshCw className="h-4 w-4" />}
                  {currentCode ? "Issue new code" : "Issue a code"}
                </Button>
              )}
              <Button className="flex-1" onClick={onClose}>
                Done
              </Button>
            </div>

            {!claimed && currentCode && (
              <p className="text-[11px] leading-relaxed text-slate-400">
                Issuing a new code immediately cancels the old one, so a slip
                that turns up later can&rsquo;t be used.
              </p>
            )}
          </div>
        ) : (
          /* ── Verify ────────────────────────────────────────────────── */
          <div className="space-y-4 p-5">
            <p className="text-sm leading-relaxed text-slate-500">
              These details are already on the case. Read them back to the
              patient and correct anything that&rsquo;s wrong &mdash; there is
              nothing to re-enter.
            </p>

            <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              <VerifyRow
                label="Given name"
                value={draft.given_name}
                editing={editing === "given_name"}
                onEdit={() => setEditing("given_name")}
                onCancel={() => setEditing(null)}
                onSave={(v) => {
                  setDraft((d) => ({ ...d, given_name: v }));
                  saveField.mutate({ given_name: v });
                }}
                saving={saveField.isPending}
              />
              <VerifyRow
                label="Family name"
                value={draft.family_name}
                editing={editing === "family_name"}
                onEdit={() => setEditing("family_name")}
                onCancel={() => setEditing(null)}
                onSave={(v) => {
                  setDraft((d) => ({ ...d, family_name: v }));
                  saveField.mutate({ family_name: v });
                }}
                saving={saveField.isPending}
              />
              <StaticRow
                label="Age / Sex"
                value={
                  (caseRow.age != null ? `${caseRow.age} yrs` : "—") +
                  " · " +
                  caseRow.sex
                }
              />
              <StaticRow label="Barangay of residence" value={barangayName} />
              <VerifyRow
                label="Address"
                value={draft.address}
                editing={editing === "address"}
                onEdit={() => setEditing("address")}
                onCancel={() => setEditing(null)}
                onSave={(v) => {
                  setDraft((d) => ({ ...d, address: v }));
                  saveField.mutate({ address: v });
                }}
                saving={saveField.isPending}
              />
              <VerifyRow
                label="Contact number"
                value={draft.contact_phone}
                editing={editing === "contact_phone"}
                onEdit={() => setEditing("contact_phone")}
                onCancel={() => setEditing(null)}
                onSave={(v) => {
                  setDraft((d) => ({ ...d, contact_phone: v }));
                  saveField.mutate({ contact_phone: v });
                }}
                saving={saveField.isPending}
              />
              <StaticRow label="TB code" value={caseRow.patient_code ?? "—"} />
              <StaticRow
                label="Diagnosis"
                value={(caseRow.diagnosis_status ?? "—").replace(/_/g, " ")}
              />
              <StaticRow
                label="Site"
                value={(caseRow.tb_site ?? "—").replace(/_/g, " ")}
              />
              <StaticRow
                label="DOTS centre"
                value={facilityName ?? "No facility recorded"}
                icon={<Hospital className="h-3.5 w-3.5" />}
              />
            </dl>

            {blocked && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm leading-relaxed text-amber-900">
                  {BLOCKED_REASON[blocked] ?? "This case can't be enrolled yet."}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-xs leading-relaxed text-slate-500">
                Enrolling generates the patient&rsquo;s account and a single-use
                claim code. Their barangay and DOTS centre are taken from this
                record &mdash; the patient never enters them.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 gap-2"
                loading={enroll.isPending}
                disabled={checkingEligibility || !!blocked}
                onClick={() => enroll.mutate()}
              >
                {!enroll.isPending && <ShieldCheck className="h-4 w-4" />}
                Enroll patient
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mounted only while printing: it renders nothing on screen, prints
          itself, and unmounts once the print dialog closes. */}
      {printing && currentCode && (
        <ClaimSlip
          code={currentCode}
          patientName={`${draft.given_name} ${draft.family_name}`.trim()}
          facilityName={facilityName}
          expiresAt={currentExpiry}
          onDone={() => setPrinting(false)}
        />
      )}
    </div>
  );
}

/** A verified field: read-only until the pencil is tapped. */
function VerifyRow({
  label,
  value,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
}: {
  label: string;
  value: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (value: string) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value, editing]);

  if (editing) {
    return (
      <div className="space-y-2 bg-slate-50/70 px-4 py-3">
        <Label htmlFor={`verify-${label}`}>{label}</Label>
        <div className="flex gap-2">
          <Input
            id={`verify-${label}`}
            value={local}
            autoFocus
            onChange={(e) => setLocal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave(local.trim());
            }}
          />
          <Button size="sm" loading={saving} onClick={() => onSave(local.trim())}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <dt className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </dt>
        <dd
          className={
            "truncate text-sm " +
            (value ? "font-medium text-slate-900" : "italic text-slate-400")
          }
        >
          {value || "Not recorded"}
        </dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${label}`}
        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Clinical facts the enrollment panel shows but doesn't edit. */
function StaticRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-2.5">
      <dt className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </dt>
      <dd className="truncate text-sm font-medium capitalize text-slate-900">
        {value}
      </dd>
    </div>
  );
}

/** The register's treatment-status chip. */
export function EnrollmentChip({ status }: { status: EnrollmentStatus }) {
  switch (status) {
    case "enrolled":
      return <Badge tone="success">Enrolled</Badge>;
    case "awaiting_diagnosis":
      return <Badge tone="warning">Awaiting diagnosis</Badge>;
    case "treatment_closed":
      return <Badge tone="default">Treatment closed</Badge>;
    default:
      return <Badge tone="default">Not enrolled</Badge>;
  }
}
