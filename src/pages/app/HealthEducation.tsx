import { LearnPublic } from "../public/LearnPublic";
import { PageHeader } from "../../components/ui";

export function HealthEducation() {
  return (
    <>
      <PageHeader
        title="Health Education"
        subtitle="Patient-facing content on TB and respiratory diseases — Tagalog, Bisaya, and English."
      />
      <LearnPublic />
    </>
  );
}
