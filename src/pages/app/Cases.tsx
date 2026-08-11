import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cross,
  ClipboardCheck,
  Database,
  HeartPulse,
  History,
  Lock,
  MapPin,
  Microscope,
  Plus,
  Radar,
  ScanSearch,
  Search,
  SearchX,
  ShieldAlert,
  SlidersHorizontal,
  Stethoscope,
  Ticket,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  ListSkeleton,
  PageHeader,
  Select,
  Skeleton,
} from "../../components/ui";
import {
  EnrollPatientPanel,
  EnrollmentChip,
} from "../../components/EnrollPatientPanel";
import { RecordDiagnosisPanel } from "../../components/RecordDiagnosisPanel";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useAreaScope } from "../../hooks/useAreaScope";
import { useDebounce } from "../../hooks/useDebounce";
import { cn, formatDate } from "../../lib/utils";
import { areaSuffix } from "../../lib/areaScope";
import { enrollmentState } from "../../lib/enrollment";
import barangays from "../../data/barangays.json";

interface Row {
  id: string;
  reported_at: string;
  barangay_psgc: number;
  /** DOTS facility providing treatment — null for legacy and presumptive rows. */
  facility_id: string | null;
  disease: string;
  tb_classification: string | null;
  tb_site: string | null;
  diagnosis_status: string | null;
  age: number | null;
  sex: string;
  treatment_outcome: string;
  source: string;
  /** Patient identity. PII — staff-only, and null on imported rows. */
  given_name: string | null;
  family_name: string | null;
  contact_phone: string | null;
  address: string | null;
  patient_code: string | null;
  diagnosis_date: string | null;
  /** Set once the patient has claimed the account enrollment generated. */
  patient_profile_id: string | null;
  enrolled_at: string | null;
}

const CASE_COLUMNS =
  "id, reported_at, barangay_psgc, facility_id, disease, tb_classification, tb_site, diagnosis_status, age, sex, treatment_outcome, source, given_name, family_name, contact_phone, address, patient_code, diagnosis_date, patient_profile_id, enrolled_at";

interface FacilityRef {
  id: string;
  name: string;
  barangay_psgc: number | null;
}

/** What the register needs to say about one row beyond its clinical fields. */
interface RowDescription {
  /** Why this row is in an area-scoped user's register; null for citywide. */
  relation: "area" | "clinic" | null;
  /** Treating DOTS facility, when one is on file. */
  facilityName: string | null;
}

/** Facilities are needed to explain *why* a case is in the register: it can
 *  be here because the patient lives in the user's barangay, or because the
 *  case was registered at a DOTS facility there. Cheap to fetch (two dozen
 *  rows) and world-readable, so it is loaded once and cached. */
async function fetchFacilities(): Promise<FacilityRef[]> {
  const { data, error } = await supabase
    .from("dots_centers")
    .select("id, name, barangay_psgc");
  if (error) throw error;
  return (data ?? []) as FacilityRef[];
}

const TONE: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  cured: "success",
  completed: "success",
  ongoing: "info",
  failed: "danger",
  died: "danger",
  lost_to_followup: "warning",
  not_evaluated: "default",
};

// Dot colors matching the Badge tones so the outcome reads without color alone.
const TONE_DOT: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  default: "bg-slate-400",
};

const MICRO_LABEL =
  "font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500";

const PAGE_SIZE = 50;

const DISEASE_LABEL: Record<string, string> = {
  tb: "Tuberculosis",
  pneumonia: "Pneumonia",
  covid19: "COVID-19",
  asthma: "Asthma",
};

const CLASS_LABEL: Record<string, string> = {
  drug_sensitive: "Drug-sensitive",
  drug_resistant: "Drug-resistant",
  pulmonary: "Pulmonary",
  extra_pulmonary: "Extra-pulmonary",
  presumptive: "Presumptive",
  unknown: "Unclassified",
};

const SITE_LABEL: Record<string, string> = {
  pulmonary: "Pulmonary",
  extra_pulmonary: "Extra-pulmonary",
};

const DX_LABEL: Record<string, string> = {
  presumptive: "Presumptive",
  clinically_diagnosed: "Clinically diagnosed",
  bacteriologically_confirmed: "Bacteriologically confirmed",
};

// Abbreviated for the register cell, where two columns share a half-width card.
const DX_SHORT: Record<string, string> = {
  presumptive: "Presumptive",
  clinically_diagnosed: "Clinical dx",
  bacteriologically_confirmed: "Bact. confirmed",
};

// Only these two values of the legacy column carry drug-susceptibility
// information; the rest are site or diagnosis facts that now live in their
// own columns.
const DRUG_LABEL: Record<string, string> = {
  drug_sensitive: "Drug-sensitive",
  drug_resistant: "Drug-resistant",
};

// How the record reached the register — for the case-finding column this is
// the difference between someone a health worker screened door-to-door and a
// row that arrived in a spreadsheet.
const SOURCE_LABEL: Record<string, string> = {
  active_case_finding: "Screened",
  bulk_import: "Bulk import",
  synthetic: "Synthetic",
};

// `short` labels the segmented period control; `label` stays the long form for
// the tooltip, the accessible name, and the breakdown card's caption.
// The short forms used to be "7d"/"12m". Abbreviations that terse are a
// developer's shorthand — spelled out they cost a little width and stop a
// health worker having to decode the control before using it.
const PERIODS = [
  { days: 7, short: "7 days", label: "Last 7 days" },
  { days: 30, short: "30 days", label: "Last 30 days" },
  { days: 90, short: "90 days", label: "Last 90 days" },
  { days: 365, short: "12 months", label: "Last 12 months" },
];

