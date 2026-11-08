import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Label, PasswordInput } from "./ui";
import { supabase } from "../lib/supabase";
import { readFunctionError } from "../lib/functionError";
import { useAuth } from "../hooks/useAuth";

const MIN = 8;

/**
 * Shown instead of the app while the account is on a temporary password an
 * admin or coordinator issued. The person who issued it has seen it, so it
 * must not survive the first sign-in.
 */
export function ForcePasswordChange() {
  const { profile, reloadProfile, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN) {
      setError(`Use at least ${MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setError(null);
    setSaving(true);
    const { error: fnError } = await supabase.functions.invoke("staff-password", {
      body: { action: "complete", password },
    });
    if (fnError) {
      setSaving(false);
      setError(await readFunctionError(fnError));
      return;
    }
    await reloadProfile();
    setSaving(false);
    toast.success("Password changed");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-soft">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <KeyRound className="h-5 w-5" />
        </span>
        <h1 className="mt-4 font-display text-lg font-bold text-slate-900">
          Choose a new password
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          You signed in with a temporary password. Pick your own before you
          continue. Only you will know it.
        </p>
        {profile?.email && (
          <p className="mt-3 text-xs text-slate-500">
            Account: <span className="font-medium text-slate-700">{profile.email}</span>
          </p>
        )}

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="force-new-password">New password</Label>
            <PasswordInput
              id="force-new-password"
              autoComplete="new-password"
              required
              minLength={MIN}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-slate-500">At least {MIN} characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="force-confirm-password">Type it again</Label>
            <PasswordInput
              id="force-confirm-password"
              autoComplete="new-password"
              required
              minLength={MIN}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={saving}>
            {!saving && <ShieldCheck className="h-4 w-4" />}
            Save password
          </Button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full text-center text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
