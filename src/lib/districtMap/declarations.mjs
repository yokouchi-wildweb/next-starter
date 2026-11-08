// 拡張点の宣言(extensionPoints.ts = 地区の受け口)の唯一の読み手。地区の地図(./read.mjs)・生成器(scripts/structure/extensions)・
// 所有の検査の単位名(src/lib/forkOwnership/unitNames.mjs)・src/wiring の配線テスト・ロールの上書き(scripts/structure/role)が使う
// (D2: 仕組みは src/lib に 1 本、scripts から import。目録 D13: 地区の発見の側に置き、所有の軸 forkOwnership はここを import する)。
// 宣言を探して読む。fork の点は fork 自身のフォルダの extensionPoints.ts に書く
// (旧い extensionPoints.<x>.ts は止めて移し方を案内する)。
// 宣言はリテラルだけ: TypeScript の構文木で字面を読み、実行しない(式・変数・関数呼び出し・テンプレートは失敗)。
// 書式と置き場: scripts/structure/extensions/README.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import ts from "typescript";

import { classifyDottedName, oldMarkerProblem } from "./dottedNames.mjs";

export const DECLARATION_NAME = "extensionPoints";
/** 宣言を探す範囲(リポジトリ直下からの相対) */
export const SEARCH_ROOT = "src";
/** 生成一覧の置き場の名前(持ち主のフォルダの直下) */
export const EXTENSIONS_DIR_NAME = "extensions";

const SIDES = ["server", "client", "shared"];
const LOADS = ["eager", "lazy"];
const WRITERS = ["role:generate"];
const TARGETS = ["wiring"];
/** 組み込みの変換(一覧の項目に付け足す値)。fork が足す口は無い */
export const DERIVES = ["featureTables", "settingSections"];
const KEYS = ["dir", "export", "type", "side", "key", "load", "target", "ignore", "derive", "alwaysOn", "literalKeys", "files", "shape", "pureImports", "requireText", "overrideOf", "writer"];
const POINT_NAME = /^[a-z][A-Za-z0-9]*$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * src の下の宣言のファイルを集める(node_modules・extensions/ の中は見ない)
 * @param {string} repoRoot
 * @returns {{ files: string[], stale: string[] }} リポジトリ直下からの相対パス(並びは path 順)。stale = 旧い形 extensionPoints.<x>.ts
 */
export function findDeclarationFiles(repoRoot) {
  const found = [];
  const stale = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === EXTENSIONS_DIR_NAME || entry.name.startsWith(".")) continue;
        walk(join(dir, entry.name));
      } else if (entry.name === `${DECLARATION_NAME}.ts`) {
        found.push(relative(repoRoot, join(dir, entry.name)).split("\\").join("/"));
      } else if (/\.tsx?$/.test(entry.name) && classifyDottedName(entry.name).base === DECLARATION_NAME && classifyDottedName(entry.name).kind !== "test") {
        stale.push(relative(repoRoot, join(dir, entry.name)).split("\\").join("/"));
      }
    }
  };
  walk(join(repoRoot, SEARCH_ROOT));
  return { files: found.sort(), stale: stale.sort() };
}

/** 構文木の値をリテラルとして読む。リテラルでなければ { problem } */
export function literalOf(node) {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return { value: node.text };
  if (ts.isNumericLiteral(node)) return { value: Number(node.text) };
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { value: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { value: false };
  if (ts.isArrayLiteralExpression(node)) {
    const value = [];
    for (const element of node.elements) {
      const read = literalOf(element);
      if (read.problem) return read;
      value.push(read.value);
    }
    return { value };
  }
  if (ts.isObjectLiteralExpression(node)) {
    const value = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) return { problem: `リテラルでない書き方(${property.getText()})` };
      const name = property.name;
      if (!(ts.isIdentifier(name) || ts.isStringLiteral(name))) return { problem: `キーはリテラル(${name.getText()})` };
      const read = literalOf(property.initializer);
      if (read.problem) return read;
      value[name.text] = read.value;
    }
    return { value };
  }
  return { problem: `リテラルでない値(${node.getText()})。宣言は文字列・真偽・数・配列・object だけで書く` };
}

