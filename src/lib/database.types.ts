// Hand-maintained Supabase schema types.
// Regenerate with: supabase gen types typescript --local > src/lib/database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Disease = "tb" | "pneumonia" | "covid19" | "asthma";
/**
 * Legacy single-axis classification. Kept in sync with `TBSite` and
 * `DiagnosisStatus` by the `cases_sync_tb_fields` trigger — prefer those two
 * for new work, since this one can only ever express one axis at a time.
 */
export type TBClassification =
  | "drug_sensitive"
  | "drug_resistant"
  | "pulmonary"
  | "extra_pulmonary"
  | "presumptive"
  | "unknown";
/** Anatomical site of TB disease. */
export type TBSite = "pulmonary" | "extra_pulmonary";
/** How firmly the case is diagnosed — `presumptive` is the case-finding yield. */
export type DiagnosisStatus =
  | "presumptive"
  | "clinically_diagnosed"
  | "bacteriologically_confirmed";
export type Sex = "male" | "female" | "other" | "unknown";
export type TreatmentOutcome =
  | "ongoing"
  | "cured"
  | "completed"
  | "failed"
  | "died"
  | "lost_to_followup"
  | "not_evaluated";
export type AdherenceStatus = "scheduled" | "taken" | "missed" | "late";
/** Mirrors the `public.app_role` enum. `AppRole` in supabase.ts is the same set. */
export type AppRoleName =
  | "barangay_admin"
  | "health_worker"
  | "tb_coordinator"
  | "patient"
  | "system_admin";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          /**
           * Null for phone-only accounts. A walk-in DOTS patient frequently
           * has no email — staff always do, patients often don't.
           */
          email: string | null;
          full_name: string | null;
          role: AppRoleName;
          /** Barangay this account covers — the residence axis. */
          barangay_psgc: number | null;
          /**
           * DOTS facility this account is posted to. health_worker reads its
           * own facility's register on top of its barangay's residents; null
           * for barangay_admin and citywide roles.
           */
          facility_id: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      barangays: {
        Row: {
          psgc: number;
          name: string;
          centroid_lat: number;
          centroid_lon: number;
          area_km2: number | null;
          population: number | null;
        };
        Insert: Database["public"]["Tables"]["barangays"]["Row"];
        Update: Partial<Database["public"]["Tables"]["barangays"]["Row"]>;
        Relationships: [];
      };
      cases: {
        Row: {
          id: string;
          /** Barangay of the patient's residence — not the facility's barangay. */
          barangay_psgc: number;
          /**
           * Patient name. PII — staff-only, never on public pages or exports.
           * Null on imported and historical rows, which is why enrollment
           * requires it to be filled in first.
           */
          given_name: string | null;
          family_name: string | null;
          /**
           * Number reminders go to. Lives here rather than only on the account
           * because the nurse verifies it at enrollment, before any profile
           * exists — and refill reminders need it whether or not the patient
           * ever claims a login.
           */
          contact_phone: string | null;
          /** Patient's street address. PII — staff-only, never on public pages. */
          address: string | null;
          /** Geocoded household coordinates (real, unlike the jittered pair). */
          residence_lat: number | null;
          residence_lon: number | null;
          /**
           * DOTS facility this case is registered/notified at — a reporting
           * fact, not a service one. Frequently outside the patient's own
           * barangay (lives in Calinan, registered at Mintal).
           */
          facility_id: string | null;
          disease: Disease;
          tb_classification: TBClassification | null;
          tb_site: TBSite | null;
          diagnosis_status: DiagnosisStatus | null;
          age: number | null;
          age_group: string | null;
          sex: Sex;
          treatment_outcome: TreatmentOutcome;
          reported_at: string;
          jitter_lat: number;
          jitter_lon: number;
          notes: string | null;
          reported_by: string | null;
          source: string;
          patient_code: string | null;
          diagnosis_date: string | null;
          source_file_path: string | null;
          /**
           * The account claimed for this case, once enrolled. Null for every
           * case without a login — which is most of them, since presumptives
           * never get one.
           */
          patient_profile_id: string | null;
          /** Health worker who verified the case and assigned treatment. */
          enrolled_by: string | null;
          enrolled_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cases"]["Row"]> & {
          barangay_psgc: number;
          disease: Disease;
        };
        Update: Partial<Database["public"]["Tables"]["cases"]["Row"]>;
        Relationships: [];
      };
      hotspots: {
        Row: {
          id: string;
          /** Modal barangay of residence — what the cluster is filed under. */
          barangay_psgc: number;
          /**
           * Every barangay of residence with a case in the cluster. Alert
           * routing and the staff read policy key on this, so a cluster that
           * straddles a boundary reaches both areas.
           */
          barangay_psgcs: number[];
          /**
           * Cases that formed the cluster. Resolved against `cases` under RLS
           * so an alert can show a recipient the residences behind the count.
           */
          case_ids: string[];
          disease: Disease;
          case_count: number;
          density: number;
          severity: "low" | "medium" | "high" | "watch" | "moderate" | "urgent";
          detected_at: string;
          window_start: string;
          window_end: string;
          centroid_lat: number;
          centroid_lon: number;
          radius_km: number;
        };
        Insert: Partial<Database["public"]["Tables"]["hotspots"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["hotspots"]["Row"]>;
        Relationships: [];
      };
      hotspot_alerts: {
        Row: {
          id: string;
          hotspot_id: string;
          recipient_id: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["hotspot_alerts"]["Row"]
        > & { hotspot_id: string; recipient_id: string };
        Update: Partial<Database["public"]["Tables"]["hotspot_alerts"]["Row"]>;
        Relationships: [];
      };
      dots_centers: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          barangay_psgc: number | null;
          lat: number;
          lon: number;
          phone: string | null;
          hours: string | null;
          services: string[] | null;
        };
        Insert: Partial<Database["public"]["Tables"]["dots_centers"]["Row"]> & {
          name: string;
          lat: number;
          lon: number;
        };
        Update: Partial<Database["public"]["Tables"]["dots_centers"]["Row"]>;
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value: Record<string, unknown>;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["app_settings"]["Row"]> & {
          key: string;
          value: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Row"]>;
        Relationships: [];
      };
      adherence_schedules: {
        Row: {
          id: string;
          patient_id: string;
          medication: string;
          dose: string;
          times_per_day: number;
          start_date: string;
          end_date: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["adherence_schedules"]["Row"]
        > & { patient_id: string; medication: string };
        Update: Partial<
          Database["public"]["Tables"]["adherence_schedules"]["Row"]
        >;
        Relationships: [];
      };
      adherence_logs: {
        Row: {
          id: string;
          schedule_id: string;
          patient_id: string;
          scheduled_at: string;
          taken_at: string | null;
          status: AdherenceStatus;
          notes: string | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["adherence_logs"]["Row"]
        > & { schedule_id: string; patient_id: string; scheduled_at: string };
        Update: Partial<Database["public"]["Tables"]["adherence_logs"]["Row"]>;
        Relationships: [];
      };
      sms_outbox: {
        Row: {
          id: string;
          to_phone: string;
          body: string;
          status: "queued" | "sent" | "delivered" | "failed" | "mocked";
          provider: string;
          provider_response: Json | null;
          patient_id: string | null;
          schedule_id: string | null;
          created_at: string;
          sent_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["sms_outbox"]["Row"]> & {
          to_phone: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["sms_outbox"]["Row"]>;
        Relationships: [];
      };
      chatbot_messages: {
        Row: {
          id: string;
          session_id: string;
          user_id: string | null;
          role: "user" | "assistant" | "system";
          content: string;
          language: string | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["chatbot_messages"]["Row"]
        > & { session_id: string; role: "user" | "assistant" | "system"; content: string };
        Update: Partial<
          Database["public"]["Tables"]["chatbot_messages"]["Row"]
        >;
        Relationships: [];
      };
      health_content: {
        Row: {
          id: string;
          slug: string;
          disease: Disease;
          locale: "en" | "tl" | "ceb";
          title: string;
          summary: string | null;
          body_md: string;
          category: "overview" | "symptoms" | "treatment" | "prevention" | "lifestyle";
          updated_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["health_content"]["Row"]
        > & {
          slug: string;
          disease: Disease;
          locale: "en" | "tl" | "ceb";
          title: string;
          body_md: string;
          category:
            | "overview"
            | "symptoms"
            | "treatment"
            | "prevention"
            | "lifestyle";
        };
        Update: Partial<Database["public"]["Tables"]["health_content"]["Row"]>;
        Relationships: [];
      };
      invite_codes: {
        Row: {
          id: string;
          code: string;
          note: string | null;
          created_by: string | null;
          created_at: string;
          expires_at: string;
          used_at: string | null;
          used_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["invite_codes"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["invite_codes"]["Row"]>;
        Relationships: [];
      };
      /**
       * Single-use codes that let an enrolled patient claim the account
       * generated for their case. Written only by the definer functions —
       * there is no direct insert path.
       */
      patient_claims: {
        Row: {
          id: string;
          case_id: string;
          code: string;
          expires_at: string;
          used_at: string | null;
          used_by: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["patient_claims"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["patient_claims"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      barangay_case_counts: {
        Args: { p_disease: string | null; p_days: number };
        Returns: { barangay_psgc: number; case_count: number }[];
      };
      create_invite_code: {
        Args: { p_note?: string | null };
        Returns: Database["public"]["Tables"]["invite_codes"]["Row"];
      };
      validate_invite_code: {
        Args: { p_code: string };
        Returns: { valid: boolean; reason: string }[];
      };
      /**
       * Consumes an invite code and promotes the calling account to a staff
       * role. Replaces redeem_invite_code — the role is assigned server-side,
       * because anything the client asked for could be forged.
       */
      claim_staff_role: {
        Args: {
          p_code: string;
          p_role: AppRoleName;
          p_barangay_psgc?: number | null;
          p_facility_id?: string | null;
        };
        Returns: { ok: boolean; reason: string }[];
      };
      /** Is this case eligible for enrollment, and if not, why not. */
      case_enrollable: {
        Args: { p_case_id: string };
        Returns: { ok: boolean; reason: string }[];
      };
      /** Marks a case enrolled and mints its claim slip, atomically. */
      enroll_patient: {
        Args: { p_case_id: string };
        Returns: {
          ok: boolean;
          reason: string;
          claim_code: string | null;
          expires_at: string | null;
        }[];
      };
      /** Reissues a claim slip, revoking any unclaimed one for the case. */
      create_patient_claim: {
        Args: { p_case_id: string };
        Returns: Database["public"]["Tables"]["patient_claims"]["Row"];
      };
      /** Anonymous "Is this you?" pre-check. Discloses the bare minimum. */
      validate_patient_claim: {
        Args: { p_code: string };
        Returns: {
          valid: boolean;
          reason: string;
          display_name: string | null;
          facility_name: string | null;
        }[];
      };
      /** Binds the freshly-created account to the case the nurse verified. */
      redeem_patient_claim: {
        Args: { p_code: string };
        Returns: { ok: boolean; reason: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
