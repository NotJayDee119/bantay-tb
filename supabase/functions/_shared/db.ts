// Minimal PostgREST helpers — used by Edge Functions in place of @supabase/supabase-js
// because the Management-API deploy path runs functions with `--no-remote`, which
// blocks remote ESM imports. These wrappers are intentionally narrow: only the
// CRUD verbs the BANTAY-TB Edge Functions need (select, insert).

export interface DbConfig {
  url: string;
  key: string; // service_role for server-side writes
}

export function dbFromEnv(): DbConfig | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return { url, key };
}

function headers(cfg: DbConfig, extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function dbSelect<T = Record<string, unknown>>(
  cfg: DbConfig,
  table: string,
  query: string = ""
): Promise<T[]> {
  const sep = query ? (query.startsWith("?") ? "" : "?") : "";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${sep}${query}`, {
    method: "GET",
    headers: headers(cfg),
  });
  if (!res.ok) throw new Error(`db select ${table}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

export async function dbInsert<T = Record<string, unknown>>(
  cfg: DbConfig,
  table: string,
  rows: T | T[],
  options: { returning?: boolean } = {}
): Promise<T[]> {
  const arr = Array.isArray(rows) ? rows : [rows];
  const prefer = options.returning === false ? "return=minimal" : "return=representation";
  const res = await fetch(`${cfg.url}/rest/v1/${table}`, {
    method: "POST",
    headers: headers(cfg, { Prefer: prefer }),
    body: JSON.stringify(arr),
  });
  if (!res.ok) throw new Error(`db insert ${table}: ${res.status} ${await res.text()}`);
  if (options.returning === false) return [];
  return (await res.json()) as T[];
}

export async function dbUpdate(
  cfg: DbConfig,
  table: string,
  query: string,
  patch: Record<string, unknown>
): Promise<void> {
  const sep = query.startsWith("?") ? "" : "?";
  const res = await fetch(`${cfg.url}/rest/v1/${table}${sep}${query}`, {
    method: "PATCH",
    headers: headers(cfg, { Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`db update ${table}: ${res.status} ${await res.text()}`);
}
