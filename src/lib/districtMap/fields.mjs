// src/lib/districtMap/fields.mjs
// 地区の欄を字面で読む部品(ファイルは実行しない)。どれも (パス, 本文) を受けて値か問題を返す純粋な関数。
// - 表名: pgTable("<名前>", …) の字面(tableScan と同じ読み方。コメントの中は見ない)
// - domainEntry: domainEntries の直下のキー(汎用 API・表の資源の名前、目録 D4)と、各キーの requires
// - 門の規則: rule の features(閉じられるフォルダ、"core/<d>" か "<d>")
// - 枠: _layout/config.ts の export する object の frame: "<名前>"(設定 D75)

import ts from "typescript";

const PG_TABLE_CALL = /\bpgTable\s*\(/g;
const PG_TABLE_LITERAL = /^\s*["'`]([A-Za-z0-9_]+)["'`]/;

/** コメントを空白に(JSDoc の使用例 `pgTable("x", …)` を拾わないため) */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/**
 * 1 ファイルの pgTable の表名
 * @param {string} path
 * @param {string} text
 * @returns {{ tables: string[], problems: string[] }}
 */
export function readTableNames(path, text) {
  const tables = [];
  const problems = [];
  const body = stripComments(text);
  for (const match of body.matchAll(PG_TABLE_CALL)) {
    const literal = PG_TABLE_LITERAL.exec(body.slice(match.index + match[0].length));
    if (literal) tables.push(literal[1]);
    else problems.push(`${path}: pgTable の表名が文字列リテラルでない(字面で読めない)`);
  }
  return { tables, problems };
}

const parse = (path, text) => ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** as・satisfies・括弧を外した式 */
function unwrap(node) {
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression;
  return node;
}

/** export const の (名前, 初期値) */
function* exportedConsts(source) {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) yield { name: declaration.name.text, init: unwrap(declaration.initializer) };
    }
  }
}

const propertyName = (property) => {
  const name = property.name;
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  return null;
};

/** object リテラルの直下の名前 → 値の式 */
function propertiesOf(object) {
  const out = new Map();
  for (const property of object.properties) {
    const name = propertyName(property);
    if (name === null) continue;
    out.set(name, ts.isPropertyAssignment(property) ? unwrap(property.initializer) : null);
  }
  return out;
}

/** 文字列リテラルの配列 → 値。そうでなければ null */
function stringArray(node) {
  if (!node || !ts.isArrayLiteralExpression(node)) return null;
  const values = [];
  for (const element of node.elements) {
    const value = unwrap(element);
    if (!(ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) return null;
    values.push(value.text);
  }
  return values;
}

/**
 * domainEntry.ts の domainEntries のキーと requires
 * @param {string} path
 * @param {string} text
 * @returns {{ keys: string[], requires: string[], problems: string[] }}
 */
export function readDomainEntry(path, text) {
  const source = parse(path, text);
  const found = [...exportedConsts(source)].find((c) => c.name === "domainEntries");
  if (!found || !ts.isObjectLiteralExpression(found.init)) return { keys: [], requires: [], problems: [`${path}: domainEntries が読めない(export const domainEntries = { … } が無い。キーを字面で読む)`] };
  const keys = [];
  const requires = [];
  const problems = [];
  for (const [key, value] of propertiesOf(found.init)) {
    keys.push(key);
    if (!value || !ts.isObjectLiteralExpression(value)) continue;
    const field = propertiesOf(value);
    if (!field.has("requires")) continue;
    const names = stringArray(field.get("requires"));
    if (names === null) problems.push(`${path}: キー "${key}" の requires は文字列リテラルの配列で書く(字面で読む)`);
    else requires.push(...names);
  }
  return { keys, requires: [...new Set(requires)], problems };
}

/**
 * 門の規則のファイルの domains(機能が使うドメインのフォルダ、無ければ [])。古い名前 features は生成器(pnpm generate extensions)が止める
 * @param {string} path
 * @param {string} text
 * @returns {{ domains: string[], problems: string[] }}
 */
export function readRuleDomains(path, text) {
  const source = parse(path, text);
  const found = [...exportedConsts(source)].find((c) => c.name === "rule");
  if (!found || !ts.isObjectLiteralExpression(found.init)) return { domains: [], problems: [`${path}: export const rule = { … } が無い`] };
  const field = propertiesOf(found.init);
  if (!field.has("domains")) return { domains: [], problems: [] };
  const domains = stringArray(field.get("domains"));
  if (domains === null) return { domains: [], problems: [`${path}: domains は文字列リテラルの配列で書く(字面で読む)`] };
  return { domains, problems: [] };
}

/**
 * 枠の config.ts の frame: "<名前>"。export する object のどれか 1 つの直下に書く
 * @param {string} path
 * @param {string} text
 * @returns {{ frame: string | null, problems: string[] }}
 */
export function readFrameName(path, text) {
  const source = parse(path, text);
  const names = [];
  const problems = [];
  for (const { init } of exportedConsts(source)) {
    if (!ts.isObjectLiteralExpression(init)) continue;
    const field = propertiesOf(init);
    if (!field.has("frame")) continue;
    const value = field.get("frame");
    if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) && value.text.length > 0) names.push(value.text);
    else problems.push(`${path}: frame は文字列リテラルで書く(枠の名前、字面で読む)`);
  }
  if (names.length > 1) problems.push(`${path}: frame の宣言が ${names.length} つある(1 ファイル 1 枠)`);
  return { frame: names.length === 1 ? names[0] : null, problems };
}

/** 持ち主が上書きに許す読み込みの宣言の名前(設定 D35・L1.19) */
export const OVERRIDE_IMPORTS_EXPORT = "overrideImports";

/**
 * 持ち主の config.ts(部品は config.ui.ts)の `export const overrideImports = ["<指定子の前方一致>", …] as const`(設定 D35・L1.19)。
 * その持ち主の上書きファイルでだけ、この指定子(か、その下の指定子)の値の import を許す。宣言は持ち主のファイルにだけ書ける(上書きの中に書いても効かない)
 * @param {string} path
 * @param {string} text
 * @returns {{ imports: string[], problems: string[] }}
 */
export function readOverrideImports(path, text) {
  const source = parse(path, text);
  const imports = [];
  const problems = [];
  for (const { name, init } of exportedConsts(source)) {
    if (name !== OVERRIDE_IMPORTS_EXPORT) continue;
    let node = init;
    while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
    if (!ts.isArrayLiteralExpression(node)) {
      problems.push(`${path}: ${OVERRIDE_IMPORTS_EXPORT} は指定子の文字列の配列で書く(字面で読む)`);
      continue;
    }
    for (const element of node.elements) {
      if ((ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element)) && element.text.length > 0) imports.push(element.text);
      else problems.push(`${path}: ${OVERRIDE_IMPORTS_EXPORT} の項目は文字列リテラル(${element.getText(source)})`);
    }
  }
  return { imports, problems };
}
