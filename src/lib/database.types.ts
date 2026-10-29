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
/**
 * Mirrors the `public.app_role` enum. `AppRole` in supabase.ts is the same set.
 * `patient` is only the pre-invite state of a fresh sign-up; it opens nothing.
 */
export type AppRoleName =
  | "barangay_admin"
  | "health_worker"
  | "tb_coordinator"
  | "patient"
  | "system_admin";

/** Getis-Ord Gi* classification of a barangay (see 20261023000000). */
export type GiClassValue =
  | "hotspot_99"
  | "hotspot_95"
  | "not_significant"
  | "coldspot_95"
  | "coldspot_99";

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
          /** Patient's contact number, verified at enrollment. Staff-only. */
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
          /** Health worker who verified the case and assigned treatment. */
          enrolled_by: string | null;
          enrolled_at: string | null;
          created_at: string;
          /** NTP TB Register fields — see 20261020000000_tb_register_fields. */
          tb_case_number: string | null;
          screening_date: string | null;
          notification_date: string | null;
          treatment_start_date: string | null;
          middle_name: string | null;
          name_extension: string | null;
          date_of_birth: string | null;
          patient_source: string | null;
          screening_mode: string | null;
          ep_site: string | null;
          registration_group: string | null;
          treatment_regimen: string | null;
          contacts: Json | null;
          hiv_status: string | null;
          hiv_test_date: string | null;
          dm_status: string | null;
          dm_screening_date: string | null;
          treatment_location: string | null;
          dat_type: string | null;
          supporter_type: string | null;
          lab_results: Json | null;
          outcome_date: string | null;
          outcome_reason: string | null;
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
          /** Detection run that produced this row. */
          run_id: string | null;
          /** Getis-Ord Gi* z-score and two-sided p-value of the barangay. */
          gi_z: number | null;
          gi_p: number | null;
          gi_class: GiClassValue | null;
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
      barangay_neighbors: {
        Row: {
          barangay_psgc: number;
          neighbor_psgc: number;
          kind: "queen" | "knn";
        };
        Insert: Database["public"]["Tables"]["barangay_neighbors"]["Row"];
        Update: Partial<Database["public"]["Tables"]["barangay_neighbors"]["Row"]>;
        Relationships: [];
      };
      hotspot_runs: {
        Row: {
          id: string;
          run_at: string;
          trigger: string;
          window_start: string;
          window_end: string;
          metric: "rate_per_100k" | "case_count";
          n_units: number;
          cases_considered: number;
          moran_i: number;
          moran_expected: number;
          moran_z: number;
          moran_p_norm: number;
          moran_p_sim: number;
          permutations: number;
          hotspot_count: number;
          coldspot_count: number;
          duration_ms: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["hotspot_runs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["hotspot_runs"]["Row"]>;
        Relationships: [];
      };
      hotspot_results: {
        Row: {
          run_id: string;
          barangay_psgc: number;
          case_count: number;
          population: number | null;
          value: number;
          gi_z: number;
          gi_p: number;
          gi_class: GiClassValue;
          fdr_significant: boolean;
        };
        Insert: Database["public"]["Tables"]["hotspot_results"]["Row"];
        Update: Partial<Database["public"]["Tables"]["hotspot_results"]["Row"]>;
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
       * Allow-list of external interoperability targets. `base_url` is
       * constrained to HTTPS by a check constraint, so "transmits securely"
       * is a database invariant rather than application behaviour.
       *
       * `credential_cipher` is deliberately absent from this type: no API
       * role is granted SELECT on that column, so selecting it fails. The
       * credential is set through `interop_set_credential` and read only by
       * the dispatch function inside the database.
       */
      interop_endpoints: {
        Row: {
          id: string;
          name: string;
          kind: "fhir_rest" | "mirth_channel";
          base_url: string;
          resource_path: string;
          auth_scheme: "none" | "bearer" | "basic" | "apikey";
          /** Last four characters of the stored secret, for confirmation only. */
          credential_hint: string | null;
          credential_header: string | null;
          active: boolean;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["interop_endpoints"]["Row"]> & {
          name: string;
          base_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["interop_endpoints"]["Row"]>;
        Relationships: [];
      };
      /**
       * Append-only, hash-chained audit trail of every FHIR serialization,
       * disclosure and transmission. There is no Insert or Update type on
       * purpose: writes arrive only through the definer function
       * `interop_log_event`, and UPDATE/DELETE/TRUNCATE raise at the database.
       *
       * `payload_cipher` is absent for the same reason as above — the
       * ciphertext never leaves the database; `interop_payload` is the one
       * read path, and it logs the read.
       */
      interop_audit_log: {
        Row: {
          id: string;
          /** Chain position. Also the display number in the UI ("#14"). */
          seq: number;
          event:
            | "payload_previewed"
            | "transmit_success"
            | "transmit_failure"
            | "payload_viewed"
            | "access_denied"
            | "endpoint_credential_set";
          case_id: string | null;
          /** TB case code snapshotted at write time. Never a patient name. */
          case_label: string | null;
          endpoint_id: string | null;
          endpoint_url: string | null;
          actor_id: string | null;
          actor_email: string | null;
          actor_role: AppRoleName | null;
          disclosure_scope: "pseudonymous" | "identified" | null;
          fhir_bundle_id: string | null;
          resource_count: number | null;
          payload_bytes: number | null;
          /** SHA-256 of the exact bytes transmitted. Carries no PHI. */
          payload_sha256: string | null;
          http_status: number | null;
          response_summary: string | null;
          latency_ms: number | null;
          outcome: "ok" | "denied" | "error";
          error_detail: string | null;
          prev_hash: string | null;
          record_hash: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      barangay_case_counts: {
        Args: { p_disease: string | null; p_days: number };
        Returns: { barangay_psgc: number; case_count: number }[];
      };
      /** Per-(year, barangay) totals for the public map's year filter. */
      barangay_case_counts_yearly: {
        Args: { p_disease?: string | null };
        Returns: { year: number; barangay_psgc: number; case_count: number }[];
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
      /** Marks a verified case as started on treatment. */
      enroll_patient: {
        Args: { p_case_id: string };
        Returns: { ok: boolean; reason: string }[];
      };
      /**
       * Encrypts and stores an endpoint's transport credential. Coordinator
       * and system admin only; the rotation itself is audited.
       */
      interop_set_credential: {
        Args: { p_endpoint_id: string; p_secret: string };
        Returns: boolean;
      };
      /**
       * Decrypts the stored FHIR payload of one audit row. Returns null when
       * the row kept no copy (previews do not). Every successful read appends
       * a `payload_viewed` row of its own.
       */
      interop_payload: {
        Args: { p_audit_id: string };
        Returns: string | null;
      };
      /**
       * Recomputes the audit log's hash chain. `ok: false` on any row means
       * that row was edited, or a row before it was removed or reordered.
       */
      verify_interop_audit: {
        Args: Record<string, never>;
        Returns: {
          audit_seq: number;
          audit_id: string;
          audit_event: string;
          logged_at: string;
          ok: boolean;
          problem: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
