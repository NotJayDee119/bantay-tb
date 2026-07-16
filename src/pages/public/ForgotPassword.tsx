import { useState } from "react";
import { Activity, ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button, Card, Input, Label } from "../../components/ui";
import { supabase } from "../../lib/supabase";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 lg:grid-cols-2">
      {/* Photo column */}
      <div className="relative hidden overflow-hidden bg-brand-700 lg:block">
        <img
          src="/images/for-workers.jpg"
          alt="Health workers"
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
              Forgot your password?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-100">
              We&rsquo;ll email you a secure link to set a new password. The
              link expires in 1 hour.
            </p>
          </div>
        </div>
      </div>

      {/* Form column */}
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
              <KeyRound className="h-3.5 w-3.5" /> Reset password
            </p>
            <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Forgot your password?
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Enter the email you used to register. We&rsquo;ll send you a
              secure link to set a new password.
            </p>
          </div>

          <Card className="mt-6 p-6 sm:p-8">
            {sent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <MailCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Check your email
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    If an account exists for{" "}
                    <span className="font-medium text-slate-800">{email}</span>,
                    you&rsquo;ll receive a reset link within a few minutes.
                    Don&rsquo;t forget to check your spam folder.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                  }}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setLoading(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(
                    email.trim(),
                    {
                      redirectTo: `${window.location.origin}/reset-password`,
                    }
                  );
                  setLoading(false);
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  setSent(true);
                  toast.success("Reset email sent");
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" loading={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            )}

            <div className="mt-5 text-center text-sm">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
