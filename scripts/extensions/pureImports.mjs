// scripts/extensions/pureImports.mjs
// 宣言の pureImports: 項目のファイルから値 import を推移的に辿り、proxy・client の両方から読めない物へ届いたら失敗にする。
// 通すのは zod と src の下の純関数・値だけ。パッケージ(react・next・server-only・drizzle など)と、
// サービス・部品・hook・DB の定義の置き場は失敗。型だけの import は辿らない。

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";

import { resolveImport } from "../../eslint-rules/resolve-import.mjs";

const ALLOWED_PACKAGES = new Set(["zod"]);
const FORBIDDEN_PATH = /^src\/app\/|(^|\/)(services|components|hooks|stores)(\/|$)|(^|\/)entities\/drizzle(\.|$)|^src\/lib\/drizzle(\/|$)|\.tsx$/;

/** ファイルの値 import の指定子(型だけの import・export は除く) */
function valueSpecifiers(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const found = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const onlyTypes = clause?.isTypeOnly || (clause && !clause.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((e) => e.isTypeOnly));
      if (!onlyTypes) found.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) {
      found.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const CANDIDATES = (p) => [p, `${p}.ts`, `${p}.tsx`, `${p}.mjs`, `${p}/index.ts`, `${p}/index.tsx`];

/**
 * 項目から辿って読めない物に届く経路を返す
 * @param {string} repoRoot
 * @param {string} itemPath リポジトリ直下からの相対
 * @returns {string[]} 問題の文
 */
export function checkPureImports(repoRoot, itemPath) {
  const problems = [];
  const seen = new Set();
  const walk = (path, chain) => {
    if (seen.has(path)) return;
    seen.add(path);
    for (const specifier of valueSpecifiers(path, readFileSync(join(repoRoot, path), "utf8"))) {
      const route = [...chain, specifier].join(" → ");
      const resolved = resolveImport(specifier, join(repoRoot, path), repoRoot);
      if (resolved === null) {
        if (!ALLOWED_PACKAGES.has(specifier)) problems.push(`${itemPath}: 値 import で ${specifier} に届く(${route})。キーは zod・@/config・純関数・型だけ`);
        continue;
      }
      const file = CANDIDATES(resolved).find((c) => existsSync(join(repoRoot, c)) && /\.(ts|tsx|mjs)$/.test(c));
      if (FORBIDDEN_PATH.test(file ?? resolved)) {
        problems.push(`${itemPath}: 値 import で ${file ?? resolved} に届く(${route})。キーは zod・@/config・純関数・型だけ`);
        continue;
      }
      if (file) walk(file, [...chain, specifier]);
    }
  };
  walk(itemPath, []);
  return problems;
}

/** override のファイルの export const override の object のキー。読めなければ null */
export function overrideKeys(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of statement.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== "override" || !d.initializer) continue;
      let node = d.initializer;
      while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
      if (!ts.isObjectLiteralExpression(node)) return null;
      const keys = [];
      for (const p of node.properties) {
        if (!(ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) return null;
        keys.push(p.name.text);
      }
      return keys;
    }
  }
  return null;
}
