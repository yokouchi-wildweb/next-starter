// scripts/structure/domain/check.mjs — 門の入口(pnpm check domain): ドメインの宣言の検査(何も書かない)
//   forge:pre  = dc:generate:all --dry-run(domain.json の検査。生成の前なので一覧のずれは見ない)
//   forge:post = dc:feature-map --check(生成の後、ドメインの一覧 feature-map.txt が生成結果と一致するか)
//   それ以外(ship・名前で呼んだ時)= 両方
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gate = process.env.GATE ?? "-";
const steps = [];
if (gate !== "forge:post") steps.push([join(here, "index.mjs"), "--generate", "--all", "--dry-run"]);
if (gate !== "forge:pre") steps.push([join(here, "feature-map.mjs"), "--check"]);
// process.exit は cli/ だけ(tests/structure.test.mjs)なので exitCode で返す
for (const args of steps) {
  const r = spawnSync(process.execPath, [...args, ...process.argv.slice(2)], { stdio: "inherit" });
  if (r.status !== 0) {
    process.exitCode = r.status ?? 1;
    break;
  }
}
