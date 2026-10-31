// scripts/cycles/cycles.mjs
// 静的な値の import で閉じる輪を探す(D24)。型だけの import は dpdm の transform で消え、import() の辺は数えない。
// 例外の一覧は置かない(D25)。実行: pnpm test:cycles

import { parseDependencyTree } from "dpdm";

/** dpdm の木から、静的な値の import の輪(2 ファイル以上の強連結成分)を返す */
export function findStaticCycles(tree) {
  const graph = new Map(
    Object.entries(tree).map(([file, deps]) => [
      file,
      (deps ?? []).filter((dep) => dep.id && dep.kind !== "DynamicImport").map((dep) => dep.id),
    ]),
  );
  let counter = 0;
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const cycles = [];
  const visit = (node) => {
    index.set(node, counter);
    low.set(node, counter);
    counter += 1;
    stack.push(node);
    onStack.add(node);
    for (const next of graph.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node), index.get(next)));
      }
    }
    if (low.get(node) !== index.get(node)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    if (component.length > 1) cycles.push(component.sort());
  };
  for (const node of graph.keys()) if (!index.has(node)) visit(node);
  return cycles;
}

/** context の下の entries(context からの相対の glob)から依存の木を作り、輪を返す */
export async function scanCycles({ context, entries, tsconfig }) {
  // dpdm は entries の glob を context でなく cwd から解く
  const cwd = process.cwd();
  process.chdir(context);
  try {
    const tree = await parseDependencyTree(entries, {
      context,
      tsconfig,
      transform: true,
      extensions: [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".json"],
      js: [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"],
      onProgress: () => {},
    });
    return findStaticCycles(tree);
  } finally {
    process.chdir(cwd);
  }
}
