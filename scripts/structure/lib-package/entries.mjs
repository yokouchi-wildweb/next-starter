// scripts/structure/lib-package/entries.mjs
//
// 入口の中身の検査(D248 の意味のうち、ファイルを読めば分かる 2 つ。名前そのものは src/lib/libPackage の形の検査 entryName):
//   1. 入口 "." のファイルの先頭に "use client" を書かない(core/lib.md entry_no_use_client: 入口が client だと、server が
//      それを通して読む値が全部 client の参照になる)→ entryUseClient
//   2. 入口 "./node" から値で辿れるファイルが React・Next を読まない(Next の外のプログラムが読む入口)→ nodeEntryReact
//      辿る範囲 = 相対と別名(@/…・@lib-config/…)で解ける src の下のファイル(他の lib の入口・棚も)。外部のパッケージは名前だけ見る。
//      型だけの import / export(import type・export type・全部が type の指定子)は実行時に残らないので辿らない
// 読める範囲の検査: 文字列で組み立てる import() や、外部のパッケージの中で React を引く物は見ない(見えない物は通す)

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { resolveImport } from "../../../eslint-rules/resolve-import.mjs";
import { LIB_DIR } from "../../../src/lib/libPackage/index.mjs";
import { readLibPackage } from "../../../src/lib/libPackage/node.mjs";

/** "./node" から読めない外部のパッケージ(名前そのものか、その下の道) */
export const NODE_ENTRY_BANNED = Object.freeze(["react", "react-dom", "next"]);

const RESOLVE_EXTENSIONS = ["", ".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".cjs", "/index.ts", "/index.tsx", "/index.mts", "/index.mjs", "/index.js"];

/** @param {string} specifier */
const bannedPackageOf = (specifier) =>
  NODE_ENTRY_BANNED.find((name) => specifier === name || specifier.startsWith(`${name}/`)) ?? null;

/**
 * 解いた repo 相対のパスを実ファイルに(拡張子・index を補う)。無ければ null
 * @param {string} root
 * @param {string} resolved
 */
function toFile(root, resolved) {
  for (const ext of RESOLVE_EXTENSIONS) {
    const rel = `${resolved}${ext}`;
    const abs = path.join(root, rel);
    if (existsSync(abs) && statSync(abs).isFile()) return rel;
  }
  return null;
}

/** ファイルの先頭の指示(directive)に "use client" があるか */
export function hasUseClient(text, fileName = "x.ts") {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false);
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    if (statement.expression.text === "use client") return true;
  }
  return false;
}

/**
 * 実行時に残る import の指定子(静的な import・export … from・文字列 1 つの import() と require())
 * @param {string} text
 * @param {string} fileName
 * @returns {{ specifier: string, line: number }[]}
 */
export function runtimeImports(text, fileName) {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  /** @type {{ specifier: string, line: number }[]} */
  const out = [];
  const push = (/** @type {ts.Node} */ node, /** @type {string} */ specifier) =>
    out.push({ specifier, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
  const visit = (/** @type {ts.Node} */ node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const typeOnly =
        clause !== undefined &&
        (clause.isTypeOnly ||
          (clause.name === undefined &&
            clause.namedBindings !== undefined &&
            ts.isNamedImports(clause.namedBindings) &&
            clause.namedBindings.elements.length > 0 &&
            clause.namedBindings.elements.every((element) => element.isTypeOnly)));
      if (!typeOnly) push(node, node.moduleSpecifier.text);
      return;
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.exportClause;
      const typeOnly =
        node.isTypeOnly ||
        (clause !== undefined && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((element) => element.isTypeOnly));
      if (!typeOnly) push(node, node.moduleSpecifier.text);
      return;
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      const isDynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamic || isRequire) push(node, node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/**
 * "./node" の入口から値で辿れるファイルのうち、React・Next を読む最初の所(lib ごとに 1 つ)。無ければ null
 * @param {string} root
 * @param {string} entryFile repo 相対
 * @returns {{ file: string, line: number, specifier: string, chain: string[] } | null}
 */
export function findReactInNodeEntry(root, entryFile) {
  /** @type {Map<string, string[]>} ファイル → 入口からの道 */
  const seen = new Map([[entryFile, [entryFile]]]);
  const queue = [entryFile];
  while (queue.length > 0) {
    const file = /** @type {string} */ (queue.shift());
    const chain = /** @type {string[]} */ (seen.get(file));
    const text = readFileSync(path.join(root, file), "utf8");
    for (const { specifier, line } of runtimeImports(text, file)) {
      const banned = bannedPackageOf(specifier);
      if (banned) return { file, line, specifier, chain };
      const resolved = resolveImport(specifier, path.join(root, file), root);
      if (!resolved || !resolved.startsWith("src/")) continue;
      const next = toFile(root, resolved);
      if (!next || seen.has(next)) continue;
      seen.set(next, [...chain, next]);
      queue.push(next);
    }
  }
  return null;
}

/**
 * 入口の中身の不備(形に問題の無い lib だけを呼ぶ)
 * @param {string} root
 * @param {string} lib
 * @returns {{ lib: string, code: string, message: string }[]}
 */
export function entryProblems(root, lib) {
  const pkg = readLibPackage(root, lib);
  if (!pkg) return [];
  const out = [];
  for (const entry of pkg.exports) {
    const file = `${LIB_DIR}/${lib}/${entry.targetPath}`;
    if (!existsSync(path.join(root, file))) continue;
    if (entry.key === "." && hasUseClient(readFileSync(path.join(root, file), "utf8"), file)) {
      out.push({
        lib,
        code: "entryUseClient",
        message: `${file}: 入口 "." の先頭に "use client" は書きません(server が入口を通して読む値が全部 client の参照になる。"use client" は要る部品のファイルにだけ書く: core/lib.md entry_no_use_client)`,
      });
    }
    if (entry.key === "./node") {
      const hit = findReactInNodeEntry(root, file);
      if (hit) {
        out.push({
          lib,
          code: "nodeEntryReact",
          message: `${hit.file}:${hit.line}: 入口 "./node" から辿れるファイルが "${hit.specifier}" を読みます(./node は Next の外のプログラムが読む入口で、React と Next を引きません。道: ${hit.chain.join(" → ")}。読む物を "." へ分けるか、この道を切る: src/lib/README.md 手順 4)`,
        });
      }
    }
  }
  return out;
}
