import { useState } from "react";
import { Activity, ArrowLeft, MapPin, Phone } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Button,
  Input,
  Label,
  PasswordInput,
  Select,
  Spinner,
} from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import barangays from "../../data/barangays.json";
import tbdotsImage from "../../assets/tbdots.jpg";

const STEPS = ["Account", "Details"] as const;

export function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    barangayPsgc: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);

  function goNext() {
    if (!form.fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Please enter your email.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setStep(1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.barangayPsgc) {
      toast.error("Please select your barangay.");
      return;
    }
    setLoading(true);
    const { error, confirmed } = await signUp(
      form.email,
      form.password,
      form.fullName,
      "patient",
      Number(form.barangayPsgc),
      form.phone.trim() || null
    );
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (confirmed) {
      toast.success("Account created. Welcome to BANTAY-TB!");
      navigate("/app");
    } else {
      toast.success(
        "Account created. Check your email to confirm, then sign in."
      );
      navigate("/login");
    }
  }

  return (
    <div className="grid h-[calc(100vh-57px)] grid-cols-1 lg:grid-cols-2">
      {/* Left panel */}
      <div className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col">
        <img
          src={tbdotsImage}
          alt="A community health worker checking a patient"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950/95 via-brand-950/60 to-brand-950/30" />

        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          <Link to="/" className="inline-flex w-fit items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-white backdrop-blur-sm">
              <Activity className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-white">
              BANTAY-TB
            </span>
          </Link>

          <div className="max-w-lg">
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="font-display text-[2.75rem] font-extrabold leading-[1.1] tracking-tight text-white"
            >
              Stay informed.
              <br />
              Stay supported.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
              className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-slate-300"
            >
              Follow your DOTS treatment, receive medication reminders,
              and access trusted TB health information.
            </motion.p>
          </div>

          <p className="text-xs text-white/30">Davao City Health Office</p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-500/40 to-transparent" />
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center bg-slate-50 px-5 py-12 sm:px-8 lg:bg-white lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-[420px]"
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
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              {step === 0
                ? "Start with your login credentials."
                : "Just a few more details to connect you with local care."}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mt-6 flex items-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex flex-1 flex-col gap-1.5">
                <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-brand-600"
                    initial={false}
                    animate={{ width: i <= step ? "100%" : "0%" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
                <span className={`text-[0.6875rem] font-medium ${i <= step ? "text-brand-700" : "text-slate-400"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Steps */}
          <form onSubmit={step === 0 ? (e) => { e.preventDefault(); goNext(); } : handleSubmit}>
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="step-0"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="mt-6 space-y-5"
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
                    <Label htmlFor="email">Email address</Label>
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

                  <Button type="submit" className="!mt-7 w-full">
                    Continue
                  </Button>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="mt-6 space-y-5"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">
                      Mobile number{" "}
                      <span className="font-normal text-slate-400">(optional)</span>
                    </Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="+63 9XX XXX XXXX"
                        className="pl-9"
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      For SMS medication reminders — works on basic phones.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="barangay">
                      Barangay <span className="text-red-500">*</span>
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
                        <option value="">Select your barangay</option>
                        {barangays.map((b) => (
                          <option key={b.psgc} value={b.psgc}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <p className="text-xs text-slate-400">
                      Links you to your local health workers for TB care support.
                    </p>
                  </div>

                  <Button type="submit" className="!mt-7 w-full" disabled={loading}>
                    {loading ? (
                      <Spinner className="h-4 w-4 text-white" />
                    ) : (
                      "Create account"
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
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
            className="mt-5 flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-soft transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 lg:bg-slate-50 lg:hover:bg-white"
          >
            Sign in instead
          </Link>

          {/* Staff callout */}
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 lg:bg-white">
            Davao City health worker?{" "}
            <Link
              to="/register/staff"
              className="font-medium text-brand-700 transition hover:text-brand-800"
            >
              Register as staff
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
