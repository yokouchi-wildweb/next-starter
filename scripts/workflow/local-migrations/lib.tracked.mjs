// scripts/workflow/local-migrations/lib.tracked.mjs
// git が追跡している(ステージ済みを含む)git に入れない移行 src/features/**/scripts/migrations/*.local.ts を返す。
// 利用者: check.mjs(門 ship)・テスト
import { execFileSync } from "node:child_process";

export const LOCAL_MIGRATION = /^src\/features\/(?:.+\/)?scripts\/migrations\/[^/]+\.local\.ts$/;

/** @param {string} repo リポジトリ直下 @returns {string[]} 追跡・ステージされた .local.ts(リポジトリ直下からの相対) */
export function trackedLocalMigrations(repo) {
  const out = execFileSync("git", ["ls-files", "--cached", "-z", "--", "src/features"], { cwd: repo, encoding: "utf8" });
  return out.split("\0").filter((path) => LOCAL_MIGRATION.test(path)).sort();
}
