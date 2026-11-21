// scripts/structure/cycles/cycles.mjs
// 輪を探す 2 つの検査。例外の一覧は置かない(D25)。実行: pnpm test scripts/structure/cycles/cycles.test.mjs
// 1. ファイルの値の輪(D24): 静的な値の import で閉じる輪。型だけの import は dpdm の transform で消え、import() の辺は数えない
// 2. 単位と lib の輪(D232): 型の import も import() も数え、ファイルを持ち主の単位(棚の単位 src/components/<分類>/<単位>・
//    lib src/lib/<名前>)にまとめた図の輪。テストのファイルは辺に数えない。単位の数え方は src/lib/forkOwnership/unitNames.mjs
// dpdm は tsconfig の絶対パスを cwd とつないで壊す(読めずに別名が 1 つも解けない)ので、必ず cwd からの相対で渡す
// 読みは 1 回: 型の import を残した木(2 の材料)を同じ引数ごとに 1 度だけ作り、1 の値の木はそこから型だけの辺を落として求める
// (型も数えた図の輪に入る ts/tsx だけを dpdm の transform と同じ設定で変換し、残った import だけを辺に残す。src を 2 度解いていた時は出荷の並びの負荷で
// test() 1 つ 60 秒の上限を越えた)

import { readFileSync } from "node:fs";
import path from "node:path";

import { parseDependencyTree } from "dpdm";
import ts from "typescript";

import { shelfUnitOf, unitPlaces } from "../../../src/lib/forkOwnership/node.mjs";

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

/** context に移って dpdm の木(型の import も残す)を作る(entries は context からの相対の glob、tsconfig は context の下のパス) */
async function parseTree({ context, entries, tsconfig }) {
  // dpdm は entries の glob を context でなく cwd から解き、tsconfig の絶対パスは cwd とつないで壊す
  const cwd = process.cwd();
  process.chdir(context);
  try {
    return await parseDependencyTree(entries, {
      context,
      tsconfig: tsconfig ? path.relative(context, path.resolve(cwd, tsconfig)) : undefined,
      transform: false,
      extensions: EXTENSIONS,
      js: JS,
      onProgress: () => {},
    });
  } finally {
    process.chdir(cwd);
  }
}

const trees = new Map();

/** 同じ引数の木は 1 度だけ作る(値の輪と単位の輪が同じ木を使う) */
function treeOf({ context, entries, tsconfig }) {
  const key = JSON.stringify([path.resolve(context), entries, tsconfig ? path.resolve(tsconfig) : null]);
  if (!trees.has(key)) trees.set(key, parseTree({ context, entries, tsconfig }));
  return trees.get(key);
}

// dpdm の transform と同じ変換の設定(型だけの import・export と、値に使わない import が消える)
const TRANSFORM_OPTIONS = { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve, isolatedModules: true };
const TRANSFORMED = new Set([".ts", ".tsx"]);

/** 変換の後に残る import の指定子(dpdm が辺にする 4 つの形: import・import()・require・export … from) */
function valueRequestsOf(file, code) {
  let source;
  ts.transpileModule(code, { fileName: file, compilerOptions: TRANSFORM_OPTIONS, transformers: { after: [() => (node) => (source = node)] } });
  const requests = new Set();
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) requests.add(node.moduleSpecifier.text);
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) requests.add(node.moduleSpecifier.text);
    else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.escapedText === "require"))
    )
      requests.add(node.arguments[0].text);
    else ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return requests;
}

/**
 * 型の import を残した木から値の木を作る: ts / tsx のファイルは変換の後に残る指定子の辺だけを残す(ほかの拡張子は dpdm も変換しない)
 * @param {Record<string, { request: string, id: string | null }[] | null>} tree
 * @param {string} context 木のファイルの道の基準
 */
export function valueTreeOf(tree, context) {
  return Object.fromEntries(
    Object.entries(tree).map(([file, deps]) => {
      if (!deps || deps.length === 0 || !TRANSFORMED.has(path.extname(file))) return [file, deps];
      const kept = valueRequestsOf(file, readFileSync(path.resolve(context, file), "utf8"));
      return [file, deps.filter((dep) => kept.has(dep.request))];
    }),
  );
}

/** context の下の entries(context からの相対の glob)から依存の木を作り、値の輪を返す */
export async function scanCycles({ context, entries, tsconfig }) {
  const tree = await treeOf({ context, entries, tsconfig });
  // 値の輪は型も数えた図の輪の中にしか無い: 変換するのはその輪のファイルだけ(辺も輪のファイルどうしだけ)
  const candidates = new Set(findStaticCycles(tree).flat());
  const sub = Object.fromEntries(
    Object.entries(tree)
      .filter(([file]) => candidates.has(file))
      .map(([file, deps]) => [file, (deps ?? []).filter((dep) => candidates.has(dep.id))]),
  );
  return findStaticCycles(valueTreeOf(sub, context));
}

/** context の下の entries から型の import を残した木を作り、単位と lib の輪を返す(files = 単位の場所を決める基準のファイル) */
export async function scanUnitCycles({ context, entries, tsconfig, files }) {
  const tree = await treeOf({ context, entries, tsconfig });
  return findUnitCycles(tree, shelfAndLibUnitOf(files ?? Object.keys(tree)));
}
