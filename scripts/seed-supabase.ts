/**
 * scripts/seed-supabase.ts
 *
 * Seed a Supabase project (local or cloud) with:
 *   1. The 182 Davao City barangays (from src/data/barangays.json).
 *   2. The 68 health-content articles (from src/data/healthContent.ts).
 *   3. ~1,200 synthetic TB cases (from src/lib/seed.ts) biased toward the
 *      eight high-burden barangays documented in the capstone doc.
 *
 * Requires env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage:
 *   pnpm tsx scripts/seed-supabase.ts
 *   # or
 *   npx tsx scripts/seed-supabase.ts
 */

import { createClient } from "@supabase/supabase-js";
import barangays from "../src/data/barangays.json" with { type: "json" };
import { HEALTH_ARTICLES } from "../src/data/healthContent";
import { generateSyntheticCases } from "../src/lib/seed";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "❌ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running."
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  console.log(`Seeding ${barangays.length} barangays…`);
  {
    const rows = barangays.map((b) => ({
      psgc: b.psgc,
      name: b.name,
      centroid_lat: b.lat,
      centroid_lon: b.lon,
      area_km2: b.area_km2,
    }));
    const { error } = await supabase
      .from("barangays")
      .upsert(rows, { onConflict: "psgc" });
    if (error) throw error;
  }

  console.log(`Seeding ${HEALTH_ARTICLES.length} health articles…`);
  {
    const rows = HEALTH_ARTICLES.map((a) => ({
      slug: a.slug,
      disease: a.disease,
      locale: a.locale,
      category: a.category,
      title: a.title,
      summary: a.summary,
      body_md: a.body_md,
    }));
    const chunk = 200;
    for (let i = 0; i < rows.length; i += chunk) {
      const { error } = await supabase
        .from("health_content")
        .upsert(rows.slice(i, i + chunk), { onConflict: "slug" });
      if (error) throw error;
    }
  }

  console.log("Generating synthetic cases…");
  const cases = generateSyntheticCases();
  const ageGroup = (age: number) =>
    age < 5 ? "0-4" : age < 18 ? "5-17" : age < 41 ? "18-40" : age < 61 ? "41-60" : "61+";
  const inserts = cases.map((c) => ({
    barangay_psgc: c.barangay_psgc,
    disease: c.disease,
    tb_classification: c.tb_classification,
    age: c.age,
    age_group: ageGroup(c.age),
    sex: c.sex,
    treatment_outcome: c.treatment_outcome,
    reported_at: c.reported_at,
    jitter_lat: c.jitter_lat,
    jitter_lon: c.jitter_lon,
    notes: null,
    source: "synthetic",
  }));
  const chunk = 500;
  for (let i = 0; i < inserts.length; i += chunk) {
    const { error } = await supabase
      .from("cases")
      .insert(inserts.slice(i, i + chunk));
    if (error) throw error;
    process.stdout.write(`  inserted ${Math.min(i + chunk, inserts.length)}/${inserts.length}\r`);
  }
  console.log(`\n✅ Seeded ${inserts.length} synthetic cases.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
