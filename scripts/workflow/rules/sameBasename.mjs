// scripts/workflow/rules/sameBasename.mjs
// 1 つのフォルダに同じ名前の <base>.ts と <base>.tsx を置かない決まりの読み手。
// tsc は同じ名前の組の .ts だけを読み、.tsx を黙って飛ばす(型の誤りが pnpm typecheck で落ちない)。
// 対象: src/・scripts/・eslint-rules/(servers/ は pnpm の workspace の外なので見ない)。門 ship の pnpm check rules が回す(./check.mjs)

import { execFileSync } from "node:child_process";

export const SAME_BASENAME_ROOTS = Object.freeze(["src/", "scripts/", "eslint-rules/"]);

/**
 * 同じフォルダの同じ名前の .ts / .tsx の組(拡張子を落としたパスの一覧、名前順)
 * @param {readonly string[]} files repo 相対の posix パス
 * @returns {string[]}
 */
export function sameBasenamePairs(files) {
  const ts = new Set();
  const tsx = new Set();
  for (const file of files) {
    if (!SAME_BASENAME_ROOTS.some((root) => file.startsWith(root))) continue;
    if (file.endsWith(".tsx")) tsx.add(file.slice(0, -4));
    else if (file.endsWith(".ts") && !file.endsWith(".d.ts")) ts.add(file.slice(0, -3));
  }
  return [...ts].filter((base) => tsx.has(base)).sort();
}

/**
 * repo のファイル(git の追跡 + 未追跡で .gitignore に当たらない物。コミット前の新しいファイルも見る)
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function repoFiles(repoRoot) {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: repoRoot, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}
