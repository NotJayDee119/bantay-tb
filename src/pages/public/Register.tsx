import { useState } from "react";
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
import { ROLE_LABELS, type AppRole } from "../../lib/supabase";
import barangays from "../../data/barangays.json";

export function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "barangay_admin" as AppRole,
    barangayPsgc: "",
  });
  const [loading, setLoading] = useState(false);

  return (
    <div className="mx-auto flex max-w-md items-center justify-center px-4 py-12">
      <Card className="w-full p-8">
        <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">
          For Barangay Admins, BHWs, doctors, and patients in Davao City.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
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
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
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
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select
              id="role"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as AppRole })
              }
            >
              {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="barangay">
              Barangay
              {form.role === "barangay_admin" || form.role === "health_worker"
                ? " (required)"
                : " (optional)"}
            </Label>
            <Select
              id="barangay"
              required={
                form.role === "barangay_admin" ||
                form.role === "health_worker"
              }
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
            {(form.role === "barangay_admin" ||
              form.role === "health_worker") && (
              <p className="text-xs text-slate-500">
                Frontliners and BHWs/nurses/doctors only see cases, hotspots,
                and patients within their assigned barangay.
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Spinner className="h-4 w-4 text-white" />
            ) : (
              "Create account"
            )}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-600">
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
