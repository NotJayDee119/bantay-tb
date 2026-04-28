import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
  Textarea,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import barangays from "../../data/barangays.json";

const DISEASES = [
  { value: "tb", label: "Tuberculosis" },
  { value: "pneumonia", label: "Pneumonia" },
  { value: "covid19", label: "COVID-19" },
  { value: "asthma", label: "Asthma" },
];

const TB_CLASS = [
  { value: "drug_sensitive", label: "Drug-sensitive" },
  { value: "drug_resistant", label: "Drug-resistant (MDR)" },
  { value: "pulmonary", label: "Pulmonary" },
  { value: "extra_pulmonary", label: "Extra-pulmonary" },
  { value: "presumptive", label: "Presumptive" },
];

const OUTCOMES = [
  { value: "ongoing", label: "Ongoing treatment" },
  { value: "cured", label: "Cured" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "died", label: "Died" },
  { value: "lost_to_followup", label: "Lost to follow-up" },
  { value: "not_evaluated", label: "Not evaluated" },
];

export function CaseFormPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    barangay_psgc: profile?.barangay_psgc ? String(profile.barangay_psgc) : "",
    disease: "tb",
    tb_classification: "presumptive",
    age: "",
    sex: "male",
    treatment_outcome: "ongoing",
    notes: "",
    reported_at: new Date().toISOString().slice(0, 10),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.barangay_psgc) {
      toast.error("Please select a barangay.");
      return;
    }
    setSubmitting(true);
    const bgy = barangays.find((b) => b.psgc === Number(form.barangay_psgc));
    if (!bgy) {
      toast.error("Barangay not found.");
      setSubmitting(false);
      return;
    }
    const angle = Math.random() * 2 * Math.PI;
    const r = 0.0008 + Math.random() * 0.002;
    const { error } = await supabase.from("cases").insert({
      barangay_psgc: bgy.psgc,
      disease: form.disease as "tb" | "pneumonia" | "covid19" | "asthma",
      tb_classification:
        form.disease === "tb"
          ? (form.tb_classification as
              | "drug_sensitive"
              | "drug_resistant"
              | "pulmonary"
              | "extra_pulmonary"
              | "presumptive")
          : null,
      age: form.age ? Number(form.age) : null,
      sex: form.sex as "male" | "female" | "other",
      treatment_outcome:
        form.treatment_outcome as
          | "ongoing"
          | "cured"
          | "completed"
          | "failed"
          | "died"
          | "lost_to_followup"
          | "not_evaluated",
      notes: form.notes || null,
      reported_at: new Date(form.reported_at).toISOString(),
      jitter_lat: bgy.lat + Math.sin(angle) * r,
      jitter_lon: bgy.lon + Math.cos(angle) * r,
      reported_by: profile?.id ?? null,
      source: "active_case_finding",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Case recorded");
    navigate("/app/cases");
  }

  return (
    <>
      <PageHeader
        title="Encode New Case"
        subtitle="Active Case Finding — barangay-level case registration."
      />
      <Card className="p-6">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="barangay">Barangay</Label>
            <Select
              id="barangay"
              required
              value={form.barangay_psgc}
              onChange={(e) =>
                setForm({ ...form, barangay_psgc: e.target.value })
              }
            >
              <option value="">— select barangay —</option>
              {barangays.map((b) => (
                <option key={b.psgc} value={b.psgc}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="disease">Disease</Label>
            <Select
              id="disease"
              value={form.disease}
              onChange={(e) => setForm({ ...form, disease: e.target.value })}
            >
              {DISEASES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reported_at">Reported on</Label>
            <Input
              id="reported_at"
              type="date"
              value={form.reported_at}
              onChange={(e) =>
                setForm({ ...form, reported_at: e.target.value })
              }
            />
          </div>
          {form.disease === "tb" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tb_class">TB Classification</Label>
              <Select
                id="tb_class"
                value={form.tb_classification}
                onChange={(e) =>
                  setForm({ ...form, tb_classification: e.target.value })
                }
              >
                {TB_CLASS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              min={0}
              max={120}
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sex">Sex</Label>
            <Select
              id="sex"
              value={form.sex}
              onChange={(e) => setForm({ ...form, sex: e.target.value })}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="outcome">Treatment outcome</Label>
            <Select
              id="outcome"
              value={form.treatment_outcome}
              onChange={(e) =>
                setForm({ ...form, treatment_outcome: e.target.value })
              }
            >
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes (no PII)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Clinical context only — do not enter patient names or addresses."
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save case"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
