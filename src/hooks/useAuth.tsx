import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
  barangay_psgc: number | null;
  phone: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: AppRole,
    barangayPsgc: number | null,
    phone?: string | null
  ) => Promise<{ error?: string; confirmed?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, barangay_psgc, phone")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.warn("Failed to load profile:", error.message);
      setProfile(null);
      return;
    }
    setProfile(data as Profile | null);
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
      if (s?.user.id) {
        setLoading(true);
        void loadProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setLoading(false);
      }
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
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        return error ? { error: error.message } : {};
      },
      async signUp(email, password, fullName, role, barangayPsgc, phone = null) {
        const cleanPhone = phone?.trim() || null;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
              barangay_psgc: barangayPsgc,
              phone: cleanPhone,
            },
          },
        });
        if (error) return { error: error.message };
        if (data.user) {
          const { error: pErr } = await supabase.from("profiles").upsert({
            id: data.user.id,
            email,
            full_name: fullName,
            role,
            barangay_psgc: barangayPsgc,
            phone: cleanPhone,
          });
          if (pErr) return { error: pErr.message };
        }
        // confirmed = true means Supabase returned a live session (email
        // confirmation is disabled on this project). The caller can navigate
        // straight to /app. If false, the user must confirm their email first.
        return { confirmed: !!data.session };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
