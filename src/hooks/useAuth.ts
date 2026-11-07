import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AppRole } from "../lib/supabase";

// The provider lives in AuthProvider.tsx. Keeping this file free of components
// lets Vite's fast refresh hot-swap the provider without a full reload.

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  /** Barangay of residence this account covers — the surveillance axis. */
  barangay_psgc: number | null;
  /**
   * DOTS facility this account is posted to. Health centre accounts read their
   * own facility's register on top of their barangay's residents, so this is
   * half of what decides their scope.
   */
  facility_id: string | null;
  phone: string | null;
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /**
   * Why the profile is missing, when it is missing because the read *failed*
   * rather than because nobody is signed in. The two look identical from
   * `profile === null`, and conflating them signs a perfectly valid session out
   * of the app — a single bad column in the select is enough to do it.
   */
  profileError: string | null;
  /** Retry the profile read for the current session. */
  reloadProfile: () => Promise<void>;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  /**
   * Creates an auth user and its `patient` profile — nothing more. Role,
   * assigned barangay and facility posting are all granted server-side
   * (`claim_staff_role` with an invite code), because
   * anything this function passed as metadata would be client-controlled.
   */
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone?: string | null
  ) => Promise<{ error?: string; confirmed?: boolean; userId?: string }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
