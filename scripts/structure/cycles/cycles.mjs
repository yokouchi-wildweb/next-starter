// scripts/structure/cycles/cycles.mjs
// 輪を探す 2 つの検査。例外の一覧は置かない(D25)。実行: pnpm test scripts/structure/cycles/cycles.test.mjs
// 1. ファイルの値の輪(D24): 静的な値の import で閉じる輪。型だけの import は dpdm の transform で消え、import() の辺は数えない
// 2. 単位と lib の輪(D232): 型の import も import() も数え、ファイルを持ち主の単位(棚の単位 src/components/<分類>/<単位>・
//    lib src/lib/<名前>)にまとめた図の輪。テストのファイルは辺に数えない。単位の数え方は src/lib/forkOwnership/unitNames.mjs
// dpdm は tsconfig の絶対パスを cwd とつないで壊す(読めずに別名が 1 つも解けない)ので、必ず cwd からの相対で渡す

import path from "node:path";

import { parseDependencyTree } from "dpdm";

import { shelfUnitOf, unitPlaces } from "../../../src/lib/forkOwnership/unitNames.mjs";

/** 有向の図(ノード → 次のノードの配列)の強連結成分のうち 2 つ以上のもの(各成分は並べ替え済み) */
function stronglyConnected(graph) {
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

/** dpdm の木から、静的な値の import の輪(2 ファイル以上の強連結成分)を返す */
export function findStaticCycles(tree) {
  const graph = new Map(
    Object.entries(tree).map(([file, deps]) => [
      file,
      (deps ?? []).filter((dep) => dep.id && dep.kind !== "DynamicImport").map((dep) => dep.id),
    ]),
  );
  return stronglyConnected(graph);
}

const TEST_FILE = /\.test\.[^./]+$/;

/**
 * dpdm の木(型の import を残した物)から、単位と lib の輪を返す。
 * @param {Record<string, { id: string | null }[] | null>} tree
 * @param {(file: string) => string | null} unitOf ファイル → 持ち主の単位(まとめない物は null)
 * @returns {{ units: string[], edges: string[] }[]} units = 輪の単位、edges = 輪の中の辺(`<ファイル> -> <ファイル>`)
 */
export function findUnitCycles(tree, unitOf) {
  const edges = new Map();
  for (const [file, deps] of Object.entries(tree)) {
    if (TEST_FILE.test(file)) continue;
    const from = unitOf(file);
    if (!from) continue;
    for (const dep of deps ?? []) {
      if (!dep.id || TEST_FILE.test(dep.id)) continue;
      const to = unitOf(dep.id);
      if (!to || to === from) continue;
      if (!edges.has(from)) edges.set(from, new Map());
      const byTarget = edges.get(from);
      if (!byTarget.has(to)) byTarget.set(to, new Set());
      byTarget.get(to).add(`${file} -> ${dep.id}`);
    }
  }
  const graph = new Map([...edges].map(([from, byTarget]) => [from, [...byTarget.keys()]]));
  return stronglyConnected(graph).map((units) => ({
    units,
    edges: units.flatMap((from) => [...(edges.get(from) ?? [])].filter(([to]) => units.includes(to)).flatMap(([, list]) => [...list].sort())),
  }));
}

/** ファイル → 持ち主の単位(棚の単位か lib)。ほかは null */
export function shelfAndLibUnitOf(files) {
  const places = unitPlaces(files, () => null);
  return (file) => (file.startsWith("src/components/") || file.startsWith("src/lib/") ? shelfUnitOf(file, places) : null);
}

const EXTENSIONS = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".json"];
const JS = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"];

/** context に移って dpdm の木を作る(entries は context からの相対の glob、tsconfig は context の下のパス) */
async function treeOf({ context, entries, tsconfig, transform }) {
  // dpdm は entries の glob を context でなく cwd から解き、tsconfig の絶対パスは cwd とつないで壊す
  const cwd = process.cwd();
  process.chdir(context);
  try {
    return await parseDependencyTree(entries, {
      context,
      tsconfig: tsconfig ? path.relative(context, path.resolve(cwd, tsconfig)) : undefined,
      transform,
      extensions: EXTENSIONS,
      js: JS,
      onProgress: () => {},
    });
  } finally {
    process.chdir(cwd);
  }
}

/** context の下の entries(context からの相対の glob)から依存の木を作り、値の輪を返す */
export async function scanCycles({ context, entries, tsconfig }) {
  return findStaticCycles(await treeOf({ context, entries, tsconfig, transform: true }));
}

/** context の下の entries から型の import を残した木を作り、単位と lib の輪を返す(files = 単位の場所を決める基準のファイル) */
export async function scanUnitCycles({ context, entries, tsconfig, files }) {
  const tree = await treeOf({ context, entries, tsconfig, transform: false });
  return findUnitCycles(tree, shelfAndLibUnitOf(files ?? Object.keys(tree)));
}
