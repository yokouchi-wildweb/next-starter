// scripts/structure/domain/generateAll.mjs — 門の入口(pnpm generate domain): 全ドメインを生成する(= pnpm dc:generate:all)
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [join(here, "index.mjs"), "--generate", "--all", ...process.argv.slice(2)], { stdio: "inherit" });
process.exitCode = r.status ?? 1; // process.exit は cli/ だけ(tests/structure.test.mjs)
