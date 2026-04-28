import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
   
  console.warn(
    "[BANTAY-TB] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env and fill in your Supabase project credentials."
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  url ?? "http://127.0.0.1:54321",
  anonKey ?? "missing-anon-key"
);

export type AppRole =
  | "barangay_admin"
  | "health_worker"
  | "tb_coordinator"
  | "patient";

export const ROLE_LABELS: Record<AppRole, string> = {
  barangay_admin: "Barangay Admin / Frontliner",
  health_worker: "BHW / Nurse / Doctor",
  tb_coordinator: "TB Coordinator / Official",
  patient: "Patient / Client",
};
