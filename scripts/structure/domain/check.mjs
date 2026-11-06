// scripts/structure/domain/check.mjs — 門の入口(pnpm check domain [-- <引数>]): ドメインの宣言の検査(何も書かない)
//   引数なし: forge:pre  = 全ドメインの生成の --dry-run(domain.json の検査。生成の前なので一覧のずれは見ない)
//             forge:post = feature-map.mjs --check(生成の後、ドメインの一覧 feature-map.txt が生成結果と一致するか)
//             それ以外(ship・名前で呼んだ時)= 両方
//   --compare [<引数>]   = fork が generate を決めるための比較(compare.mjs、読むだけ)
//   --parity <ref> [<引数>] = 生成器の前後比較(tests/parity.mjs。生成器を触ったら回す)
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gate = process.env.GATE ?? "-";
const args = process.argv.slice(2).filter((a) => a !== "--");
const steps = [];
if (args.includes("--compare")) steps.push([join(here, "compare.mjs"), ...args.filter((a) => a !== "--compare")]);
else if (args.includes("--parity")) steps.push([join(here, "tests/parity.mjs"), ...args.filter((a) => a !== "--parity")]);
else {
  if (gate !== "forge:post") steps.push([join(here, "index.mjs"), "--generate", "--all", "--dry-run", ...args]);
  if (gate !== "forge:pre") steps.push([join(here, "feature-map.mjs"), "--check"]);
}
// process.exit は cli/ だけ(tests/structure.test.mjs)なので exitCode で返す
for (const argv of steps) {
  const r = spawnSync(process.execPath, argv, { stdio: "inherit" });
  if (r.status !== 0) {
    process.exitCode = r.status ?? 1;
    break;
  }
}
