// scripts/structure/config-overrides/check.mjs — 門の入口(pnpm check config-overrides): 上書きと持ち主の 1 対 1(設定 D19・D38・D75)
// 中身: pairing.mjs / README.md。exit 0 = 余り 0・欠落 0 / 1 = 揃っていない、または地区の地図に問題がある
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkOverridePairs, reportLines } from "./pairing.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const result = checkOverridePairs(repoRoot);
const ok = result.ok && result.mapProblems.length === 0;
for (const line of reportLines(result)) (ok ? console.log : console.error)(line);
process.exit(ok ? 0 : 1);
