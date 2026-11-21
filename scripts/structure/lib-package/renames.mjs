// scripts/structure/lib-package/renames.mjs
//
// 改名表(renames.json)と、codemod の改名の 2 つの段。どちらも名前だけでは書き換えない(TypeScript の検査器で確かめる)。
// - method: 受け手の型が lib の中で新しい名前(to)を宣言し、古い名前(from)を自分では持たない時だけ、x.from / x["from"] /
//   { from } = x(→ { to: from }。to が予約語 delete でも束縛名は元のまま)/ { from: y } = x を書き換える = lib の改名の後の木
//   (上流は lib を改名した段、fork は notice を取り込んだ後)。ドメインの包み({ ...service, from: … } のように、そうした受け手を
//   広げた object literal の中の from)は上書きとして同じく書き換え、その包みを通した呼び出しも追う。受け手の型が any / unknown /
//   誤り(解けない import)で、ファイルがその lib を読んでいる物は untyped として報告だけする
// - export: lib の入口から出す名前の改名。codemod.mjs が import の名前を書き換え、別名の無い import ならこのファイルの
//   bindingRenameEdits がその束縛の参照(検査器の symbol が同じ物だけ)を書き換える
// 表の行: { segment, lib, kind: "method" | "export", from, to, receivers?(method: 受け手の説明), origin?(export: 同じ名前が
// lib の別の物にもある時、<base> の木で名前の実体が置かれたファイル。--base が要る) }
// 移行の間だけの道具: 全部の lib が閉じた段(D101 (6))で moved・codemod とともに消す

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export const RENAMES_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "renames.json");

const NAME_RE = /^[A-Za-z_$][\w$]*$/;
const toPosix = (p) => p.split(path.sep).join("/");

/**
 * 表を読んで形を確かめる。誤りは throw(codemod は exit 2)
 * @param {string} [file]
 * @returns {{ segment: string, lib: string, kind: "method" | "export", from: string, to: string, receivers?: string, origin?: string }[]}
 */
export function loadRenames(file = RENAMES_FILE) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  return validateRenames(json.rows ?? []);
}

/** 行の形を確かめる(誤りは throw) */
export function validateRenames(rows) {
  if (!Array.isArray(rows)) throw new Error("renames: rows が配列でない");
  rows.forEach((row, i) => {
    const at = `renames: rows[${i}]`;
    for (const key of ["segment", "lib", "kind", "from", "to"]) if (typeof row?.[key] !== "string" || row[key] === "") throw new Error(`${at} の ${key} が無い`);
    if (row.kind !== "method" && row.kind !== "export") throw new Error(`${at} の kind は method か export`);
    if (!NAME_RE.test(row.from) || !NAME_RE.test(row.to) || row.from === row.to) throw new Error(`${at} の from / to が名前でない(か同じ)`);
    if (row.origin !== undefined && (row.kind !== "export" || typeof row.origin !== "string")) throw new Error(`${at} の origin は export の行の repo 相対パスだけ`);
  });
  return rows;
}

function compilerOptions(root) {
  const configFile = path.join(root, "tsconfig.json");
  const read = ts.readConfigFile(configFile, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, root, undefined, configFile);
  const options = { ...parsed.options };
  options.noEmit = true;
  options.incremental = false;
  options.allowJs = true;
  options.skipLibCheck = true;
  options.module ??= ts.ModuleKind.ESNext;
  options.moduleResolution ??= ts.ModuleResolutionKind.Bundler;
  options.jsx ??= ts.JsxEmit.Preserve;
  options.target ??= ts.ScriptTarget.ES2022;
  return options;
}

const lineOf = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;

/** プロパティ名の書き換え(識別子はそのまま、文字列の名前は引用符を保つ) */
function renameNameEdit(sf, nameNode, to) {
  const start = nameNode.getStart(sf);
  const text = ts.isStringLiteral(nameNode) ? `${sf.text[start]}${to}${sf.text[start]}` : to;
  return { start, end: nameNode.end, text };
}

const nameTextOf = (node) => (node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : null);

