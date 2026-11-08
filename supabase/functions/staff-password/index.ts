// Admin-assisted password reset for staff accounts.
//
// Two actions, both POSTed as JSON:
//
//   { action: "reset", user_id }   Issue a temporary password for another
//                                  account. Returned once, in this response,
//                                  and never stored anywhere readable.
//   { action: "complete", password }
//                                  The signed-in user replaces the temporary
//                                  password with their own. Only allowed while
//                                  their profile has must_change_password.
//
// Who may reset whom:
//   system_admin    any account except their own (they use "Forgot password?")
//   tb_coordinator  health_worker and barangay_admin accounts only
//   anyone else     nobody
//
// The auth change itself needs the service role (GoTrue admin API), which is
// why this lives server-side. The caller is identified from their own JWT,
// never from the request body. See
// supabase/migrations/20261108000000_staff_password_reset.sql for the flag.

import { corsHeaders } from "../_shared/cors.ts";
import { dbFromEnv, dbSelect, dbUpdate, type DbConfig } from "../_shared/db.ts";
import { canReset, temporaryPassword, type StaffRole } from "../_shared/staffPassword.ts";

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: StaffRole;
  must_change_password: boolean;
}

const MIN_PASSWORD = 8;
// bcrypt ignores everything past 72 bytes; refuse rather than silently truncate.
const MAX_PASSWORD = 72;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      // The reset response carries a live password.
      "Cache-Control": "no-store",
    },
  });
}

/** Resolve the caller from their own access token. */
async function callerId(cfg: DbConfig, authHeader: string): Promise<string | null> {
  const res = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: cfg.key },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ?? null;
}

async function loadProfile(cfg: DbConfig, id: string): Promise<ProfileRow | null> {
  const rows = await dbSelect<ProfileRow>(
    cfg,
    "profiles",
    `id=eq.${encodeURIComponent(id)}&select=id,email,full_name,role,must_change_password`
  );
  return rows[0] ?? null;
}

/** Set a password through the GoTrue admin API. Returns GoTrue's message on failure. */
async function setPassword(cfg: DbConfig, userId: string, password: string): Promise<string | null> {
  const res = await fetch(`${cfg.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  if (res.ok) return null;
  try {
    const body = (await res.json()) as { msg?: string; message?: string; error_description?: string };
    return body.msg ?? body.message ?? body.error_description ?? `auth error ${res.status}`;
  } catch {
    return `auth error ${res.status}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const cfg = dbFromEnv({ requireServiceRole: true });
  if (!cfg) return json(500, { error: "Server is missing its Supabase configuration" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Sign in first" });

  let body: { action?: string; user_id?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Request body must be JSON" });
  }

  try {
    const uid = await callerId(cfg, authHeader);
    if (!uid) return json(401, { error: "Your session has expired. Sign in again." });
    const actor = await loadProfile(cfg, uid);
    if (!actor) return json(403, { error: "No profile for this account" });

    if (body.action === "reset") {
      const targetId = body.user_id;
      if (!targetId || !/^[0-9a-f-]{36}$/i.test(targetId)) {
        return json(400, { error: "user_id is required" });
      }
      if (targetId === uid) {
        return json(400, {
          error: "You can't reset your own password here. Use “Forgot password?” on the sign-in page.",
        });
      }
      const target = await loadProfile(cfg, targetId);
      if (!target) return json(404, { error: "User not found" });
      if (!canReset(actor.role, target.role)) {
        return json(403, {
          error:
            actor.role === "tb_coordinator"
              ? "Coordinators can only reset passwords for health workers and barangay admins."
              : "You don't have permission to reset passwords.",
        });
      }

      const temp = temporaryPassword();
      const authError = await setPassword(cfg, targetId, temp);
      if (authError) return json(502, { error: `Could not set the password: ${authError}` });

      await dbUpdate(cfg, "profiles", `id=eq.${encodeURIComponent(targetId)}`, {
        must_change_password: true,
        password_reset_at: new Date().toISOString(),
        password_reset_by: uid,
      });

      return json(200, {
        ok: true,
        temporary_password: temp,
        user: { id: target.id, email: target.email, full_name: target.full_name },
      });
    }

    if (body.action === "complete") {
      if (!actor.must_change_password) {
        return json(409, { error: "There is no temporary password to replace on this account." });
      }
      const password = body.password ?? "";
      if (password.length < MIN_PASSWORD) {
        return json(400, { error: `Password must be at least ${MIN_PASSWORD} characters.` });
      }
      if (new TextEncoder().encode(password).length > MAX_PASSWORD) {
        return json(400, { error: `Password must be at most ${MAX_PASSWORD} characters.` });
      }

      const authError = await setPassword(cfg, uid, password);
      if (authError) return json(400, { error: authError });

      await dbUpdate(cfg, "profiles", `id=eq.${encodeURIComponent(uid)}`, {
        must_change_password: false,
      });
      return json(200, { ok: true });
    }

    return json(400, { error: 'action must be "reset" or "complete"' });
  } catch (err) {
    console.error("staff-password:", err);
    return json(500, { error: "Something went wrong. Try again." });
  }
});
