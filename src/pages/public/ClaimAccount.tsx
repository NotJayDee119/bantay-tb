import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Hospital,
  KeyRound,
  UserCheck,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, Input, Label, PasswordInput } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import claimImage from "../../assets/tbdots.jpg";

/**
 * Patients never register — a nurse enrolls them, and the system generates the
 * account from that enrollment. This page is where the patient *claims* the
 * account already waiting for them, using the single-use code on the slip torn
 * off their treatment card.
 *
 * Nothing identifying is asked for here. The name, barangay and facility all
 * come off the case the nurse verified; `redeem_patient_claim` copies them
 * server-side once the account exists.
 */

const CLAIM_INVALID: Record<string, string> = {
  not_found:
    "We couldn't find that code. Check it against your slip, or ask your health worker for a new one.",
  used: "This code has already been used. If that wasn't you, ask your health worker for a new one.",
  expired:
    "This code has expired. Ask your health worker to print you a new slip.",
};

const REDEEM_FAILURE: Record<string, string> = {
  code_unavailable:
    "This code was just used or expired. Ask your health worker for a new one.",
  already_linked: "This account is already linked to a patient record.",
  not_a_patient_account:
    "You're signed in as staff. Sign out first, then claim the account.",
  not_authenticated:
    "Your account needs email confirmation before it can be linked. Confirm your email, then open this page again.",
};

interface ClaimTarget {
  displayName: string | null;
  facilityName: string | null;
}

const STEPS = ["Your code", "Confirm", "Password"] as const;

