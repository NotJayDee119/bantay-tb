import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    <div className="mx-auto flex max-w-md items-center justify-center px-4 py-12">
      <Card className="w-full p-8">
        <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          For Barangay Admins, BHWs, doctors, and TB Coordinators.
        </p>
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
        <div className="mt-4 text-center text-sm text-slate-600">
          New here?{" "}
          <Link to="/register" className="font-medium text-brand-600">
            Register
          </Link>
        </div>
      </Card>
    </div>
  );
}
