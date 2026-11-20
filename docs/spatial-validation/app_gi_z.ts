// Runs BANTAY-TB's own spatial code on the report dataset and writes each
// barangay's Gi* z-score to app_z.json, for pysal_check.py to compare against.
//
//   npx tsx docs/spatial-validation/app_gi_z.ts
//   python -I docs/spatial-validation/pysal_check.py src/data/barangayNeighbors.json \
//     docs/spatial-validation/report-dataset-2026-11-08.json docs/spatial-validation/app_z.json
//
// The Python side needs: pip install esda==2.10.0 libpysal numpy
import { readFileSync, writeFileSync } from "node:fs";
import { analyzeSpatial } from "../../supabase/functions/_shared/spatial.ts";

const dir = "docs/spatial-validation";
const nb = JSON.parse(readFileSync("src/data/barangayNeighbors.json", "utf8")) as Record<string, number[]>;
const d = JSON.parse(readFileSync(`${dir}/report-dataset-2026-11-08.json`, "utf8")) as Record<string, [string, number]>;
const psgcs = Object.keys(nb).map(Number).sort((a, b) => a - b);

const a = analyzeSpatial(
  psgcs.map((p) => ({ psgc: p, cases: d[String(p)]?.[1] ?? 0, population: null })),
  nb,
  { permutations: 999 }
);
const m = a.moran;
console.log(
  `I=${m.I.toFixed(6)} E[I]=${m.expected.toFixed(6)} Var=${m.variance.toFixed(8)} z=${m.z.toFixed(6)} p_sim=${m.pSim.toFixed(3)}`
);
console.log(`hotspots ${a.units.filter((u) => u.giZ >= 1.96).length}, FDR ${a.units.filter((u) => u.fdrSignificant).length}`);
writeFileSync(`${dir}/app_z.json`, JSON.stringify(Object.fromEntries(a.units.map((u) => [u.psgc, u.giZ]))));
