import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Button,
  Input,
  Label,
  PasswordInput,
  Select,
} from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { supabase, ROLE_LABELS, type AppRole } from "../../lib/supabase";
import barangays from "../../data/barangays.json";
import dotsImage from "../../assets/dots.webp";

const STAFF_ROLES: AppRole[] = [
  "tb_coordinator",
  "barangay_admin",
  "health_worker",
];

const STEPS = ["Credentials", "Confirm"] as const;

const INVALID_REASON: Record<string, string> = {
  not_found: "Invalid invite code. Double-check it with your TB coordinator.",
  used: "This invite code has already been used. Ask for a new one.",
  expired:
    "This invite code has expired (codes last 24 hours). Ask your TB coordinator for a new one.",
};

/** Why `claim_staff_role` refused to assign the role. */
const CLAIM_FAILURE: Record<string, string> = {
  code_unavailable:
    "This invite code was just used or expired. Ask your TB coordinator for a new one.",
  already_assigned:
    "This account already has a role. Sign in instead, or ask a system admin to change it.",
  barangay_required: "Please select your assigned barangay.",
  role_not_allowed:
    "That role can't be self-assigned. Ask a system admin to set it up for you.",
  not_authenticated:
    "Your account needs email confirmation before its role can be assigned. Confirm your email, then contact your TB coordinator.",
};

