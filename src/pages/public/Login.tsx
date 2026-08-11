import { useState } from "react";
import { Activity, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Button,
  Input,
  Label,
  PasswordInput,
} from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import loginImage from "../../assets/login.jpg";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="grid min-h-[calc(100vh-57px)] grid-cols-1 lg:grid-cols-2">
      {/* Left panel — photo with the surveillance treatment */}
      <div className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col">
        <img
          src={loginImage}
          alt="Health workers reviewing case data"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950/95 via-brand-950/65 to-brand-950/40" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid" />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-[-20%] h-[28rem] w-[28rem] rounded-full bg-accent-500/15 blur-[110px]"
        />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          {/* Logo */}
          <Link to="/" className="inline-flex w-fit items-center gap-2.5">
            <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.08] text-white backdrop-blur-sm">
              <Activity className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-950 bg-vigil-400" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-white">
              BANTAY-TB
            </span>
          </Link>

          {/* Hero text — anchored to bottom */}
          <div className="max-w-lg">
            <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
              <span className="h-1.5 w-1.5 rounded-full bg-vigil-400" />
              Davao City Health Office &middot; TB Surveillance
            </p>
            <h2 className="font-display mt-5 text-[2.75rem] font-extrabold leading-[1.1] tracking-tight text-white">
              The city&rsquo;s TB picture,
              <br />
              in one place.
            </h2>
            <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-slate-300">
              Case tracking and barangay-level hotspot mapping for frontline
              health workers — and a daily medicine schedule for patients on
              treatment.
            </p>

            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-400" />
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                Surveillance active &middot; 182 barangays
              </span>
            </div>
          </div>

          {/* Bottom attribution */}
          <p className="text-xs text-white/30">Davao City Health Office</p>
        </div>

        {/* Decorative accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-500/40 to-transparent" />
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center bg-slate-50 px-5 py-12 sm:px-8 lg:bg-white lg:px-12">
        <div className="w-full max-w-[380px]">
          {/* Mobile-only logo */}
          <div className="mb-10 lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-brand-950 text-white shadow-soft">
                <Activity className="h-5 w-5" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-50 bg-vigil-400" />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">
                BANTAY-TB
              </span>
            </Link>
          </div>

          {/* Header. One form serves both audiences — a patient who has
              claimed their account signs in with the same email and password a
              nurse does, and lands on the patient home. The copy used to say
              "Health worker access", which told returning patients, wrongly,
              that this page was not for them. */}
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
              BANTAY-TB access
            </p>
            <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Health workers and patients sign in here.
            </p>
          </div>

          {/* Form */}
          <form
            className="mt-8 space-y-5"
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
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@email.com"
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
                  className="text-xs font-medium text-slate-500 transition hover:text-brand-700"
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

            <Button
              type="submit"
              className="!mt-7 w-full gap-2"
              loading={loading}
            >
              {loading ? (
                "Signing in…"
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative mt-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-50 px-3 text-slate-400 lg:bg-white">
                Starting treatment?
              </span>
            </div>
          </div>

          {/* Patients don't sign up — they claim the account their nurse
              generated when they were enrolled. */}
          <Link
            to="/claim"
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 lg:bg-slate-50 lg:hover:bg-white"
          >
            I have a claim code
          </Link>

          {/* The claim code is a one-time thing. Without this line a patient
              coming back for their second dose reads the button above as the
              only door open to them and tries to claim an account twice. */}
          <p className="mt-3 text-center text-xs text-slate-500">
            Already claimed your account? Sign in with your email above.
          </p>

          {/* Staff onboarding is invite-gated, so it stays a quiet link rather
              than a second button competing with the patient path. */}
          <p className="mt-4 text-center text-xs text-slate-500">
            Health worker with an invite code?{" "}
            <Link
              to="/register/staff"
              className="font-semibold text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline"
            >
              Register a staff account
            </Link>
          </p>

          {/* Legal */}
          <p className="mt-8 text-center text-[0.6875rem] leading-relaxed text-slate-400">
            By signing in you agree to handle patient data per DOH and Davao
            City Health Office data privacy policies.
          </p>
        </div>
      </div>
    </div>
  );
}
