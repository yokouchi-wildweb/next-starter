// scripts/structure/cache/check.mjs — 段階の入口(pnpm check cache): <登録名>CachedReads.ts が宣言どおりか(何も書かない)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkCachedReads } from "./lib.mjs";

const result = checkCachedReads(join(dirname(fileURLToPath(import.meta.url)), "../../.."));
for (const line of result.lines) (result.ok ? console.log : console.error)(line);
process.exit(result.ok ? 0 : 1);
