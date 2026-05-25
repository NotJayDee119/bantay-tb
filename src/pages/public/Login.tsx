import { useState } from "react";
import { Activity, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Button,
  Card,
  Input,
  Label,
  PasswordInput,
  Spinner,
} from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 lg:grid-cols-2">
      {/* Photo column */}
      <div className="relative hidden overflow-hidden bg-brand-700 lg:block">
        <img
          src="/images/for-workers.jpg"
          alt="Health workers reviewing case data"
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
              For health workers
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight">
              A clearer view of TB across Davao City.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-100">
              Sign in to access case surveillance, barangay-level hotspots, and
              live operational dashboards.
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
              <ShieldCheck className="h-3.5 w-3.5" /> Secure sign-in
            </p>
            <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Sign in to continue to BANTAY-TB.
            </p>
          </div>

          <Card className="mt-6 p-6 sm:p-8">
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                const { error } = await signIn(email, password);
                setLoading(false);
                if (error) {
                  toast.error(error);
                  return;
                }
                toast.success("Signed in");
                navigate("/app");
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Spinner className="h-4 w-4 text-white" /> : "Sign in"}
              </Button>
            </form>
            <div className="mt-5 text-center text-sm text-slate-600">
              New here?{" "}
              <Link
                to="/register"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Request an account
              </Link>
            </div>
          </Card>

          <p className="mt-6 text-center text-xs text-slate-500">
            By signing in you agree to handle patient data in accordance with
            DOH and Davao City Health Office policies.
          </p>
        </div>
      </div>
    </div>
  );
}