const AGE_BANDS = [
  { label: "0–17", min: 0, max: 17 },
  { label: "18–34", min: 18, max: 34 },
  { label: "35–54", min: 35, max: 54 },
  { label: "55+", min: 55, max: 200 },
];

// One accent per insight tile — the bar on the left edge and the icon chip are
// drawn from the same tone so the four tiles read as a set.
const TILE_TONE: Record<string, { bar: string; chip: string }> = {
  brand: { bar: "bg-brand-500", chip: "bg-brand-50 text-brand-700" },
  accent: { bar: "bg-accent-500", chip: "bg-accent-50 text-accent-700" },
  vigil: { bar: "bg-vigil-500", chip: "bg-amber-50 text-amber-700" },
  sky: { bar: "bg-sky-500", chip: "bg-sky-50 text-sky-700" },
};

interface FreqRow {
  disease: string;
  barangay_psgc: number;
  age: number | null;
  sex: string | null;
  tb_site: string | null;
  diagnosis_status: string | null;
  treatment_outcome: string;
}

async function fetchFrequency(
  barangay: string,
  disease: string,
  days: number
): Promise<FreqRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  let q = supabase
    .from("cases")
    .select(
      "disease, barangay_psgc, age, sex, tb_site, diagnosis_status, treatment_outcome"
    )
    .gte("reported_at", since.toISOString())
    .limit(20000);
  if (barangay) q = q.eq("barangay_psgc", Number(barangay));
  if (disease !== "all")
    q = q.eq("disease", disease as "tb" | "pneumonia" | "covid19" | "asthma");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FreqRow[];
}

