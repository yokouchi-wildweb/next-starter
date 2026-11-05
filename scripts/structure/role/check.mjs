// scripts/structure/role/check.mjs — 門の入口(pnpm check role): ロール・プロフィールの宣言の検査(何も書かない)
// forge の事前検査と同じ checkAllRoles を回し、問題を出して exit 1
import { checkAllRoles } from "./generate.mjs";

const issues = checkAllRoles();
for (const issue of issues) console.error(issue);
if (issues.length) process.exit(1);
console.log("[role] ロール・プロフィールの宣言に問題なし");
