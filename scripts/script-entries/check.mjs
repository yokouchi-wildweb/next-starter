// scripts/script-entries/check.mjs
// package.json の tsx の入口のうち、server-only に届くのに stub を読まないものを探す(D26 K5)。
// server-only は Next のバンドラーだけが解決するので、tsx の入口は scripts/test/serverOnlyStub.mjs を読まないと落ちる。
// 届く判定は import() の辺も辿る(db:seed の `await import("./data")` のように実行時に評価されるため)。
// 届かない入口には求めない。実行: pnpm test:script-entries

import { parseDependencyTree } from "dpdm";

const ENTRY_FILE = /(?:^|\s)((?:scripts|src)\/[^\s'"]+\.(?:ts|tsx|mts|mjs))/g;

/** package.json の scripts から tsx の入口を読む */
export function readEntries(scripts) {
  return Object.entries(scripts)
    .filter(([, command]) => /\btsx\b/.test(command))
    .map(([name, command]) => ({
      name,
      stub: command.includes("serverOnlyStub"),
      files: [...command.matchAll(ENTRY_FILE)].map((match) => match[1]),
    }));
}

/** file から server-only に届く経路を返す(届かなければ null) */
export function serverOnlyPath(tree, file) {
  const previous = new Map();
  const seen = new Set([file]);
  const queue = [file];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const dep of tree[current] ?? []) {
      if (dep.request === "server-only") {
        const path = [current];
        for (let node = current; previous.has(node); ) {
          node = previous.get(node);
          path.unshift(node);
        }
        return path;
      }
      if (dep.id && !seen.has(dep.id)) {
        seen.add(dep.id);
        previous.set(dep.id, current);
        queue.push(dep.id);
      }
    }
  }
  return null;
}

/** 届くのに stub を読まない入口の一覧 */
export function findMissingStubs(entries, tree) {
  const problems = [];
  for (const { name, stub, files } of entries) {
    if (stub) continue;
    for (const file of files) {
      const path = serverOnlyPath(tree, file);
      if (path) {
        problems.push({ name, path });
        break;
      }
    }
  }
  return problems;
}

/** 入口のファイルから依存の木を作る(dpdm は entries を cwd から解く) */
export function scanTree(files, tsconfig) {
  return parseDependencyTree(files, {
    context: process.cwd(),
    tsconfig,
    transform: true,
    extensions: [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".json"],
    js: [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"],
    onProgress: () => {},
  });
}
