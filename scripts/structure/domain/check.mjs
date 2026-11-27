// scripts/structure/domain/check.mjs — 段階の入口(pnpm check domain [-- <引数>]): ドメインの宣言の検査(何も書かない)
//   引数なし: 全ドメインの生成の --dry-run(登録の entity.json の検査。段階 forge:pre・ship・名前で呼んだ時)と、
//             全ドメインの cache の宣言の検査(checks/cacheDeclarations.mjs。generate: false・domain.json の無いドメインも)。
//             ドメインの一覧は地区の地図 src/registry/district-map.jsonl(pnpm check district-map が照らす)
//   --compare [<引数>]   = fork が generate を決めるための比較(compare.mjs、読むだけ)
//   --parity <ref> [<引数>] = 生成器の前後比較(tests/parity.mjs。生成器を触ったら回す)
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cacheDeclarationIssues } from "./checks/cacheDeclarations.mjs";
import { readCacheDeclarations, readDomainRows } from "./domain/workspace.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => a !== "--");
const steps = [];
if (args.includes("--compare")) steps.push([join(here, "compare.mjs"), ...args.filter((a) => a !== "--compare")]);
else if (args.includes("--parity")) steps.push([join(here, "tests/parity.mjs"), ...args.filter((a) => a !== "--parity")]);
else {
  steps.push([join(here, "index.mjs"), "--generate", "--all", "--dry-run", ...args]);
}
const cacheCheck = !args.includes("--compare") && !args.includes("--parity");
// process.exit は cli/ だけ(tests/structure.test.mjs)なので exitCode で返す
for (const argv of steps) {
  const r = spawnSync(process.execPath, argv, { stdio: "inherit" });
  if (r.status !== 0) {
    process.exitCode = r.status ?? 1;
    break;
  }
}
if (cacheCheck && !process.exitCode) {
  const rows = readDomainRows(join(here, "../../.."));
  const { issues, declared } = cacheDeclarationIssues(readCacheDeclarations(join(here, "../../.."), rows), rows.map((row) => row.name));
  if (issues.length > 0) {
    console.error(`cache の宣言: 問題 ${issues.length} 件\n${issues.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`cache の宣言: ${declared.length} 登録(問題なし)`);
  }
}
