// scripts/structure/cache/generate.mjs — 段階の入口(pnpm generate cache): cache を宣言した全ドメインの services/server/cachedReads.ts を作り直す
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generateCachedReads } from "./lib.mjs";

const result = generateCachedReads(join(dirname(fileURLToPath(import.meta.url)), "../../.."));
for (const line of result.lines) (result.ok ? console.log : console.error)(line);
process.exit(result.ok ? 0 : 1);
