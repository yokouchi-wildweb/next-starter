// scripts/admin-menu/check.ts(pnpm admin-menu:check。build の冒頭、extensions:check の後で走る)
// 管理メニューの受け口の置き間違いを止める(書かない)。判定: ./inspect.ts の checkAdminMenu / 仕組み: src/features/core/admin/menu/README.md

import { adminDomains } from "@/registry/adminDomains";

import { readMenuSnapshot, readRoutePaths } from "./collect";
import { checkAdminMenu } from "./inspect";

async function main(): Promise<void> {
  const snapshot = await readMenuSnapshot();
  const problems = checkAdminMenu(snapshot, adminDomains, readRoutePaths());
  if (problems.length > 0) {
    console.error(`✗ admin-menu:check: ${problems.length} 件\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    process.exit(1);
  }
  console.log(
    `✓ admin-menu:check OK(カテゴリー ${snapshot.categories.length} / 項目 ${snapshot.items.length} / 上書き ${[...snapshot.categories, ...snapshot.items].filter((e) => e.override).length})`,
  );
}

void main();
