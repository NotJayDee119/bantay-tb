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
export type TBClassification =
  | "drug_sensitive"
  | "drug_resistant"
  | "pulmonary"
  | "extra_pulmonary"
  | "presumptive"
  | "unknown";
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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role:
            | "barangay_admin"
            | "health_worker"
            | "tb_coordinator"
            | "patient";
          barangay_psgc: number | null;
          phone: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          email: string;
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
          barangay_psgc: number;
          disease: Disease;
          tb_classification: TBClassification | null;
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
          barangay_psgc: number;
          disease: Disease;
          case_count: number;
          density: number;
          severity: "low" | "medium" | "high";
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