/**
 * method の行の書き換え(ファイルは書かない)
 * @param {string} root
 * @param {string[]} files repo 相対(走査の対象。古い名前を含む物だけを検査器にかける)
 * @param {ReturnType<typeof loadRenames>} table
 * @returns {{ changes: { file, line, from, to, names, start, end, text }[], stops: { file, line, specifier, kind, detail }[] }}
 */
export function planMethodRenames(root, files, table) {
  const rows = table.filter((row) => row.kind === "method");
  const changes = [];
  const stops = [];
  if (rows.length === 0) return { changes, stops };
  const olds = new Set(rows.map((row) => row.from));
  const wordRe = new RegExp(`\\b(${[...olds].join("|")})\\b`);
  const targets = files.filter((file) => /\.(ts|tsx|mts|cts|mjs|js|jsx|cjs)$/.test(file) && wordRe.test(readFileSync(path.join(root, file), "utf8")));
  if (targets.length === 0) return { changes, stops };

  const program = ts.createProgram({ rootNames: targets.map((file) => path.join(root, file)), options: compilerOptions(root) });
  const checker = program.getTypeChecker();
  const inLib = (decl, lib) => toPosix(path.relative(root, decl.getSourceFile().fileName)).startsWith(`src/lib/${lib}/`);
  const declaresNew = (type, row) => Boolean(checker.getPropertyOfType(type, row.to)?.declarations?.some((d) => inLib(d, row.lib)));
  /** 改名後の lib の物そのもの(新しい名前を lib が宣言し、古い名前を持たない) */
  const isRenamedSource = (type, row) => declaresNew(type, row) && !checker.getPropertyOfType(type, row.from);
  const typeOf = (node) => checker.getNonNullableType(checker.getTypeAtLocation(node));
  const isUntyped = (type) => Boolean(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown));

  const sources = targets.map((file) => ({ file, sf: program.getSourceFile(path.join(root, file)) })).filter((s) => s.sf);

  // 1 周目: 包みの上書き(改名後の lib の物を広げた object literal の中の古い名前)
  const overrides = new Map(); // 宣言の node → row
  const visitLiterals = (node) => {
    if (ts.isObjectLiteralExpression(node) && node.properties.some(ts.isSpreadAssignment)) {
      const spreads = node.properties.filter(ts.isSpreadAssignment).map((s) => typeOf(s.expression));
      for (const prop of node.properties) {
        const name = ts.isShorthandPropertyAssignment(prop) ? prop.name.text : nameTextOf(prop.name);
        if (!name || !olds.has(name)) continue;
        const row = rows.find((r) => r.from === name && spreads.some((t) => isRenamedSource(t, r)));
        if (row) overrides.set(prop, row);
      }
    }
    ts.forEachChild(node, visitLiterals);
  };
  for (const { sf } of sources) visitLiterals(sf);

  /** 受け手の型でこの名前を書き換えるか: row / "untyped" / null */
  const decide = (type, name) => {
    if (isUntyped(type)) return "untyped";
    for (const row of rows) {
      if (row.from !== name || !declaresNew(type, row)) continue;
      const old = checker.getPropertyOfType(type, row.from);
      if (!old) return row;
      if (old.declarations?.length && old.declarations.every((d) => overrides.get(d) === row)) return row;
    }
    return null;
  };

  for (const { file, sf } of sources) {
    const text = sf.text;
    const readsLib = (row) => text.includes(`lib/${row.lib}`);
    const push = (node, row, edit) => changes.push({ file, line: lineOf(sf, edit.start), from: row.from, to: row.to, names: [row.from], ...edit });
    const untyped = (node, name) => {
      const related = rows.filter((r) => r.from === name && readsLib(r));
      if (related.length === 0) return;
      stops.push({ file, line: lineOf(sf, node.getStart(sf)), specifier: name, kind: "untyped", detail: `受け手の型が分からない(any / unknown / 解けない import)。${related.map((r) => `${r.from} → ${r.to}`).join(", ")} を書き換えていない` });
    };
    const visit = (node) => {
      if (overrides.has(node)) {
        const row = overrides.get(node);
        if (ts.isShorthandPropertyAssignment(node)) push(node, row, { start: node.name.getStart(sf), end: node.name.end, text: `${row.to}: ${row.from}` });
        else push(node, row, renameNameEdit(sf, node.name, row.to));
      } else if (ts.isPropertyAccessExpression(node) && olds.has(node.name.text)) {
        const verdict = decide(typeOf(node.expression), node.name.text);
        if (verdict === "untyped") untyped(node, node.name.text);
        else if (verdict) push(node, verdict, renameNameEdit(sf, node.name, verdict.to));
      } else if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) && olds.has(node.argumentExpression.text)) {
        const verdict = decide(typeOf(node.expression), node.argumentExpression.text);
        if (verdict === "untyped") untyped(node, node.argumentExpression.text);
        else if (verdict) push(node, verdict, renameNameEdit(sf, node.argumentExpression, verdict.to));
      } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent) && !node.dotDotDotToken) {
        const key = node.propertyName ?? node.name;
        const name = nameTextOf(key);
        if (name && olds.has(name)) {
          const verdict = decide(typeOf(node.parent), name);
          if (verdict === "untyped") untyped(node, name);
          else if (verdict && node.propertyName) push(node, verdict, renameNameEdit(sf, node.propertyName, verdict.to));
          else if (verdict) push(node, verdict, { start: node.name.getStart(sf), end: node.name.end, text: `${verdict.to}: ${verdict.from}` });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { changes, stops };
}

/**
 * export の行で、別名の無い import の束縛を改名した時の、このファイルの参照の書き換え(import 文の中は codemod.mjs が書く)
 * 参照 = 検査器の symbol が import の束縛と同じ識別子(名前だけで選ばない)。1 ファイルの program(import は解かない)で引く
 * @param {string} file repo 相対
 * @param {string} text
 * @param {{ from: string, to: string }[]} renames
 * @returns {{ edits: { start, end, text, line }[], stops: { line, name, detail }[] }}
 */
export function bindingRenameEdits(root, file, text, renames) {
  const abs = path.join(root, file);
  const host = ts.createCompilerHost({ allowJs: true, noResolve: true, noEmit: true });
  const original = host.getSourceFile;
  host.getSourceFile = (name, version, onError, create) =>
    path.resolve(name) === abs ? ts.createSourceFile(name, text, version, true) : original.call(host, name, version, onError, create);
  const program = ts.createProgram({ rootNames: [abs], options: { allowJs: true, noResolve: true, noEmit: true, noLib: true, jsx: ts.JsxEmit.Preserve, types: [] }, host });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(abs);
  const edits = [];
  const stops = [];
  for (const { from, to } of renames) {
    let symbol = null;
    for (const st of sf.statements) {
      if (!ts.isImportDeclaration(st)) continue;
      const bindings = st.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      const el = bindings.elements.find((e) => e.name.text === from);
      if (el) symbol = checker.getSymbolAtLocation(el.name);
    }
    if (!symbol) continue;
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) return;
      if (ts.isShorthandPropertyAssignment(node) && node.name.text === from && checker.getShorthandAssignmentValueSymbol(node) === symbol) {
        edits.push({ start: node.name.getStart(sf), end: node.name.end, text: `${from}: ${to}`, line: lineOf(sf, node.getStart(sf)) });
        return;
      }
      if (ts.isExportSpecifier(node) && !node.parent.parent.moduleSpecifier && (node.propertyName ?? node.name).text === from) {
        stops.push({ line: lineOf(sf, node.getStart(sf)), name: from, detail: `${from} をこのファイルから出し直している(出す名前を変えると読み手が壊れる。手で決める)` });
        return;
      }
      if (ts.isIdentifier(node) && node.text === from && checker.getSymbolAtLocation(node) === symbol) {
        const parent = node.parent;
        const isPropertyName = (ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isPropertyAssignment(parent) && parent.name === node) || (ts.isQualifiedName(parent) && parent.right === node);
        if (!isPropertyName) edits.push({ start: node.getStart(sf), end: node.end, text: to, line: lineOf(sf, node.getStart(sf)) });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { edits, stops };
}
