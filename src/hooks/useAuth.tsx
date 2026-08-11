import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type AppRole } from "../lib/supabase";

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

interface AuthContextValue {
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
   * (`claim_staff_role` for staff, the claim flow for patients), because
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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Which user's profile is currently loaded. Lets the auth listener tell
  // a real sign-in apart from token refreshes for the same user.
  const loadedUserRef = useRef<string | null>(null);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, barangay_psgc, facility_id, phone")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.warn("Failed to load profile:", error.message);
      loadedUserRef.current = null;
      setProfile(null);
      // Recorded, not swallowed. A null profile alone would send the user to
      // /login as if their session had expired, and they'd sign back in to the
      // same failure — the schema mismatch or dropped connection behind it
      // never surfaces.
      setProfileError(error.message);
      return;
    }
    loadedUserRef.current = data ? userId : null;
    setProfile(data as Profile | null);
    setProfileError(null);
  }

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user.id) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      const uid = s?.user.id ?? null;
      if (!uid) {
        loadedUserRef.current = null;
        setProfile(null);
        setProfileError(null);
        setLoading(false);
        return;
      }
      // Supabase re-emits auth events for the SAME user whenever the tab
      // regains focus and the token refreshes. Flipping `loading` here
      // would unmount the whole app into a spinner and remount it (looks
      // like a page refresh) — so only reload when the user truly changed.
      if (uid === loadedUserRef.current) return;
      setLoading(true);
      void loadProfile(uid).finally(() => setLoading(false));
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      profileError,
      loading,
      async reloadProfile() {
        // Ask Supabase rather than trusting the captured `session`. The caller
        // that most needs this — a registration handler re-reading its own
        // freshly-promoted role — is running inside a closure created before
        // sign-up, where `session` is still null and this would silently
        // no-op. getSession() reads the live client state instead.
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user.id ?? session?.user.id;
        if (uid) await loadProfile(uid);
      },
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return error ? { error: error.message } : {};
      },
      async signUp(email, password, fullName, phone = null) {
        const cleanPhone = phone?.trim() || null;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Only descriptive fields travel as metadata. Anything that grants
            // scope is set server-side — handle_new_user() ignores it here.
            data: { full_name: fullName, phone: cleanPhone },
          },
        });
        if (error) return { error: error.message };
        // confirmed = true means Supabase returned a live session (email
        // confirmation is disabled on this project). The caller can navigate
        // straight to /app. If false, the user must confirm their email first.
        return { confirmed: !!data.session, userId: data.user?.id };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, profileError, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
