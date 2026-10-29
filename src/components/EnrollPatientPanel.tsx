import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Hospital,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge, Button, Input, Label } from "./ui";
import type { EnrollmentStatus } from "../lib/enrollment";
import { supabase } from "../lib/supabase";
import barangays from "../data/barangays.json";

/**
 * Enrollment — "the nurse just verifies and assigns".
 *
 * The panel opens over a case that already exists in the facility's register.
 * Everything identifying is shown read-only, straight off that record, with an
 * inline pencil for the one field that's usually wrong. The nurse confirms, and
 * `enroll_patient` marks the case as started on treatment.
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
  enrolled_at: string | null;
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

  // The server owns eligibility; asking it here means the button and the
  // transaction can never disagree about who may be enrolled.
  const { data: eligibility, isPending: checkingEligibility } = useQuery({
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
      return data?.[0] as { ok: boolean; reason: string };
    },
    onSuccess: (result) => {
      if (!result?.ok) {
        toast.error(
          BLOCKED_REASON[result?.reason ?? ""] ?? "Could not enroll this patient."
        );
        return;
      }
      toast.success(
        `${draft.given_name} ${draft.family_name}`.trim() + " is now on treatment."
      );
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      onEnrolled();
      onClose();
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

  const blocked = eligibility && !eligibility.ok ? eligibility.reason : null;

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
              Verify and assign
            </div>
            <h2
              id="enroll-title"
              className="font-display mt-1 text-lg font-bold tracking-tight text-slate-900"
            >
              Start treatment
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

        {/* ── Verify ────────────────────────────────────────────────── */}
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
              Starting treatment marks this case as enrolled at its DOTS
              centre. The barangay and DOTS centre are taken from this
              record &mdash; nothing is re-entered.
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
              Start treatment
            </Button>
          </div>
        </div>
      </div>
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
