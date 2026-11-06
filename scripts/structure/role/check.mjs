// scripts/structure/role/check.mjs — 門の入口(pnpm check role [-- --list]): ロール・プロフィールの宣言の検査(何も書かない)
//   引数なし = forge の事前検査と同じ checkAllRoles を回し、問題を出して exit 1
//   --list   = ロールの一覧を出す(listRoles.mjs)
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkAllRoles } from "./generate.mjs";

const args = process.argv.slice(2).filter((a) => a !== "--");
if (args.includes("--list")) {
  const r = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "listRoles.mjs"), ...args.filter((a) => a !== "--list")], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}
const issues = checkAllRoles();
for (const issue of issues) console.error(issue);
if (issues.length) process.exit(1);
console.log("[role] ロール・プロフィールの宣言に問題なし");
