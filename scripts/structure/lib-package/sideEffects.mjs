// scripts/structure/lib-package/sideEffects.mjs
//
// package.json の sideEffects の宣言と、lib のファイルの副作用を照らす(D84・D86)。
// 副作用 = モジュールの直下で読み込んだだけで起きること(.claude/rules/core/components.md bundle_marker の「css import, registration call」):
//   1. 名前を受け取らない import(import "./x.css" / import "./register")
//   2. 式の文(関数の呼び出し・代入など。先頭の "use client" 等の指示は除く)
//   3. if / for / while / do / switch / try / ブロック / ラベル / throw の文
// 数えない: 宣言(function / class / type / interface / enum / const x = f() を含む変数)・export。
// 書き方だけで見る(初期化の式の中の呼び出しは見ない)。テスト・型の宣言(.d.ts)は数えない。

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { LIB_DIR, readLibPackage } from "../../../src/lib/libPackage/index.mjs";
import { globToRegExp } from "../../runner/gates/changed.mjs";

const SOURCE_RE = /\.(ts|tsx|mts|mjs|js|jsx)$/;
const SKIP_RE = /(\.test\.|\.spec\.|\.d\.ts$|(^|\/)__tests__\/)/;

const toPosix = (p) => p.split(path.sep).join("/");

function walk(dir, base = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (SOURCE_RE.test(entry.name) && !SKIP_RE.test(rel)) out.push(rel);
  }
  return out;
}

const scriptKindOf = (file) =>
  file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".jsx") ? ts.ScriptKind.JSX : /\.(mjs|js)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;

const EFFECT_KINDS = new Map([
  [ts.SyntaxKind.IfStatement, "if 文"],
  [ts.SyntaxKind.ForStatement, "for 文"],
  [ts.SyntaxKind.ForInStatement, "for 文"],
  [ts.SyntaxKind.ForOfStatement, "for 文"],
  [ts.SyntaxKind.WhileStatement, "while 文"],
  [ts.SyntaxKind.DoStatement, "do 文"],
  [ts.SyntaxKind.SwitchStatement, "switch 文"],
  [ts.SyntaxKind.TryStatement, "try 文"],
  [ts.SyntaxKind.Block, "ブロック"],
  [ts.SyntaxKind.LabeledStatement, "ラベルの文"],
  [ts.SyntaxKind.ThrowStatement, "throw 文"],
]);

/** 1 ファイルのモジュール直下の副作用 [{ line, what }] */
export function sideEffectsInSource(fileName, text) {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKindOf(fileName));
  const out = [];
  let prologue = true;
  for (const statement of source.statements) {
    const line = source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1;
    const directive = ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression);
    if (!(prologue && directive)) prologue = false;
    if (directive && prologue) continue;
    if (ts.isImportDeclaration(statement) && !statement.importClause) {
      out.push({ line, what: `名前を受け取らない import ${statement.moduleSpecifier.getText(source)}` });
    } else if (ts.isExpressionStatement(statement)) {
      out.push({ line, what: "モジュール直下の式の文" });
    } else if (EFFECT_KINDS.has(statement.kind)) {
      out.push({ line, what: `モジュール直下の${EFFECT_KINDS.get(statement.kind)}` });
    }
  }
  return out;
}

/** lib の中のファイルの副作用 [{ file(lib 相対), line, what }] */
export function findSideEffects(root, lib) {
  const dir = path.join(root, LIB_DIR, lib);
  return walk(dir).flatMap((file) => sideEffectsInSource(file, readFileSync(path.join(dir, file), "utf8")).map((hit) => ({ file: toPosix(file), ...hit })));
}

/** sideEffects の一覧の 1 項目(npm と同じく "/" の無い glob はどの段のファイル名にも当たる)→ lib 相対のパスに当たるか */
export function sideEffectsGlobMatcher(globs) {
  const res = globs.map((glob) => {
    const g = glob.replace(/^\.\//, "");
    return globToRegExp(g.includes("/") ? g : `**/${g}`);
  });
  return (file) => res.some((re) => re.test(file));
}

/**
 * 宣言と照らす。問題の一覧(無ければ空)
 * - sideEffects: false → 副作用が 1 つでもあれば問題
 * - sideEffects: [glob] → 副作用のあるファイルが一覧に当たらなければ問題
 * - 書いていない → 見ない(副作用ありとして扱われる)
 */
export function checkSideEffects(root, lib) {
  const pkg = readLibPackage(root, lib);
  if (!pkg || pkg.sideEffects === undefined) return [];
  const listed = pkg.sideEffects === false ? () => false : sideEffectsGlobMatcher(pkg.sideEffects);
  const file = `${LIB_DIR}/${lib}`;
  return findSideEffects(root, lib)
    .filter((hit) => !listed(hit.file))
    .map((hit) => ({
      lib,
      code: "sideEffects",
      message: `${file}/${hit.file}:${hit.line}: ${hit.what} があります(package.json の sideEffects が ${JSON.stringify(pkg.sideEffects)}。副作用を除くか、このファイルを sideEffects の一覧に書きます)`,
    }));
}
