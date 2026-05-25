import { useState } from "react";
import { Activity, KeyRound, Stethoscope } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Button,
  Card,
  Input,
  Label,
  PasswordInput,
  Select,
  Spinner,
} from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import { ROLE_LABELS, type AppRole } from "../../lib/supabase";
import barangays from "../../data/barangays.json";

// Roles that can self-register on this page. System administrators are NEVER
// created via this flow.
const STAFF_ROLES: AppRole[] = [
  "tb_coordinator",
  "barangay_admin",
  "health_worker",
];

const REQUIRED_INVITE_CODE = (import.meta.env.VITE_STAFF_INVITE_CODE ?? "")
  .toString()
  .trim();

export function StaffRegister() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "health_worker" as AppRole,
    barangayPsgc: "",
    inviteCode: "",
  });
  const [loading, setLoading] = useState(false);

  const needsBarangay =
    form.role === "barangay_admin" || form.role === "health_worker";

  return (
    <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 lg:grid-cols-2">
      {/* Photo column */}
      <div className="relative hidden overflow-hidden bg-brand-800 lg:block">
        <img
          src="/images/for-workers.jpg"
          alt="Health workers reviewing case data"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/80 via-brand-800/70 to-brand-700/50" />
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
              Join the BANTAY-TB team.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-100">
              For TB coordinators, barangay admins, BHWs, nurses, and doctors
              of the Davao City Health Office. An invite code from your
              coordinator is required.
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
              <Stethoscope className="h-3.5 w-3.5" /> Staff account
            </p>
            <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Create a health-worker account
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Restricted to authorised Davao City Health Office staff. Please
              enter the invite code provided by your coordinator.
            </p>
          </div>

          <Card className="mt-6 p-6 sm:p-8">
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!REQUIRED_INVITE_CODE) {
                  toast.error(
                    "Staff registration is not configured. Please contact the TB coordinator."
                  );
                  return;
                }
                if (form.inviteCode.trim() !== REQUIRED_INVITE_CODE) {
                  toast.error("Invalid invite code.");
                  return;
                }
                if (needsBarangay && !form.barangayPsgc) {
                  toast.error("Please select your assigned barangay.");
                  return;
                }
                setLoading(true);
                const { error } = await signUp(
                  form.email,
                  form.password,
                  form.fullName,
                  form.role,
                  form.barangayPsgc ? Number(form.barangayPsgc) : null
                );
                setLoading(false);
                if (error) {
                  toast.error(error);
                  return;
                }
                toast.success(
                  "Account created. Check your email to confirm if required."
                );
                navigate("/login");
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="inviteCode">
                  Invite code <span className="text-red-600">*</span>
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="inviteCode"
                    required
                    autoComplete="off"
                    className="pl-9"
                    placeholder="From your TB coordinator"
                    value={form.inviteCode}
                    onChange={(e) =>
                      setForm({ ...form, inviteCode: e.target.value })
                    }
                  />
                </div>
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
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                    <span className="text-red-600">*</span>
                  ) : (
                    <span className="text-slate-500">(optional)</span>
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
                  <option value="">— select —</option>
                  {barangays.map((b) => (
                    <option key={b.psgc} value={b.psgc}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                {needsBarangay && (
                  <p className="text-xs text-slate-500">
                    Frontliners and BHWs only see cases, hotspots, and patients
                    within their assigned barangay.
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Spinner className="h-4 w-4 text-white" />
                ) : (
                  "Create staff account"
                )}
              </Button>
            </form>
            <div className="mt-5 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                Sign in
              </Link>
            </div>
          </Card>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Not a health worker?{" "}
            <Link
              to="/register"
              className="font-semibold text-brand-700 hover:text-brand-800"
            >
              Create a patient account →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
