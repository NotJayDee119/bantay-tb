import { useState } from "react";
import { Activity } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button, Card, Input, Label, Spinner } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-9rem)] max-w-md items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full"
      >
        <Card className="p-8 shadow-lift">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-soft">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                Welcome back
              </h1>
              <p className="text-sm text-slate-600">
                Sign in to continue to BANTAY-TB.
              </p>
            </div>
          </div>
        <form
          className="mt-6 space-y-4"
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
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
              Register
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
