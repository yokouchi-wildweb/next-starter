// scripts/structure/districtMap/check.mjs — 門の入口(pnpm check districtMap): district-map.jsonl が今の木と同じか
import { checkDistrictMap } from "./map.mjs";

const result = checkDistrictMap();
for (const line of result.lines) (result.ok ? console.log : console.error)(line);
process.exit(result.ok ? 0 : 1);
