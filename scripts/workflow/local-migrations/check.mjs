// scripts/workflow/local-migrations/check.mjs — 門 ship の検査(gate.json): git に入れない移行(.local.ts)がコミット・ステージされていないか
// .local.ts は下流に流さない緊急のデータ修正の置き場(.gitignore の 1 行、src/lib/task/README.md)。追跡されていれば止める。
// 直し方: git rm --cached <path>(ファイルは残る)。下流にも要るなら .local を外して notice: を付け、ふつうの移行にする。
import { join } from "node:path";

import { trackedLocalMigrations } from "./lib.tracked.mjs";

const repo = join(import.meta.dirname, "../../..");
const tracked = trackedLocalMigrations(repo);
if (tracked.length === 0) {
  console.log("local-migrations: 追跡されている .local.ts はありません");
} else {
  console.error("local-migrations: git に入れない移行がコミット・ステージされています(git rm --cached <path> で外す。下流にも要るなら .local を外して notice: を付ける):");
  for (const path of tracked) console.error(`  ${path}`);
  process.exitCode = 1;
}