export function ClaimAccount() {
  const { signUp, reloadProfile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [target, setTarget] = useState<ClaimTarget | null>(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);

  // A scanned QR lands here with the code already in the URL, so the patient
  // types nothing at all. Typing it by hand is the fallback, not the path.
  const codeFromUrl = params.get("code");
  useEffect(() => {
    if (codeFromUrl) setCode(codeFromUrl.toUpperCase());
  }, [codeFromUrl]);

  async function checkCode(e: React.FormEvent) {
    e.preventDefault();
    const entered = code.trim().toUpperCase();
    if (entered.length < 4) {
      toast.error("Please enter the code from your slip.");
      return;
    }

    setChecking(true);
    const { data, error } = await supabase.rpc("validate_patient_claim", {
      p_code: entered,
    });
    setChecking(false);

    if (error) {
      toast.error("Couldn't check that code right now. Please try again.");
      return;
    }

    const result = data?.[0];
    if (!result?.valid) {
      toast.error(
        CLAIM_INVALID[result?.reason ?? ""] ??
          "That code isn't valid. Ask your health worker for a new one."
      );
      return;
    }

    setTarget({
      displayName: result.display_name,
      facilityName: result.facility_name,
    });
    setStep(1);
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Your password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    // The account is created with no name and no area — `redeem_patient_claim`
    // fills both in from the case, so nothing the patient types can contradict
    // what the nurse verified.
    const { error } = await signUp(form.email.trim(), form.password, "");
    if (error) {
      setLoading(false);
      toast.error(error);
      return;
    }

    const { data, error: redeemError } = await supabase.rpc(
      "redeem_patient_claim",
      { p_code: code.trim().toUpperCase() }
    );

    const result = data?.[0];
    if (redeemError || !result?.ok) {
      setLoading(false);
      toast.error(
        REDEEM_FAILURE[result?.reason ?? ""] ??
          "Your account was created, but we couldn't link it to your record. Please ask your health worker."
      );
      return;
    }

    // Redeeming wrote the name, barangay and facility onto the profile from the
    // case. The cached copy still has them empty, and barangay is what scopes
    // everything the patient can see — so re-read before entering the app.
    await reloadProfile();
    setLoading(false);

    toast.success("You're all set — here's your treatment plan.");
    navigate("/app");
  }

  return (
    <div className="grid min-h-[calc(100vh-57px)] grid-cols-1 lg:grid-cols-2">
      {/* Left panel — quiet, reassuring, and explicit that they were expected */}
      <div className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col">
        <img
          src={claimImage}
          alt="A patient collecting their TB medicine at a DOTS centre"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950/95 via-brand-950/70 to-brand-950/40" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-vigil-grid" />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-[-20%] h-[28rem] w-[28rem] rounded-full bg-accent-500/15 blur-[110px]"
        />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          <Link to="/" className="inline-flex w-fit items-center gap-2.5">
            <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.08] text-white backdrop-blur-sm">
              <Activity className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-950 bg-vigil-400" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-white">
              BANTAY-TB
            </span>
          </Link>

          <div className="max-w-lg">
            <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-300">
              <span className="h-1.5 w-1.5 rounded-full bg-vigil-400" />
              Your account is already waiting
            </p>
            <h2 className="font-display mt-5 text-[2.75rem] font-extrabold leading-[1.1] tracking-tight text-white">
              You don&rsquo;t need
              <br />
              to sign up.
            </h2>
            <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-slate-300">
              Your health worker already set up your account when they started
              your treatment. Enter the code from your slip and choose a
              password &mdash; your medicine schedule is waiting inside.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — the form */}
      <div className="flex items-center justify-center bg-slate-50 px-5 py-12 lg:bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-950 text-white">
                <Activity className="h-4.5 w-4.5" />
              </span>
              <span className="font-display text-base font-extrabold tracking-tight text-brand-950">
                BANTAY-TB
              </span>
            </Link>
          </div>

          {/* Step rail */}
          <ol className="mb-7 flex items-center gap-2" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  aria-current={i === step ? "step" : undefined}
                  className={
                    "flex h-1.5 flex-1 rounded-full transition-colors " +
                    (i <= step ? "bg-accent-500" : "bg-slate-200")
                  }
                />
              </li>
            ))}
          </ol>

          {step === 0 && (
            <form onSubmit={checkCode} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
                  Enter your code
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  It&rsquo;s the 8-letter code on the slip your health worker
                  gave you.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="claim-code">Claim code</Label>
                <Input
                  id="claim-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="K7MR4PQ9"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="text-center font-mono text-xl font-bold tracking-[0.3em]"
                />
              </div>

              <Button type="submit" className="w-full gap-2" loading={checking}>
                {!checking && <KeyRound className="h-4 w-4" />}
                Continue
              </Button>

              <p className="text-center text-xs leading-relaxed text-slate-400">
                Don&rsquo;t have a code? Your health worker gives you one when
                you start treatment &mdash; ask for it at your DOTS centre.
              </p>
            </form>
          )}

          {step === 1 && target && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
                  Is this you?
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Check that this is your record before you continue.
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-600">
                    <UserCheck className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Patient
                    </div>
                    <div className="truncate font-display text-lg font-bold tracking-tight text-slate-900">
                      {target.displayName ?? "Your record"}
                    </div>
                  </div>
                </div>
                {target.facilityName && (
                  <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                      <Hospital className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        DOTS centre
                      </div>
                      <div className="truncate text-sm font-semibold text-slate-700">
                        {target.facilityName}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 gap-2"
                  onClick={() => {
                    setTarget(null);
                    setStep(0);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  No, go back
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-2"
                  onClick={() => setStep(2)}
                >
                  Yes, that&rsquo;s me
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={finish} className="space-y-5">
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
                  Choose a password
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  This is how you&rsquo;ll sign in from now on.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="claim-email">Email</Label>
                <Input
                  id="claim-email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                />
                <p className="text-xs leading-relaxed text-slate-400">
                  No email? You can skip creating an account &mdash; your health
                  worker will keep tracking your treatment either way.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="claim-password">Password</Label>
                <PasswordInput
                  id="claim-password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="At least 6 characters"
                />
              </div>

              <Button type="submit" className="w-full gap-2" loading={loading}>
                {!loading && <CheckCircle2 className="h-4 w-4" />}
                Finish and see my plan
              </Button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-xs text-slate-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-brand-700 hover:text-brand-800"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
