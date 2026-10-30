// scripts/extensions/declarations.mjs
// 拡張点の宣言(extensionPoints.ts / extensionPoints.<fork の名前>.ts)を探して読む。
// 宣言はリテラルだけ: TypeScript の構文木で字面を読み、実行しない(式・変数・関数呼び出し・テンプレートは失敗)。
// 書式と置き場: ./README.md

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import ts from "typescript";

import { parseForkDotName } from "../../src/lib/forkOwnership/forkIds.mjs";

export const DECLARATION_NAME = "extensionPoints";
/** 宣言を探す範囲(リポジトリ直下からの相対) */
export const SEARCH_ROOT = "src";
/** 生成一覧の置き場の名前(持ち主のフォルダの直下) */
export const EXTENSIONS_DIR_NAME = "extensions";

const SIDES = ["server", "client", "shared"];
const LOADS = ["eager", "lazy"];
const TARGETS = ["wiring"];
/** 組み込みの変換(一覧の項目に付け足す値)。fork が足す口は無い */
export const DERIVES = ["featureTables"];
const KEYS = ["dir", "export", "type", "side", "key", "load", "target", "ignore", "derive"];
const POINT_NAME = /^[a-z][A-Za-z0-9]*$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * src の下の宣言のファイルを集める(node_modules・extensions/ の中は見ない)
 * @param {string} repoRoot
 * @returns {string[]} リポジトリ直下からの相対パス(並びは path 順)
 */
export function findDeclarationFiles(repoRoot) {
  const found = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === EXTENSIONS_DIR_NAME || entry.name.startsWith(".")) continue;
        walk(join(dir, entry.name));
      } else if (entry.name === `${DECLARATION_NAME}.ts` || parseForkDotName(entry.name, { extensions: ["ts"] })?.name === DECLARATION_NAME) {
        found.push(relative(repoRoot, join(dir, entry.name)).split("\\").join("/"));
      }
    }
  };
  walk(join(repoRoot, SEARCH_ROOT));
  return found.sort();
}

/** 構文木の値をリテラルとして読む。リテラルでなければ { problem } */
function literalOf(node) {
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
 * 全宣言を読んで点の一覧にする。fork の宣言の点が上流(印なし)の点と同じ名前なら失敗
 * @param {string} repoRoot
 * @param {string[]} forkIds 宣言済みの fork の名前
 * @returns {{ points: { owner: string, name: string, declaredIn: string, forkId: string | null, spec: object }[], problems: string[] }}
 */
export function collectPoints(repoRoot, forkIds) {
  const points = [];
  const problems = [];
  for (const path of findDeclarationFiles(repoRoot)) {
    const fileName = path.split("/").pop();
    const forkId = fileName === `${DECLARATION_NAME}.ts` ? null : parseForkDotName(fileName, { extensions: ["ts"] }).forkId;
    if (forkId !== null && !forkIds.includes(forkId)) {
      problems.push(`${path}: fork の名前 "${forkId}" は宣言されていない(.claude/rules/project.md の fork_id: か祖先の台帳名)`);
      continue;
    }
    const read = readDeclaration(path, readFileSync(join(repoRoot, path), "utf8"));
    problems.push(...read.problems);
    for (const [name, spec] of Object.entries(read.points)) points.push({ owner: dirname(path), name, declaredIn: path, forkId, spec });
  }
  const seen = new Map();
  for (const point of [...points].sort((a, b) => (a.forkId === null ? 0 : 1) - (b.forkId === null ? 0 : 1))) {
    const id = `${point.owner}:${point.name}`;
    const first = seen.get(id);
    if (first) {
      problems.push(`${point.declaredIn}: 点 ${point.name} は ${first.declaredIn} でも宣言されている(fork の点は上流と違う名前に。上流が後から同じ名前を足したら fork の点を改名する)`);
      continue;
    }
    seen.set(id, point);
  }
  return { points: [...seen.values()].sort((a, b) => (a.declaredIn + a.name < b.declaredIn + b.name ? -1 : 1)), problems };
}