/** 1 つの点の宣言を確かめる。問題の一覧を返す */
function checkPoint(name, point) {
  const problems = [];
  if (!POINT_NAME.test(name)) problems.push(`点の名前 ${name} は英小文字始まりの camelCase(項目の種類の複数形)`);
  if (typeof point !== "object" || point === null || Array.isArray(point)) return [...problems, `${name}: 点は object で書く`];
  for (const key of Object.keys(point)) if (!KEYS.includes(key)) problems.push(`${name}: 未知のキー ${key}(使えるのは ${KEYS.join(" / ")})`);
  const isString = (v) => typeof v === "string" && v.length > 0;
  // writer: 一覧を別の生成器が書く点。受け口・印・型は無く、持てるのは side だけ
  if (point.writer !== undefined) {
    if (!WRITERS.includes(point.writer)) problems.push(`${name}: writer は ${WRITERS.join(" | ")}`);
    if (!SIDES.includes(point.side)) problems.push(`${name}: side は ${SIDES.join(" | ")}`);
    for (const key of Object.keys(point)) if (key !== "writer" && key !== "side") problems.push(`${name}: writer の点に ${key} は書けない`);
    return problems;
  }
  if (!isString(point.dir) || point.dir.startsWith("/") || point.dir.split("/").includes("..")) problems.push(`${name}: dir は持ち主のフォルダからの相対パス("." = 持ち主の直下)`);
  if (!isString(point.export) || !IDENTIFIER.test(point.export)) problems.push(`${name}: export は項目が export する名前`);
  if (typeof point.type !== "object" || point.type === null || !isString(point.type.from) || !isString(point.type.name) || !IDENTIFIER.test(point.type.name)) {
    problems.push(`${name}: type は { from: "<import 元>", name: "<型の名前>" }`);
  }
  if (!SIDES.includes(point.side)) problems.push(`${name}: side は ${SIDES.join(" | ")}`);
  if (point.key !== undefined && (!isString(point.key) || !IDENTIFIER.test(point.key))) problems.push(`${name}: key は項目の値のプロパティ名`);
  if (point.load !== undefined && !LOADS.includes(point.load)) problems.push(`${name}: load は ${LOADS.join(" | ")}`);
  if (point.target !== undefined && !TARGETS.includes(point.target)) problems.push(`${name}: target は ${TARGETS.join(" | ")}`);
  if (point.ignore !== undefined && !(Array.isArray(point.ignore) && point.ignore.every(isString))) problems.push(`${name}: ignore はファイル名の配列`);
  if (point.derive !== undefined && !DERIVES.includes(point.derive)) problems.push(`${name}: derive は ${DERIVES.join(" | ")}(組み込みの変換だけ)`);
  if (point.literalKeys !== undefined && (point.literalKeys !== true || point.key === undefined)) problems.push(`${name}: literalKeys は key と一緒に true だけ`);
  if (point.alwaysOn !== undefined && typeof point.alwaysOn !== "boolean") problems.push(`${name}: alwaysOn は真偽`);
  if (point.files !== undefined && !(isString(point.files) && /^\*\/[A-Za-z_][A-Za-z0-9_.]*\.tsx?$/.test(point.files))) problems.push(`${name}: files は "*/<ファイル名>"(受け口の 1 段下の決まった名前のファイル)`);
  if (point.shape !== undefined && (point.shape !== "object" || point.key !== undefined || point.load !== undefined || point.files !== undefined)) problems.push(`${name}: shape は "object" だけで、key・load・files と一緒に使えない`);
  if (point.pureImports !== undefined && point.pureImports !== true) problems.push(`${name}: pureImports は true だけ`);
  if (point.requireText !== undefined && !isString(point.requireText)) problems.push(`${name}: requireText は文字列`);
  if (point.overrideOf !== undefined && !(Array.isArray(point.overrideOf) && point.overrideOf.length > 0 && point.overrideOf.every(isString))) problems.push(`${name}: overrideOf は上書きしてよい属性の名前の配列`);
  if (point.load === "lazy" && (point.key !== undefined || point.derive !== undefined)) problems.push(`${name}: load "lazy" は key・derive と一緒に使えない`);
  return problems;
}

/**
 * 宣言のファイルを 1 つ読む
 * @param {string} path リポジトリ直下からの相対
 * @param {string} text
 * @returns {{ points: Record<string, object>, problems: string[] }}
 */
export function readDeclaration(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let initializer = null;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    for (const declaration of statement.declarationList.declarations) {
      if (exported && ts.isIdentifier(declaration.name) && declaration.name.text === DECLARATION_NAME) initializer = declaration.initializer ?? null;
    }
  }
  if (!initializer) return { points: {}, problems: [`${path}: export const ${DECLARATION_NAME} = { … } が無い`] };
  const read = literalOf(initializer);
  if (read.problem) return { points: {}, problems: [`${path}: ${read.problem}`] };
  if (typeof read.value !== "object" || read.value === null || Array.isArray(read.value)) {
    return { points: {}, problems: [`${path}: ${DECLARATION_NAME} は { <点の名前>: { … } } の object`] };
  }
  const problems = Object.entries(read.value).flatMap(([name, point]) => checkPoint(name, point).map((p) => `${path}: ${p}`));
  return { points: problems.length > 0 ? {} : read.value, problems };
}

/**
 * 全宣言を読んで点の一覧にする。宣言は 1 フォルダ 1 ファイル(extensionPoints.ts)なので 持ち主:点の名前 は重ならない。
 * fork の点は fork 自身のフォルダ(fork が足したドメイン・lib)の extensionPoints.ts に書く
 * @param {string} repoRoot
 * @returns {{ points: { owner: string, name: string, declaredIn: string, spec: object }[], problems: string[] }}
 */
export function collectPoints(repoRoot) {
  const points = [];
  const problems = [];
  const { files, stale } = findDeclarationFiles(repoRoot);
  for (const path of stale) {
    problems.push(`${oldMarkerProblem(path, `${DECLARATION_NAME}.ts`)}。fork の拡張点は fork 自身のフォルダの ${DECLARATION_NAME}.ts に宣言する`);
  }
  for (const path of files) {
    const read = readDeclaration(path, readFileSync(join(repoRoot, path), "utf8"));
    problems.push(...read.problems);
    for (const [name, spec] of Object.entries(read.points)) points.push({ owner: dirname(path), name, declaredIn: path, spec });
  }
  return { points: points.sort((a, b) => (a.declaredIn + a.name < b.declaredIn + b.name ? -1 : 1)), problems };
}
