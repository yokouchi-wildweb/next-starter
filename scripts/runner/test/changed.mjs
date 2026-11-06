// scripts/runner/test/changed.mjs — pnpm test --changed の選び方(pnpm test の部品)
// 変更したファイルに import で届くテスト(dpdm でテストのファイルから辿る)+ 変更したファイルと同じフォルダのテスト。
// 依存を辿れないテストは同じフォルダの規則だけで選び、辿れなかったことを返す(黙って落とさない)。
import { dirname } from "node:path";
import { parseDependencyTree } from "dpdm";

/** テストのファイルから届くファイルの集合(tree = dpdm の木、キーはリポジトリ直下からの相対) */
export function reachable(tree, file) {
  const seen = new Set([file]);
  const queue = [file];
  while (queue.length) {
    for (const dep of tree[queue.shift()] ?? []) {
      if (dep.id && !seen.has(dep.id)) {
        seen.add(dep.id);
        queue.push(dep.id);
      }
    }
  }
  return seen;
}

/**
 * @param {string[]} tests 候補のテスト
 * @param {string[]} changed 変更したファイル
 * @param {Record<string, {id: string|null}[]> | null} tree dpdm の木(作れなければ null)
 * @returns {{ selected: string[], untraced: string[] }}
 */
export function selectChanged(tests, changed, tree) {
  const changedSet = new Set(changed);
  const dirs = new Set(changed.map((f) => dirname(f)));
  const selected = [];
  const untraced = [];
  for (const test of tests) {
    const sameDir = dirs.has(dirname(test)) || changedSet.has(test);
    if (!tree || !(test in tree)) {
      untraced.push(test);
      if (sameDir) selected.push(test);
      continue;
    }
    if (sameDir || [...reachable(tree, test)].some((f) => changedSet.has(f))) selected.push(test);
  }
  return { selected, untraced };
}

/** テストのファイルから依存の木(dpdm、tsconfig の paths で @/ を解く)。読めなければ null */
export async function scanTree(repo, tests) {
  const cwd = process.cwd();
  try {
    process.chdir(repo);
    return await parseDependencyTree(tests, {
      context: repo,
      tsconfig: "tsconfig.json",
      transform: true,
      extensions: [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".json"],
      js: [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"],
      onProgress: () => {},
    });
  } catch {
    return null;
  } finally {
    process.chdir(cwd);
  }
}
