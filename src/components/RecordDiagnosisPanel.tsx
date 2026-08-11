import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, ShieldCheck, X, XCircle } from "lucide-react";
import { Button, Label, Select } from "./ui";
import { supabase } from "../lib/supabase";

/**
 * Gate 2 — the diagnostic result comes back.
 *
 * A presumptive case is somebody with symptoms, waiting on sputum, GeneXpert
 * or an X-ray. This is where that wait ends, and it is the only way a case
 * leaves the presumptive bucket:
 *
 *   confirmed  → becomes a patient, treatment opens, enrollment unlocks
 *   ruled out  → closed as screening data, never gets an account
 *
 * Recording a confirmation also sets `treatment_outcome` to 'ongoing', because
 * `case_enrollable` requires it — a confirmed case still sitting at
 * 'not_evaluated' would look diagnosed but refuse to enrol, with nothing on
 * screen explaining why.
 */

const MICRO =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

export interface DiagnosableCase {
  id: string;
  given_name: string | null;
  family_name: string | null;
  patient_code: string | null;
  tb_site: string | null;
}

type Outcome =
  | "bacteriologically_confirmed"
  | "clinically_diagnosed"
  | "ruled_out";

export function RecordDiagnosisPanel({
  caseRow,
  onClose,
  onRecorded,
}: {
  caseRow: DiagnosableCase;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome>(
    "bacteriologically_confirmed"
  );
  const [site, setSite] = useState(caseRow.tb_site ?? "pulmonary");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ruledOut = outcome === "ruled_out";
  const name =
    [caseRow.given_name, caseRow.family_name].filter(Boolean).join(" ") ||
    caseRow.patient_code ||
    "this patient";

  const save = useMutation({
    mutationFn: async () => {
      const patch = ruledOut
        ? {
            // Kept as surveillance data — this person was screened, and that
            // is worth counting. They simply never become a patient.
            treatment_outcome: "not_evaluated" as const,
            diagnosis_status: "presumptive" as const,
            diagnosis_date: date,
            notes: `Ruled out on ${date}`,
          }
        : {
            diagnosis_status: outcome,
            tb_site: site as "pulmonary" | "extra_pulmonary",
            diagnosis_date: date,
            // Enrollment requires an open treatment; without this the case
            // reads as diagnosed but silently refuses to enrol.
            treatment_outcome: "ongoing" as const,
          };
      const { error } = await supabase
        .from("cases")
        .update(patch)
        .eq("id", caseRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        ruledOut
          ? "Recorded as ruled out — the case stays as screening data."
          : "Diagnosis recorded. This patient can now be enrolled in treatment."
      );
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      onRecorded();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Could not save"),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dx-title"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white shadow-lift sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <div className={"flex items-center gap-1.5 " + MICRO}>
              <FlaskConical className="h-3.5 w-3.5 text-brand-600" />
              Diagnostic result
            </div>
            <h2
              id="dx-title"
              className="font-display mt-1 text-lg font-bold tracking-tight text-slate-900"
            >
              Record result for {name}
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

        <div className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-slate-500">
            This patient was screened and is waiting on a result. Recording it
            is what moves them out of the presumptive list.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="dx-outcome">Result</Label>
            <Select
              id="dx-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as Outcome)}
            >
              <option value="bacteriologically_confirmed">
                TB confirmed — bacteriologically (sputum / GeneXpert)
              </option>
              <option value="clinically_diagnosed">
                TB confirmed — clinically diagnosed
              </option>
              <option value="ruled_out">TB ruled out</option>
            </Select>
          </div>

          {!ruledOut && (
            <div className="space-y-1.5">
              <Label htmlFor="dx-site">Site of disease</Label>
              <Select
                id="dx-site"
                value={site}
                onChange={(e) => setSite(e.target.value)}
              >
                <option value="pulmonary">Pulmonary</option>
                <option value="extra_pulmonary">Extra-pulmonary</option>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="dx-date">Result date</Label>
            <input
              id="dx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-soft transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>

          <div
            className={
              "flex items-start gap-2.5 rounded-xl border p-3.5 " +
              (ruledOut
                ? "border-slate-200 bg-slate-50"
                : "border-accent-200 bg-accent-50")
            }
          >
            {ruledOut ? (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            ) : (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
            )}
            <p
              className={
                "text-sm leading-relaxed " +
                (ruledOut ? "text-slate-600" : "text-accent-900")
              }
            >
              {ruledOut
                ? "The case stays on file as screening data. No account and no medication schedule are created."
                : "Treatment opens and the Enroll action becomes available — that is where the account and claim code are generated."}
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
              className="flex-1"
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              Save result
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
