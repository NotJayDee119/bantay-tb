import { useState } from "react";
import { Activity, MapPin, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Spinner,
} from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import barangays from "../../data/barangays.json";

export function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    barangayPsgc: "",
  });
  const [loading, setLoading] = useState(false);

  return (
    <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 lg:grid-cols-2">
      {/* Photo column */}
      <div className="relative hidden overflow-hidden bg-brand-700 lg:block">
        <img
          src="/images/for-patients.jpg"
          alt="A community health worker checking a patient"
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
              For patients &amp; families
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight">
              Stay informed. Stay supported.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-100">
              Create a free patient account to follow your DOTS treatment,
              receive reminders, and access trusted TB information.
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
              <ShieldCheck className="h-3.5 w-3.5" /> Patient account
            </p>
            <h1 className="font-display mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Free patient access to BANTAY-TB. No medical information is shared
              without your consent.
            </p>
          </div>

          <Card className="mt-6 p-6 sm:p-8">
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!form.barangayPsgc) {
                  toast.error("Please select your barangay.");
                  return;
                }
                setLoading(true);
                const { error } = await signUp(
                  form.email,
                  form.password,
                  form.fullName,
                  "patient",
                  Number(form.barangayPsgc)
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
                <Label htmlFor="email">Email</Label>
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
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
                <p className="text-xs text-slate-500">
                  Minimum 6 characters.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="barangay">
                  Your barangay <span className="text-red-600">*</span>
                </Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Select
                    id="barangay"
                    required
                    className="pl-9"
                    value={form.barangayPsgc}
                    onChange={(e) =>
                      setForm({ ...form, barangayPsgc: e.target.value })
                    }
                  >
                    <option value="">— select your barangay —</option>
                    {barangays.map((b) => (
                      <option key={b.psgc} value={b.psgc}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <p className="text-xs text-slate-500">
                  Davao City health workers in your barangay can then monitor
                  and support your TB care.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Spinner className="h-4 w-4 text-white" />
                ) : (
                  "Create patient account"
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
            Are you a Davao City health worker (TB coordinator, BHW, nurse, or
            doctor)?{" "}
            <Link
              to="/register/staff"
              className="font-semibold text-brand-700 hover:text-brand-800"
            >
              Register as staff →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