export function StaffRegister() {
  const { signUp, reloadProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "health_worker" as AppRole,
    barangayPsgc: "",
    facilityId: "",
    inviteCode: "",
  });
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [facilities, setFacilities] = useState<
    { id: string; name: string }[]
  >([]);

  const needsBarangay =
    form.role === "barangay_admin" || form.role === "health_worker";
  // Only a health centre account reads by facility. A barangay admin covers
  // residents, so offering them a facility would promise a view they don't get.
  const needsFacility = form.role === "health_worker";

  // `dots_centers` is world-readable, so this loads before sign-in.
  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("dots_centers")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (!cancelled) setFacilities(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function goNext() {
    const code = form.inviteCode.trim();
    if (!code) {
      toast.error("Please enter your invite code.");
      return;
    }
    if (!form.fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Please enter your work email.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    // Verify the code is real, unused, and unexpired before advancing. This is
    // a non-consuming check — the code is only redeemed on final submit. An
    // invalid code blocks the Confirm step entirely.
    setValidating(true);
    const { data, error } = await supabase.rpc("validate_invite_code", {
      p_code: code,
    });
    setValidating(false);

    if (error) {
      toast.error("Could not verify invite code. Please try again.");
      return;
    }
    const result = data?.[0];
    if (!result || !result.valid) {
      toast.error(INVALID_REASON[result?.reason ?? ""] ?? "Invalid invite code.");
      return;
    }

    setStep(1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsBarangay && !form.barangayPsgc) {
      toast.error("Please select your assigned barangay.");
      return;
    }
    setLoading(true);

    // signUp only ever creates a `patient` account — the role is not something
    // the client can ask for. Promotion happens in the RPC below, where the
    // invite code is verified server-side.
    const { error, confirmed } = await signUp(
      form.email,
      form.password,
      form.fullName
    );

    if (error) {
      setLoading(false);
      toast.error(error);
      return;
    }

    // Consume the code and receive the role in one call. The DB burns the code
    // atomically, so it stays single-use even if two people raced the same code
    // through the Confirm step — and if the burn fails, no role is granted.
    const { data: claim, error: claimError } = await supabase.rpc(
      "claim_staff_role",
      {
        p_code: form.inviteCode.trim(),
        p_role: form.role,
        p_barangay_psgc: form.barangayPsgc ? Number(form.barangayPsgc) : null,
        p_facility_id:
          needsFacility && form.facilityId ? form.facilityId : null,
      }
    );

    const result = claim?.[0];
    if (claimError || !result?.ok) {
      setLoading(false);
      toast.error(
        CLAIM_FAILURE[result?.reason ?? ""] ??
          "Your account was created, but its role could not be assigned. Contact your TB coordinator."
      );
      return;
    }

    // The session was established by signUp, so the cached profile was read
    // back while the trigger's `patient` default was still on it. Without this
    // re-read the app renders the patient dashboard for a health worker —
    // the role only became correct once the RPC above ran.
    await reloadProfile();

    setLoading(false);
    if (confirmed) {
      toast.success("Staff account created. Welcome to BANTAY-TB!");
      navigate("/app");
    } else {
      toast.success(
        "Account created. Check your email to confirm, then sign in."
      );
      navigate("/login");
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-57px)] grid-cols-1 lg:grid-cols-2">
      {/* Left panel — photo with the surveillance treatment */}
      <div className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col">
        <img
          src={dotsImage}
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
              Davao City Health Office &middot; Staff
            </p>
            <h2 className="font-display mt-5 text-[2.75rem] font-extrabold leading-[1.1] tracking-tight text-white">
              Join the
              <br />
              BANTAY-TB team.
            </h2>
            <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-slate-300">
              For TB coordinators, barangay admins, BHWs, nurses, and doctors
              of the Davao City Health Office.
            </p>

            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 backdrop-blur-sm">
              <KeyRound className="h-3.5 w-3.5 text-accent-400" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                Invite-only &middot; single-use codes
              </span>
            </div>
          </div>

          <p className="text-xs text-white/30">Davao City Health Office</p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-500/40 to-transparent" />
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center bg-slate-50 px-5 py-12 sm:px-8 lg:bg-white lg:px-12">
        <div className="w-full max-w-[420px]">
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

          {/* Header */}
          <div>
            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(0)}
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">
              Health workers &amp; staff
            </p>
            <h1 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
              Staff registration
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {step === 0
                ? "Enter the invite code from your TB coordinator and your login details."
                : "Select your role and the area you cover, then create your account."}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mt-6 flex items-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex flex-1 flex-col gap-1.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-accent-500 transition-all duration-500"
                    style={{ width: i <= step ? "100%" : "0%" }}
                  />
                </div>
                <span className={`font-mono text-[0.625rem] font-semibold uppercase tracking-wider ${i <= step ? "text-accent-700" : "text-slate-400"}`}>
                  {i + 1}. {label}
                </span>
              </div>
            ))}
          </div>

          {/* Steps */}
          <form onSubmit={step === 0 ? (e) => { e.preventDefault(); void goNext(); } : handleSubmit}>
              {step === 0 && (
                <div className="step-in-left mt-6 space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="inviteCode">
                      Invite code <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="inviteCode"
                        required
                        autoComplete="off"
                        autoCapitalize="characters"
                        className="pl-9 font-mono uppercase tracking-widest"
                        placeholder="From your TB coordinator"
                        value={form.inviteCode}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            inviteCode: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Don&apos;t have one? Contact your TB coordinator to be
                      issued a single-use code.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      required
                      value={form.fullName}
                      onChange={(e) =>
                        setForm({ ...form, fullName: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">Work email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <PasswordInput
                      id="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                    />
                    <p className="text-xs text-slate-400">
                      Minimum 6 characters.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="!mt-7 w-full gap-2"
                    loading={validating}
                  >
                    {validating ? "Verifying code…" : "Continue"}
                    {!validating && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </div>
              )}

              {step === 1 && (
                <div className="step-in-right mt-6 space-y-5">
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-sm font-medium text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Invite code verified
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      id="role"
                      value={form.role}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          role: e.target.value as AppRole,
                        })
                      }
                    >
                      {STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="barangay">
                      Assigned barangay{" "}
                      {needsBarangay ? (
                        <span className="text-red-500">*</span>
                      ) : (
                        <span className="font-normal text-slate-400">(optional)</span>
                      )}
                    </Label>
                    <Select
                      id="barangay"
                      required={needsBarangay}
                      value={form.barangayPsgc}
                      onChange={(e) =>
                        setForm({ ...form, barangayPsgc: e.target.value })
                      }
                    >
                      <option value="">Select barangay</option>
                      {barangays.map((b) => (
                        <option key={b.psgc} value={b.psgc}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                    {needsBarangay && (
                      <p className="text-xs text-slate-400">
                        {needsFacility
                          ? "You will see the cases of people living in this barangay."
                          : "You will only see cases and patients within this barangay."}
                      </p>
                    )}
                  </div>

                  {needsFacility && (
                    <div className="space-y-1.5">
                      <Label htmlFor="facility">
                        DOTS facility{" "}
                        <span className="font-normal text-slate-400">
                          (if you are posted to one)
                        </span>
                      </Label>
                      <Select
                        id="facility"
                        value={form.facilityId}
                        onChange={(e) =>
                          setForm({ ...form, facilityId: e.target.value })
                        }
                      >
                        <option value="">— Not posted to a facility —</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-slate-400">
                        Adds every case your facility registered, including
                        patients who live in other barangays. Leave blank if you
                        work in the community rather than at a clinic — a
                        coordinator can set it later.
                      </p>
                    </div>
                  )}

                  <Button type="submit" className="!mt-7 w-full" loading={loading}>
                    {loading ? "Creating account…" : "Create staff account"}
                  </Button>
                </div>
              )}
          </form>

          {/* Divider */}
          <div className="relative mt-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-50 px-3 text-slate-400 lg:bg-white">
                Already have an account?
              </span>
            </div>
          </div>

          <Link
            to="/login"
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 lg:bg-slate-50 lg:hover:bg-white"
          >
            Sign in instead
          </Link>

          {/* Patients don't create accounts — a nurse enrolls them and the
              system generates one, which they claim with a code. */}
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 lg:bg-white">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-50 text-accent-700 ring-1 ring-accent-100">
              <Activity className="h-4 w-4" />
            </span>
            <p className="text-xs text-slate-500">
              Are you a patient?{" "}
              <Link
                to="/claim"
                className="font-semibold text-brand-700 transition hover:text-brand-800"
              >
                Claim your account
              </Link>{" "}
              with the code your health worker gave you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