function countBy(rows: FreqRow[], key: (r: FreqRow) => string | null) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (k == null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

/**
 * The two halves of the module read the same table but mean different things,
 * and the line between them is `diagnosis_status`:
 *
 * - `presumptive` — people found with TB symptoms during screening. They are
 *   not confirmed patients; they're the yield of active case finding and are
 *   waiting on diagnosis.
 * - `confirmed` — clinically diagnosed or bacteriologically confirmed.
 *   Restricted to `ongoing` treatment unless `includeClosed`, which is what
 *   makes them *active* cases rather than the whole history.
 */
type Bucket = "presumptive" | "confirmed";

async function fetchCasesPage(
  bucket: Bucket,
  barangay: string,
  disease: string,
  page: number,
  includeClosed: boolean
): Promise<{ rows: Row[]; total: number }> {
  let q = supabase
    .from("cases")
    .select(CASE_COLUMNS, { count: "exact" })
    .order("reported_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (barangay) q = q.eq("barangay_psgc", Number(barangay));
  if (disease !== "all")
    q = q.eq("disease", disease as "tb" | "pneumonia" | "covid19" | "asthma");
  if (bucket === "presumptive") {
    q = q.eq("diagnosis_status", "presumptive");
  } else {
    // Non-TB rows carry no diagnosis status at all, so the null case has to be
    // spelled out — a bare `neq` would drop them, since NULL <> 'presumptive'
    // evaluates to NULL rather than true.
    q = q.or("diagnosis_status.is.null,diagnosis_status.neq.presumptive");
    if (!includeClosed) q = q.eq("treatment_outcome", "ongoing");
  }
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as Row[], total: count ?? 0 };
}

export function Cases() {
  const { profile } = useAuth();
  const scope = useAreaScope();
  // Health workers record the patients who walk into their clinic — that is
  // where a case starts, and enrollment reads from the record they create.
  // Leaving them out meant a DOTS nurse had no way to register a walk-in.
  const canCreateCase =
    profile?.role === "tb_coordinator" ||
    profile?.role === "barangay_admin" ||
    profile?.role === "health_worker" ||
    profile?.role === "system_admin";
  // Enrollment assigns a facility and starts treatment, so it belongs to the
  // roles that actually run a DOTS register. A barangay_admin covers residents
  // for contact tracing — they can see enrollment status, not create it.
  const canEnroll =
    profile?.role === "health_worker" ||
    profile?.role === "tb_coordinator" ||
    profile?.role === "system_admin";
  const [enrolling, setEnrolling] = useState<Row | null>(null);
  const [diagnosing, setDiagnosing] = useState<Row | null>(null);
  const assignedPsgc = profile?.barangay_psgc ?? null;
  // The barangay filter is no longer pinned for area-scoped staff. It used to
  // be, on the reasoning that their assigned barangay was the only one RLS
  // would return — but a health centre also sees the cases its own facility
  // registered, and those patients live somewhere else. Pinning the filter to
  // the assigned barangay hid exactly those rows, so a Mintal worker got an
  // empty register while the map showed five patients at their own clinic.
  // RLS is the boundary; this select is just a filter.
  const pinnedBarangay = "";
  // Each column pages independently — working through the screening backlog
  // shouldn't move the treatment list out from under you.
  const [acfPage, setAcfPage] = useState(0);
  const [activePage, setActivePage] = useState(0);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [period, setPeriod] = useState(30);
  // Trends panel visibility — remembered across visits, so staff who only
  // work the registers aren't scrolling past the charts every time.
  const [trendsOpen, setTrendsOpen] = useState<boolean>(
    () => localStorage.getItem("bantay-cases-trends") !== "0"
  );
  const [filter, setFilter] = useState({
    barangay: "",
    disease: "all",
    search: "",
  });
  const search = useDebounce(filter.search, 300);

  useEffect(() => {
    localStorage.setItem("bantay-cases-trends", trendsOpen ? "1" : "0");
  }, [trendsOpen]);

  // Pin the barangay filter to the assigned area once the profile loads.
  useEffect(() => {
    if (!pinnedBarangay) return;
    setFilter((f) =>
      f.barangay === pinnedBarangay ? f : { ...f, barangay: pinnedBarangay }
    );
    setAcfPage(0);
    setActivePage(0);
  }, [pinnedBarangay]);

  // Server-side pagination — cached per filter+page so revisiting a page is
  // instant; keepPreviousData keeps the current rows on screen while the next
  // page loads instead of flashing a skeleton.
  const acf = useQuery({
    queryKey: ["cases", "presumptive", filter.barangay, filter.disease, acfPage],
    queryFn: () =>
      fetchCasesPage("presumptive", filter.barangay, filter.disease, acfPage, false),
    placeholderData: keepPreviousData,
  });
  const active = useQuery({
    queryKey: [
      "cases",
      "confirmed",
      filter.barangay,
      filter.disease,
      activePage,
      includeClosed,
    ],
    queryFn: () =>
      fetchCasesPage(
        "confirmed",
        filter.barangay,
        filter.disease,
        activePage,
        includeClosed
      ),
    placeholderData: keepPreviousData,
  });

  // Frequency-of-cases summary: grouped counts over a selectable period,
  // following the barangay/disease filters.
  const { data: freqRows } = useQuery({
    queryKey: ["case-frequency", filter.barangay, filter.disease, period],
    queryFn: () => fetchFrequency(filter.barangay, filter.disease, period),
    placeholderData: keepPreviousData,
  });

  const { data: facilities } = useQuery({
    queryKey: ["dots-centers-ref"],
    queryFn: fetchFacilities,
    staleTime: 60 * 60 * 1000,
  });
  const facilityById = useMemo(
    () => new Map((facilities ?? []).map((f) => [f.id, f])),
    [facilities]
  );

  /**
   * Where the patient lives versus where they were registered, plus why the
   * row is in this user's register at all.
   *
   * A health centre sees two kinds of row and the difference decides what they
   * do about it: a resident is theirs to trace, a case their own facility
   * registered is theirs to report on and dose. A barangay dashboard only ever
   * sees the first kind. Citywide staff get no tag — every row is theirs, so
   * tagging all of them says nothing.
   *
   * "Registered here" keys on facility identity, not on the facility's
   * barangay: the question is whether THIS clinic filed the case, and a
   * neighbouring clinic in the same barangay is somebody else's register.
   */
  const describeRow = useCallback(
    (r: Row): RowDescription => {
      const facility = r.facility_id
        ? (facilityById.get(r.facility_id) ?? null)
        : null;
      let relation: RowDescription["relation"] = null;
      if (scope.scoped) {
        if (scope.psgc !== null && r.barangay_psgc === scope.psgc)
          relation = "area";
        else if (scope.facilityId && r.facility_id === scope.facilityId)
          relation = "clinic";
      }
      return { relation, facilityName: facility?.name ?? null };
    },
    [facilityById, scope.scoped, scope.psgc, scope.facilityId]
  );
  const byDisease = countBy(freqRows ?? [], (r) => DISEASE_LABEL[r.disease] ?? r.disease);
  const bySite = countBy(freqRows ?? [], (r) =>
    r.tb_site ? (SITE_LABEL[r.tb_site] ?? r.tb_site) : null
  );
  const byDiagnosis = countBy(freqRows ?? [], (r) =>
    r.diagnosis_status ? (DX_LABEL[r.diagnosis_status] ?? r.diagnosis_status) : null
  );
  const byBarangay = countBy(
    freqRows ?? [],
    (r) => barangays.find((b) => b.psgc === r.barangay_psgc)?.name ?? null
  ).slice(0, 5);
  const byAgeBand = countBy(freqRows ?? [], (r) => {
    if (r.age == null) return null;
    return AGE_BANDS.find((b) => r.age! >= b.min && r.age! <= b.max)?.label ?? null;
  });
  const bySex = countBy(freqRows ?? [], (r) => r.sex);

  const periodLabel =
    PERIODS.find((p) => p.days === period)?.label ?? `Last ${period} days`;
  const freqTotal = freqRows?.length ?? 0;
  const presumptiveInPeriod = (freqRows ?? []).filter(
    (r) => r.diagnosis_status === "presumptive"
  ).length;
  const onTreatmentInPeriod = (freqRows ?? []).filter(
    (r) => r.diagnosis_status !== "presumptive" && r.treatment_outcome === "ongoing"
  ).length;
  const share = (n: number) =>
    freqTotal === 0 ? "—" : `${Math.round((n / freqTotal) * 100)}% of period`;
  const cases = (n: number) =>
    `${n.toLocaleString()} ${n === 1 ? "case" : "cases"}`;

  const matchesSearch = (r: Row) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.disease.toLowerCase().includes(s) ||
      (DISEASE_LABEL[r.disease] ?? "").toLowerCase().includes(s) ||
      (r.tb_classification ?? "").toLowerCase().includes(s) ||
      (CLASS_LABEL[r.tb_classification ?? ""] ?? "").toLowerCase().includes(s) ||
      (SITE_LABEL[r.tb_site ?? ""] ?? "").toLowerCase().includes(s) ||
      (DX_LABEL[r.diagnosis_status ?? ""] ?? "").toLowerCase().includes(s) ||
      r.treatment_outcome.toLowerCase().includes(s)
    );
  };

  // The pinned barangay isn't something the user chose, so it shouldn't make
  // "Clear" appear — only filters they can actually change count.
  const hasActiveFilter =
    filter.barangay !== pinnedBarangay ||
    filter.disease !== "all" ||
    Boolean(filter.search);

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Radar className="h-3.5 w-3.5" /> Surveillance
          </span>
        }
        title="Active Case Finding"
        subtitle={
          "Find people with TB symptoms before they present at a facility, and follow the confirmed cases already on treatment." +
          areaSuffix(
            scope,
            scope.facilityId
              ? (facilityById.get(scope.facilityId)?.name ?? null)
              : null
          )
        }
        actions={
          canCreateCase ? (
            <Link
              to="/app/cases/new"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-base font-semibold text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
            >
              <Plus className="h-5 w-5" /> Add new case
            </Link>
          ) : null
        }
      />

      {/* Fail-closed RLS means an unassigned account reads zero cases. Say so
          explicitly — otherwise the page just looks broken. */}
      {scope.unassigned && (
        <Card className="mb-4 flex items-start gap-3 border-amber-200 bg-amber-50 p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {scope.clinicScoped
                ? "No area or facility assigned to your account"
                : "No area assigned to your account"}
            </p>
            <p className="mt-0.5 text-sm text-amber-800">
              {scope.clinicScoped
                ? "Cases are visible for the barangay you cover and for the DOTS facility you are posted to. Ask a system administrator to assign at least one of them before encoding or reviewing cases."
                : "Cases are visible only for your assigned barangay. Ask a system administrator to assign your area before encoding or reviewing cases."}
            </p>
          </div>
        </Card>
      )}

      {/* ── Case trends ──────────────────────────────────────────────────
          Leads the page: period-scoped counts across both registers, so the
          screening yield and the treatment load can be read against each
          other before dropping into the row-by-row lists below. The barangay
          and disease filters underneath scope these figures too. */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTrendsOpen((o) => !o)}
            aria-expanded={trendsOpen}
            aria-controls="case-trends-panel"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-soft transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
          >
            <ChevronDown
              aria-hidden
              className={cn(
                "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                trendsOpen ? "rotate-0" : "-rotate-90"
              )}
            />
            <TrendingUp className="h-3.5 w-3.5 text-brand-600" />
            Case trends
            {/* Collapsed, the headline numbers still have to be readable —
                otherwise hiding the panel costs you the whole overview. */}
            {!trendsOpen && freqRows && (
              <span className="font-normal text-slate-500">
                · {presumptiveInPeriod.toLocaleString()} symptomatic ·{" "}
                {onTreatmentInPeriod.toLocaleString()} on treatment
              </span>
            )}
            {/* Was hover-only. A control whose label appears on hover doesn't
                exist on a tablet, which is what most of these workers carry. */}
            <span className="font-normal text-slate-500">
              ({trendsOpen ? "hide" : "show"})
            </span>
          </button>
          <ScopeChip
            icon={CalendarRange}
            title={`Counts only cases reported in the ${periodLabel.toLowerCase()}. The registers below list every record, whenever it was reported.`}
          >
            {periodLabel}
          </ScopeChip>
          </div>
          {/* Conditionally rendered, not `hidden` — Tailwind's inline-flex
              would override the attribute's display:none. */}
          {trendsOpen && (
          <div
            role="group"
            aria-label="Trend period"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-soft"
          >
            <CalendarRange
              aria-hidden
              className="ml-1 h-3.5 w-3.5 shrink-0 text-slate-400"
            />
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                title={p.label}
                aria-label={p.label}
                aria-pressed={period === p.days}
                onClick={() => setPeriod(p.days)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
                  period === p.days
                    ? "bg-brand-600 text-white shadow-soft"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {p.short}
              </button>
            ))}
          </div>
          )}
        </div>

        {trendsOpen && (
        <div id="case-trends-panel" className="space-y-4">
        {!freqRows ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[5.75rem] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InsightTile
              icon={ScanSearch}
              tone="brand"
              label="Symptomatic found"
              value={presumptiveInPeriod.toLocaleString()}
              footer={
                presumptiveInPeriod
                  ? `${share(presumptiveInPeriod)} · ${periodLabel.toLowerCase()}`
                  : `None found · ${periodLabel.toLowerCase()}`
              }
            />
            <InsightTile
              icon={HeartPulse}
              tone="accent"
              label="On treatment"
              value={onTreatmentInPeriod.toLocaleString()}
              footer={
                onTreatmentInPeriod
                  ? `${share(onTreatmentInPeriod)} · ${periodLabel.toLowerCase()}`
                  : `None on treatment · ${periodLabel.toLowerCase()}`
              }
            />
            <InsightTile
              icon={MapPin}
              tone="vigil"
              label={scope.scoped ? "Your area" : "Most affected area"}
              value={byBarangay[0]?.label ?? scope.name ?? "—"}
              footer={
                byBarangay[0]
                  ? `${cases(byBarangay[0].count)} · ${share(byBarangay[0].count)}`
                  : "No cases in this period"
              }
            />
            <InsightTile
              icon={Users}
              tone="sky"
              label="Largest age group"
              value={byAgeBand[0] ? `${byAgeBand[0].label} yrs` : "—"}
              footer={
                byAgeBand[0]
                  ? `${cases(byAgeBand[0].count)} · ${share(byAgeBand[0].count)}`
                  : "No ages recorded"
              }
            />
          </div>
        )}

        {/* ── Breakdown ─────────────────────────────────────────────────── */}
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
              <BarChart3 className="h-3.5 w-3.5 text-brand-600" />
              Breakdown
            </div>
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {freqTotal.toLocaleString()} · {periodLabel.toLowerCase()}
            </span>
          </div>
          {!freqRows ? (
            <ListSkeleton rows={3} />
          ) : freqRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No cases reported in this period.
            </p>
          ) : (
            <div className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <FreqGroup icon={Stethoscope} title="By disease" bars={byDisease} />
              <FreqGroup icon={Microscope} title="By site" bars={bySite} />
              <FreqGroup icon={ClipboardCheck} title="By diagnosis" bars={byDiagnosis} />
              <FreqGroup icon={MapPin} title="Top barangays" bars={byBarangay} />
              <FreqGroup icon={Users} title="By age group" bars={byAgeBand} />
              <FreqGroup icon={UserRound} title="By sex" bars={bySex} />
            </div>
          )}
        </Card>
        </div>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────
          One bar above both registers — barangay and disease scope everything
          on the page, the trends above included. */}
      <Card className="mb-4 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
            <SlidersHorizontal className="h-3.5 w-3.5 text-brand-600" />
            Filters
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-soft transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
              onClick={() => {
                setFilter({
                  barangay: pinnedBarangay,
                  disease: "all",
                  search: "",
                });
                setAcfPage(0);
                setActivePage(0);
              }}
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {scope.scoped ? (
            // Area-scoped staff cannot reach the whole city, so offering the
            // full list (or "All barangays") would promise rows RLS will never
            // return. The field states both halves of what they *can* see:
            // cases living in their barangay, plus cases registered at a
            // facility there — the second half is why this isn't a filter.
            <div
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm text-slate-600"
              title={
                scope.name
                  ? `Shows cases whose patients live in ${scope.name}, plus cases registered at a DOTS facility in ${scope.name} — even when those patients live in another barangay.`
                  : "Your account is limited to its assigned area"
              }
            >
              <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">
                {scope.name
                  ? `${scope.name} — residents + registered`
                  : "No area assigned"}
              </span>
            </div>
          ) : (
            <div className="relative">
              <MapPin
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <Select
                className="pl-9"
                value={filter.barangay}
                onChange={(e) => {
                  setFilter({ ...filter, barangay: e.target.value });
                  setAcfPage(0);
                  setActivePage(0);
                }}
                aria-label="Filter by barangay"
              >
                <option value="">All barangays</option>
                {barangays.map((b) => (
                  <option key={b.psgc} value={b.psgc}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="relative">
            <Stethoscope
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <Select
              className="pl-9"
              value={filter.disease}
              onChange={(e) => {
                setFilter({ ...filter, disease: e.target.value });
                setAcfPage(0);
                setActivePage(0);
              }}
              aria-label="Filter by disease"
            >
              <option value="all">All diseases</option>
              <option value="tb">Tuberculosis</option>
              <option value="pneumonia">Pneumonia</option>
              <option value="covid19">COVID-19</option>
              <option value="asthma">Asthma</option>
            </Select>
          </div>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <Input
              className="pl-9"
              placeholder="Search classification, outcome…"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              aria-label="Search cases"
            />
          </div>
        </div>
      </Card>

      {/* ── The two registers, side by side ──────────────────────────────
          Left is the screening yield — symptomatic people who are not
          confirmed patients yet. Right is the confirmed caseload under
          treatment. Both on screen at once: the whole point of case finding
          is watching one feed the other. */}
      {/* Stacked, at every width. The old `2xl:grid-cols-2` could never work:
          media queries measure the viewport, but this page renders inside the
          shell's `max-w-7xl` (1280px), so widening the monitor past 1536px
          bought the cards nothing. Two columns meant ~600px each for a table
          that needs ~800px, and the overflow landed on the last column — the
          "next step" button, the one thing a health worker opens this page to
          press. It sat off the right edge behind a horizontal scrollbar.
          Stacked, each register gets the full ~1216px and nothing is hidden.
          Reading the two against each other now costs a vertical scroll, which
          is the gesture people already use on this page. */}
      <div className="grid gap-4">
        <CaseColumn
          icon={ScanSearch}
          iconClass="text-brand-600"
          title="Active case finding"
          subtitle="People screened with TB symptoms — presumptive, not yet confirmed."
          details={[
            {
              icon: Database,
              label: "Found via",
              render: (r) => (
                <>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Database className="h-3 w-3 shrink-0 text-slate-400" />
                    {SOURCE_LABEL[r.source] ?? r.source.replace(/_/g, " ")}
                  </span>
                  {/* Site is rarely known before diagnosis, so it only shows
                      when it was actually recorded. */}
                  {r.tb_site && (
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      {SITE_LABEL[r.tb_site] ?? r.tb_site}
                    </div>
                  )}
                </>
              ),
            },
          ]}
          query={acf}
          page={acfPage}
          onPage={setAcfPage}
          matchesSearch={matchesSearch}
          describeRow={describeRow}
          scope={scope}
          assignedPsgc={assignedPsgc}
          emptyBody={
            scope.scoped && !hasActiveFilter ? (
              <>
                No presumptive cases recorded in{" "}
                <span className="font-medium text-slate-700">
                  {scope.name ?? "your assigned area"}
                </span>
                .{canCreateCase && " Screen for symptoms and encode who you find."}
              </>
            ) : (
              <>
                No symptomatic individuals match your filters.
                {canCreateCase && " Try changing the filters, or encode a screening."}
              </>
            )
          }
          canCreateCase={canCreateCase}
          canEnroll={canEnroll}
          onEnroll={setEnrolling}
          onDiagnose={setDiagnosing}
        />

        <CaseColumn
          icon={HeartPulse}
          iconClass="text-accent-600"
          title="Active cases"
          subtitle={
            includeClosed
              ? "Confirmed cases — every outcome, newest first."
              : "Confirmed cases currently on treatment."
          }
          details={[
            {
              icon: Microscope,
              label: "Classification",
              // All three axes plus the treatment badge in one cell. As two
              // separate columns this pushed the table wider than the card,
              // and the outcome — the thing you most need to see — was the
              // part that fell off the right edge.
              render: (r) => {
                const site = SITE_LABEL[r.tb_site ?? ""];
                const drug = DRUG_LABEL[r.tb_classification ?? ""];
                const tone = TONE[r.treatment_outcome] ?? "default";
                return (
                  <>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={
                          site
                            ? "font-medium text-slate-900"
                            : "text-slate-400"
                        }
                      >
                        {site ?? "Site not recorded"}
                      </span>
                      <Badge tone={tone}>
                        <span
                          aria-hidden
                          className={
                            "mr-1.5 h-1.5 w-1.5 rounded-full " + TONE_DOT[tone]
                          }
                        />
                        {r.treatment_outcome.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase leading-relaxed tracking-wider text-slate-500">
                      {DX_SHORT[r.diagnosis_status ?? ""] ?? "—"}
                      {drug && (
                        <>
                          <span aria-hidden className="mx-1 text-slate-300">
                            ·
                          </span>
                          {drug}
                        </>
                      )}
                    </div>
                  </>
                );
              },
            },
          ]}
          query={active}
          page={activePage}
          onPage={setActivePage}
          matchesSearch={matchesSearch}
          describeRow={describeRow}
          scope={scope}
          assignedPsgc={assignedPsgc}
          emptyBody={
            includeClosed ? (
              <>
                No confirmed cases match your filters.
                {canCreateCase && " Try changing the filters, or encode a new case."}
              </>
            ) : (
              <>
                No cases are currently on treatment
                {scope.scoped && scope.name ? ` in ${scope.name}` : ""}. Switch
                to <span className="font-medium text-slate-700">All</span> to
                see closed outcomes.
              </>
            )
          }
          canCreateCase={canCreateCase}
          canEnroll={canEnroll}
          onEnroll={setEnrolling}
          onDiagnose={setDiagnosing}
          // Restricting to `ongoing` is what makes these *active* cases, but it
          // would otherwise put cured and completed records out of reach.
          meta={
            <div
              role="group"
              aria-label="Treatment outcome"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"
            >
              {[
                { on: false, label: "On treatment" },
                { on: true, label: "Show all" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={includeClosed === o.on}
                  onClick={() => {
                    setIncludeClosed(o.on);
                    setActivePage(0);
                  }}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
                    includeClosed === o.on
                      ? "bg-accent-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          }
        />
      </div>

      {/* Gate 2 — a presumptive case can only leave that bucket here. */}
      {diagnosing && (
        <RecordDiagnosisPanel
          caseRow={diagnosing}
          onClose={() => setDiagnosing(null)}
          onRecorded={() => {
            void active.refetch();
            void acf.refetch();
          }}
        />
      )}

      {/* Enrollment — the only path by which a patient account is created. */}
      {enrolling && (
        <EnrollPatientPanel
          caseRow={enrolling}
          onClose={() => setEnrolling(null)}
          onEnrolled={() => {
            void active.refetch();
            void acf.refetch();
          }}
        />
      )}
    </>
  );
}

interface DetailColumn {
  icon: LucideIcon;
  label: string;
  render: (r: Row) => ReactNode;
}

/**
 * One of the two registers. Both open with the same three columns — when,
 * where, who — and then append whatever that list is actually about: how the
 * person was found, or how their case is classified and where treatment
 * stands.
 */
function CaseColumn({
  icon: Icon,
  iconClass,
  title,
  subtitle,
  details,
  query,
  page,
  onPage,
  matchesSearch,
  describeRow,
  scope,
  assignedPsgc,
  emptyBody,
  canCreateCase,
  canEnroll,
  onEnroll,
  onDiagnose,
  meta,
}: {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  subtitle: string;
  details: DetailColumn[];
  query: {
    data?: { rows: Row[]; total: number };
    isPending: boolean;
    isFetching: boolean;
  };
  page: number;
  onPage: (updater: (p: number) => number) => void;
  matchesSearch: (r: Row) => boolean;
  describeRow: (r: Row) => RowDescription;
  scope: ReturnType<typeof useAreaScope>;
  assignedPsgc: number | null;
  emptyBody: ReactNode;
  canCreateCase: boolean;
  /** Whether this role may start a patient on treatment at all. */
  canEnroll: boolean;
  onEnroll: (row: Row) => void;
  onDiagnose: (row: Row) => void;
  meta?: ReactNode;
}) {
  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = query.isPending;
  const filtered = rows.filter(matchesSearch);

  // What this card is actually showing right now. "Latest N" only holds on the
  // first page — page 2 onward is deeper history, so it switches to a range.
  // "All dates" stays in either form: it's the bit that stops these counts
  // being read against the period-bounded trends above.
  const shownOnPage = Math.min(total, PAGE_SIZE);
  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);
  const windowLabel =
    total === 0
      ? "All dates"
      : page === 0
        ? `Latest ${shownOnPage.toLocaleString()} · all dates`
        : `${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${total.toLocaleString()} · all dates`;

  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
              <Icon className={cn("h-3.5 w-3.5", iconClass)} />
              {title}
            </div>
            {/* Deliberately mirrors the trends chip above. Seeing "all dates"
                next to "last 30 days" is what stops the two counts reading as
                a contradiction. */}
            <ScopeChip
              icon={History}
              title="The most recent records first, whenever they were reported. The trends above count only the selected period."
            >
              {windowLabel}
            </ScopeChip>
          </div>
          <div className="flex items-center gap-2">
            {meta}
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {total.toLocaleString()} total
            </span>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="px-4 py-14 text-center">
          <SearchX className="mx-auto h-6 w-6 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">{emptyBody}</p>
          {canCreateCase && (
            <Link
              to="/app/cases/new"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-base font-semibold text-white shadow-soft transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
            >
              <Plus className="h-5 w-5" /> Add new case
            </Link>
          )}
        </div>
      ) : (
        <div className="max-h-[34rem] flex-1 overflow-x-auto overflow-y-auto overscroll-contain">
          <table className="min-w-full text-sm">
            {/* Fully opaque, not /95 — rows scrolling underneath were showing
                through the header band. */}
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <Th icon={CalendarDays} className="pl-5 pr-3">
                  Reported
                </Th>
                <Th icon={MapPin}>Lives in / registered at</Th>
                <Th icon={UserRound}>Patient</Th>
                {/* Named for the action, not the data. A worker scanning the
                    register is looking for what to do next, and this is the
                    only column that answers that. */}
                <Th icon={ClipboardCheck}>Status &amp; next step</Th>
                {details.map((d, i) => (
                  <Th
                    key={d.label}
                    icon={d.icon}
                    className={i === details.length - 1 ? "pl-3 pr-5" : undefined}
                  >
                    {d.label}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((r) => {
                // Only meaningful for citywide roles, where other barangays'
                // rows sit alongside the user's home area.
                const isAssigned =
                  !scope.scoped &&
                  assignedPsgc !== null &&
                  r.barangay_psgc === assignedPsgc;
                const { relation, facilityName } = describeRow(r);
                const state = enrollmentState(r);
                return (
                  <tr
                    key={r.id}
                    className={
                      "transition-colors " +
                      (isAssigned
                        ? "bg-brand-50/60 hover:bg-brand-50"
                        : "hover:bg-slate-50/70")
                    }
                  >
                    <td className="whitespace-nowrap py-3 pl-5 pr-3 tabular-nums text-slate-600">
                      {formatDate(r.reported_at)}
                    </td>
                    {/* Capped, because the facility name below is the widest
                        thing in the row — "Mintal Health Center Central TB
                        DOTS Clinic" alone was dragging the table past the
                        card. `truncate` cannot do anything in a table cell
                        that sizes to its own content, so the width has to be
                        stated. `title` keeps the full name reachable. */}
                    <td className="max-w-[13rem] px-3 py-3 align-top font-medium text-slate-900">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {barangays.find((b) => b.psgc === r.barangay_psgc)
                          ?.name ?? "—"}
                        {isAssigned && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-brand-200 bg-brand-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-brand-700">
                            <MapPin className="h-2.5 w-2.5" /> Your area
                          </span>
                        )}
                        {relation === "area" && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-brand-200 bg-brand-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-brand-700">
                            <MapPin className="h-2.5 w-2.5" /> Lives here
                          </span>
                        )}
                        {/* Teal deliberately matches the facility markers on
                            the GIS map, so "registered here" reads as the
                            same idea in both places. */}
                        {relation === "clinic" && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-teal-200 bg-teal-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-teal-700">
                            <Cross className="h-2.5 w-2.5" /> Registered here
                          </span>
                        )}
                      </span>
                      {/* The registering facility, under the residence.
                          Together they answer the question the register used
                          to leave open: this patient lives in X and the case
                          was notified at Y. */}
                      <span
                        title={facilityName ?? undefined}
                        className="mt-0.5 block truncate text-[11px] font-normal text-slate-500"
                      >
                        {facilityName ?? "No facility recorded"}
                      </span>
                    </td>
                    {/* Not nowrap: a long name used to widen the whole table
                        and push the action column out of view. It wraps now,
                        costing a line of height instead of a scrollbar. */}
                    <td className="px-3 py-3 align-top text-slate-600">
                      {/* Name first — it's what the nurse matches against the
                          person standing at the counter. Imported rows have
                          none, so age/sex stays as the fallback identity. */}
                      {(r.given_name || r.family_name) && (
                        <span className="block font-medium text-slate-900">
                          {[r.given_name, r.family_name]
                            .filter(Boolean)
                            .join(" ")}
                        </span>
                      )}
                      <span className="whitespace-nowrap">
                      <span className="tabular-nums">{r.age ?? "—"}</span>
                      {r.age != null && (
                        <span className="text-slate-400"> yrs</span>
                      )}
                      <span aria-hidden className="mx-1.5 text-slate-300">
                        ·
                      </span>
                      <span className="capitalize">{r.sex}</span>
                      </span>
                    </td>
                    {/* The action cell. These buttons used to be `ghost` —
                        grey text on white, indistinguishable from the data
                        beside them. Health workers read straight past them and
                        the register looked like a report rather than a worklist.
                        They are now filled, icon-led and verb-first: the one
                        thing to do next on this row should be the loudest thing
                        in it. */}
                    <td className="px-3 py-3 align-top">
                      <EnrollmentChip status={state.status} />
                      <div className="mt-2 flex flex-col items-stretch gap-1.5 empty:mt-0">
                        {/* `name_missing` still offers the button: the panel is
                            where the nurse fills the name in, so hiding it would
                            leave the row with no way forward. */}
                        {canEnroll &&
                          (state.canEnroll || state.blocker === "name_missing") && (
                            <Button
                              variant="primary"
                              className="h-9 justify-start px-3"
                              onClick={() => onEnroll(r)}
                            >
                              <UserPlus aria-hidden className="h-4 w-4 shrink-0" />
                              Enroll patient
                            </Button>
                          )}
                        {/* Gate 2 — the result comes back. Without this a
                            presumptive case can never leave the bucket, and
                            enrollment stays permanently out of reach. */}
                        {canEnroll &&
                          state.status === "awaiting_diagnosis" &&
                          r.disease === "tb" && (
                            <Button
                              variant="accent"
                              className="h-9 justify-start px-3"
                              onClick={() => onDiagnose(r)}
                            >
                              <Microscope aria-hidden className="h-4 w-4 shrink-0" />
                              Record test result
                            </Button>
                          )}
                        {/* Enrolled but not yet claimed — the slip gets lost, so
                            there has to be a way back to the code. */}
                        {canEnroll &&
                          state.status === "enrolled" &&
                          r.patient_profile_id === null && (
                            <Button
                              variant="secondary"
                              className="h-9 justify-start px-3"
                              onClick={() => onEnroll(r)}
                            >
                              <Ticket aria-hidden className="h-4 w-4 shrink-0" />
                              Show claim code
                            </Button>
                          )}
                      </div>
                    </td>
                    {details.map((d, i) => (
                      <td
                        key={d.label}
                        className={cn(
                          "py-3",
                          i === details.length - 1
                            ? "pl-3 pr-5"
                            : "px-3 align-top"
                        )}
                      >
                        {d.render(r)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-2.5">
          <span className="font-mono text-[10px] tabular-nums text-slate-500">
            {query.isFetching && "updating · "}
            {(page * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min((page + 1) * PAGE_SIZE, total).toLocaleString()} of{" "}
            {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              disabled={page === 0 || query.isFetching}
              onClick={() => onPage((p) => Math.max(0, p - 1))}
              aria-label={`Previous page of ${title}`}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page + 1 >= pageCount || query.isFetching}
              onClick={() => onPage((p) => p + 1)}
              aria-label={`Next page of ${title}`}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * Says out loud which slice of time a block of numbers covers. The trends
 * tiles count only the selected period while the two registers list every
 * record ever, so the same barangay legitimately reads "0 on treatment" above
 * and "10 cases" below. Without this, that looks like a bug.
 */
function ScopeChip({
  icon: Icon,
  children,
  title,
}: {
  icon: LucideIcon;
  children: ReactNode;
  title: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-500"
    >
      <Icon aria-hidden className="h-2.5 w-2.5 shrink-0 text-slate-400" />
      {children}
    </span>
  );
}

function Th({
  icon: Icon,
  className,
  children,
}: {
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-slate-200 px-3 py-2.5 text-left font-semibold",
        className
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon aria-hidden className="h-3 w-3 shrink-0 text-slate-400" />
        {children}
      </span>
    </th>
  );
}

function InsightTile({
  icon: Icon,
  tone,
  label,
  value,
  footer,
}: {
  icon: LucideIcon;
  tone: keyof typeof TILE_TONE;
  label: string;
  value: string;
  footer: string;
}) {
  const t = TILE_TONE[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-soft transition-shadow hover:shadow-lift">
      <span aria-hidden className={"absolute inset-y-0 left-0 w-1 " + t.bar} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={MICRO_LABEL}>{label}</div>
          <div
            title={value}
            className="mt-1 truncate font-display text-xl font-extrabold tracking-tight text-slate-900"
          >
            {value}
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{footer}</div>
        </div>
        <span className={"grid h-9 w-9 shrink-0 place-items-center rounded-lg " + t.chip}>
          <Icon aria-hidden className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function FreqGroup({
  icon: Icon,
  title,
  bars,
}: {
  icon: LucideIcon;
  title: string;
  bars: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  return (
    <div>
      <div className={"flex items-center gap-1.5 " + MICRO_LABEL}>
        <Icon aria-hidden className="h-3 w-3 shrink-0 text-slate-400" />
        {title}
      </div>
      {bars.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No data.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {bars.map((b) => (
            <li key={b.label}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium capitalize text-slate-700">
                  {b.label}
                </span>
                <span className="font-display font-bold tabular-nums text-slate-900">
                  {b.count.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.max(3, (b.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
