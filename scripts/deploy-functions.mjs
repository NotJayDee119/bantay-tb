#!/usr/bin/env node
/**
 * Deploy BANTAY-TB Edge Functions via the Supabase Management API.
 *
 * The standard CLI path (`supabase functions deploy`) requires Docker to bundle
 * the function with eszip. This box hits ECR rate limits, so instead we inline
 * the `_shared/*` imports and POST the resulting single-file source to the
 * Management API at /v1/projects/{ref}/functions, which accepts `body: string`.
 *
 * Required env: SUPABASE_URL, SUPABASE_ACCESS_TOKEN.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const url = process.env.SUPABASE_URL;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!url || !token) {
  console.error("Missing SUPABASE_URL or SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}
const ref = url.replace(/^https:\/\//, "").replace(/\.supabase\.co.*$/, "");

/** Inline `import { X } from "../_shared/Y.ts"` statements into a single file. */
function inline(entryPath) {
  const seen = new Set();
  function load(p) {
    p = resolve(p);
    if (seen.has(p)) return "";
    seen.add(p);
    const src = readFileSync(p, "utf8");
    return src.replace(
      /^import\s+(?:type\s+)?(\{[^}]+\}|[A-Za-z_*][\w]*)\s+from\s+"((?:\.\/|\.\.\/)[^"]+)";?\s*$/gm,
      (_match, _binding, rel) => {
        const target = resolve(dirname(p), rel);
        // Strip `export ` from the inlined module to keep top-level scope clean.
        return load(target).replace(/^export\s+/gm, "");
      }
    );
  }
  return load(entryPath);
}

async function deploy(slug) {
  const body = inline(`supabase/functions/${slug}/index.ts`);
  const verifyJwt = slug !== "chatbot"; // chatbot is called from authed UI but accepts anonymous too.
  // Try update first; fall back to create.
  const update = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/functions/${slug}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body, verify_jwt: verifyJwt }),
    }
  );
  if (update.ok) {
    console.log(`✓ updated ${slug}`);
    return;
  }
  if (update.status === 404) {
    const create = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/functions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          name: slug,
          body,
          verify_jwt: verifyJwt,
        }),
      }
    );
    if (!create.ok) {
      throw new Error(`create ${slug} failed: ${create.status} ${await create.text()}`);
    }
    console.log(`✓ created ${slug}`);
    return;
  }
  throw new Error(`update ${slug} failed: ${update.status} ${await update.text()}`);
}

const slugs = ["chatbot", "detect-hotspots", "send-adherence-sms"];
for (const slug of slugs) {
  await deploy(slug);
}
