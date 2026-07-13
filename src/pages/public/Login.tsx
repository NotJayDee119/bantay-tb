import { useState } from "react";
import { Activity } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  Button,
  Input,
  Label,
  PasswordInput,
  Spinner,
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
      {/* Left panel — photo with typographic overlay */}
      <div className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col">
        <img
          src={loginImage}
          alt="Health workers reviewing case data"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950/95 via-brand-950/60 to-brand-950/30" />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          {/* Logo */}
          <Link to="/" className="inline-flex w-fit items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-white backdrop-blur-sm">
              <Activity className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-white">
              BANTAY-TB
            </span>
          </Link>

          {/* Hero text — anchored to bottom */}
          <div className="max-w-lg">
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="font-display text-[2.75rem] font-extrabold leading-[1.1] tracking-tight text-white"
            >
              Real-time TB
              <br />
              surveillance for
              <br />
              Davao City.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
              className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-slate-300"
            >
              Case tracking, barangay-level hotspot mapping,
              and operational dashboards — built for frontline health workers.
            </motion.p>
          </div>

          {/* Bottom attribution */}
          <p className="text-xs text-white/30">
            Davao City Health Office
          </p>
        </div>

        {/* Decorative accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-500/40 to-transparent" />
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center bg-slate-50 px-5 py-12 sm:px-8 lg:bg-white lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-[380px]"
        >
          {/* Mobile-only logo */}
          <div className="mb-10 lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-950 text-white">
                <Activity className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-slate-900">
                BANTAY-TB
              </span>
            </Link>
          </div>

          {/* Header */}
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Sign in
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Enter your credentials to access the dashboard.
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
                placeholder="you@davaocity.gov.ph"
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

            <Button type="submit" className="!mt-7 w-full" disabled={loading}>
              {loading ? <Spinner className="h-4 w-4 text-white" /> : "Continue"}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative mt-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-50 px-3 text-slate-400 lg:bg-white">
                New to BANTAY-TB?
              </span>
            </div>
          </div>

          <Link
            to="/register"
            className="mt-5 flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-soft transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 lg:bg-slate-50 lg:hover:bg-white"
          >
            Request an account
          </Link>

          {/* Legal */}
          <p className="mt-8 text-center text-[0.6875rem] leading-relaxed text-slate-400">
            By signing in you agree to handle patient data per
            DOH and Davao City Health Office data privacy policies.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
