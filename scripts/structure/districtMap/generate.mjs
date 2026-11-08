// scripts/structure/districtMap/generate.mjs — 門の入口(pnpm generate districtMap): src/registry/district-map.jsonl を作り直す
import { generateDistrictMap } from "./map.mjs";

const result = generateDistrictMap();
for (const line of result.lines) (result.ok ? console.log : console.error)(line);
process.exit(result.ok ? 0 : 1);
