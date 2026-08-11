import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { areaScopeFor, type AreaScope } from "../lib/areaScope";

/**
 * Which barangay — and, for a health centre, which facility — the signed-in
 * account is allowed to see. The database enforces this via RLS; the UI uses it
 * to avoid offering filters and labels that promise data the user can't
 * actually read.
 */
export function useAreaScope(): AreaScope {
  const { profile } = useAuth();
  return useMemo(
    () => areaScopeFor(profile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.role, profile?.barangay_psgc, profile?.facility_id]
  );
}
