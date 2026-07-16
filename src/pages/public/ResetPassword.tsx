import { useEffect, useState } from "react";
import { Activity, KeyRound, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Button,
  Card,
  Label,
  PasswordInput,
  Spinner,
} from "../../components/ui";
import { supabase } from "../../lib/supabase";

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Supabase fires PASSWORD_RECOVERY when the recovery token in the URL
  // hash has been parsed and the recovery session is active.
  useEffect(() => {
    let cancelled = false;

    // If a session is already present (we just landed from the email link),
    // accept it immediately.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setRecoveryReady(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setRecoveryReady(true);
      }
    });

    // If the URL had an `error` or `error_description` query, surface it.
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const errDesc = params.get("error_description");
    if (errDesc) {
      setLinkError(errDesc);
    }

    // Fallback: if after 1.5s we still don't have a recovery session, the
    // user likely arrived without a valid token.
    const t = window.setTimeout(() => {
      if (cancelled) return;
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session && !errDesc) {
          setLinkError(
            "Reset link is invalid or has expired. Please request a new one."
          );
        }
      });
    }, 1500);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.clearTimeout(t);
    };
  }, []);

  return (
    <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-700 lg:block">
        <img
          src="/images/for-workers.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/70 via-brand-800/60 to-brand-700/40" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-white">
              <Activity className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              BANTAY-TB
            </span>
          </Link>
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-100">
              Account recovery
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight">
              Set a new password
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-100">
              Choose a password you haven&rsquo;t used before. Minimum 6
              characters. You&rsquo;ll be signed in automatically once it
              saves.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white shadow-soft">
                <Activity className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-slate-900">
                BANTAY-TB
              </span>
            </Link>
          </div>

          <div className="mt-8 lg:mt-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
              <KeyRound className="h-3.5 w-3.5" /> Set new password
            </p>
            <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Choose a new password
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Enter your new password below. You&rsquo;ll be signed in
              automatically after saving.
            </p>
          </div>

          <Card className="mt-6 p-6 sm:p-8">
            {linkError ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-red-700">{linkError}</p>
                <Link
                  to="/forgot-password"
                  className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-700"
                >
                  Request a new reset link
                </Link>
              </div>
            ) : !recoveryReady ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-5 w-5 text-brand-600" />
                <span className="ml-2 text-sm text-slate-500">
                  Verifying reset link…
                </span>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (password.length < 6) {
                    toast.error("Password must be at least 6 characters.");
                    return;
                  }
                  if (password !== confirm) {
                    toast.error("Passwords do not match.");
                    return;
                  }
                  setLoading(true);
                  const { error } = await supabase.auth.updateUser({
                    password,
                  });
                  setLoading(false);
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  toast.success("Password updated. You are signed in.");
                  navigate("/app");
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <PasswordInput
                    id="new-password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Minimum 6 characters.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <PasswordInput
                    id="confirm-password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" loading={loading}>
                  {loading ? (
                    "Updating…"
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Update password
                    </>
                  )}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
