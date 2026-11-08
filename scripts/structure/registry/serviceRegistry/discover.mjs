// scripts/structure/registry/serviceRegistry/discover.mjs
// src/features/**/services/server/domainEntry.ts（と fork の domainEntry.override.ts）を走査し、
// src/registry/serviceRegistry.ts の生成・検査に必要な情報を集める（一覧ファイルは持たない）。
//
// 利用者: ./generate.mjs（pnpm generate registry）, ./check.mjs（pnpm check registry）,
//         ./serviceRegistry.test.mjs（pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs）, scripts/structure/domain（pnpm generate domain / pnpm generate domain -- --delete の最後）
// TS を実行せずテキストで読む（キーの一覧・import 行）。plain node で動くので pnpm generate domain から直接呼べる。
// サービスを実際に読み込む検査はテスト側（tsx）。

import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

import { resolveImport } from "../../../../eslint-rules/resolve-import.mjs";
import { readDistrictMapAt } from "../../../../src/lib/districtMap/node.mjs";
import { scanObjectEntries } from "../../domain/text/objectEntry.mjs";
import { toCamelCase } from "../../../../src/utils/stringCase.mjs";

export const ENTRY_FILE = "domainEntry.ts";
export const OVERRIDE_FILE = "domainEntry.override.ts";
export const ENTRIES_EXPORT = "domainEntries";
export const OVERRIDES_EXPORT = "domainEntryOverrides";
export const REGISTRY_FILE = "src/registry/serviceRegistry.ts";
/** 生成物の 1 行目（この行が無いファイル = 移行前の手書き登録表） */
export const GENERATED_HEADER = "// 生成物・編集不可: pnpm generate registry が src/features/**/services/server/domainEntry.ts から生成する";

/**
 * drizzleBase.ts / firestoreBase.ts があるのに domainEntry.ts を持たなくてよいドメイン（features 相対のディレクトリ名）。
 * 縮むだけの例外表: 行を足すのは新しいドメインを登録表から意図して外すときだけで、理由を書く。
 */
export const ENTRY_EXCEPTIONS = {};

/**
 * ドメインのフォルダの一覧(`src/features` からの相対 `<dir>` か `core/<dir>`、`_` 始まりの雛形は地区でないので含まない)。
 * ドメインの見つけ方は地区の地図の読み手 src/lib/districtMap が持つ(目録 D1・D3)
 */
export function listDomainDirs(repoRoot) {
  return readDistrictMapAt(repoRoot)
    .districts.filter((district) => district.kind === "features")
    .map((district) => district.dir.slice("src/features/".length))
    .sort();
}

/** 文字列・コメントを除いたテキスト（import 行や識別子の検出用） */
function stripComments(text) {
  // 行コメントを先に消す（`/api/<domain>/**` のような行コメント内の `/**` をブロックコメントの開始と誤認しないため）
  return text.replace(/^[ \t]*\/\/[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

// ---------------------------------------------------------------------------
// domainEntry.ts / domainEntry.override.ts の静的 import の決まり(設定の議会 D63・L1.23)
// 目的: 登録表 serviceRegistry.ts は全ドメインの domainEntry を静的に読むので、domainEntry は軽く副作用なしに保つ
// (サービスは service: () => import(...) で遅延読み込み)。決まりは置き場や名前でなく中身で見る:
// - 型だけの import(`import type`・名前がすべて type)はどこからでも可(実行時に消える)
// - 値の import は「値だけのファイル」からだけ。値だけのファイル = 文が次だけのファイル:
//   型だけの import / 値だけのファイルからの値の import と再 export / 型の宣言(type・interface) /
//   `const <名> = <値の式>`(export の有無は問わない) / `export default <値の式>` / `export { <名> }`
//   値の式 = リテラル・このファイルの定数か import した名前の参照(とその .プロパティ)・それらの object / 配列 / spread
//   (`as` / `satisfies` / 括弧は外して見る)。関数・呼び出し・new・副作用の import・let / var・enum・class は不可
// - 値の import は先のファイルも同じ決まりで推移的に確かめる。解けない指定子(パッケージ・無いファイル)は不可
// ---------------------------------------------------------------------------

const SOURCE_CANDIDATES = (base) => [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}/index.ts`, `${base}/index.tsx`];
const SOURCE_FILE = /\.(ts|tsx|mts)$/;

/** 名前付きがすべて type の import 句か(`import type` も) */
function isTypeOnlyClause(clause) {
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  const named = clause.namedBindings;
  return !clause.name && Boolean(named) && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly);
}

/** `as` / `satisfies` / 括弧 / `!` を外した式 */
function unwrapExpression(node) {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * 値の式か。だめなら理由、よければ null
 * @param {ts.Expression} node
 * @param {Set<string>} names このファイルで値として使える名前(定数・値の import)
 */
function valueExpressionProblem(node, names, source) {
  const expression = unwrapExpression(node);
  const text = () => expression.getText(source).split("\n")[0].slice(0, 60);
  if (
    ts.isStringLiteral(expression) ||
    ts.isNumericLiteral(expression) ||
    ts.isBigIntLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    expression.kind === ts.SyntaxKind.NullKeyword
  ) {
    return null;
  }
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(expression.operand)) return null;
  if (ts.isIdentifier(expression)) {
    return expression.text === "undefined" || names.has(expression.text) ? null : `このファイルの定数でも import した値でもない名前 ${expression.text}`;
  }
  if (ts.isPropertyAccessExpression(expression)) return valueExpressionProblem(expression.expression, names, source);
  if (ts.isTemplateExpression(expression)) {
    for (const span of expression.templateSpans) {
      const problem = valueExpressionProblem(span.expression, names, source);
      if (problem) return problem;
    }
    return null;
  }
  if (ts.isArrayLiteralExpression(expression)) {
    for (const element of expression.elements) {
      const problem = valueExpressionProblem(ts.isSpreadElement(element) ? element.expression : element, names, source);
      if (problem) return problem;
    }
    return null;
  }
  if (ts.isObjectLiteralExpression(expression)) {
    for (const property of expression.properties) {
      let problem;
      if (ts.isPropertyAssignment(property)) {
        problem = ts.isComputedPropertyName(property.name) ? `計算されたキー ${property.name.getText(source)}` : valueExpressionProblem(property.initializer, names, source);
      } else if (ts.isShorthandPropertyAssignment(property)) {
        problem = valueExpressionProblem(property.name, names, source);
      } else if (ts.isSpreadAssignment(property)) {
        problem = valueExpressionProblem(property.expression, names, source);
      } else {
        problem = `関数・getter のキー ${property.getText(source).split("\n")[0].slice(0, 60)}`;
      }
      if (problem) return problem;
    }
    return null;
  }
  return `値の式でない(関数・呼び出し・new・演算など): ${text()}`;
}

/**
 * import / 再 export の指定子を実ファイル(repo 相対)に解く。解けなければ null
 * @param {FileView} view
 */
function resolveSourceFile(specifier, importerAbs, repoRoot, view) {
  const resolved = resolveImport(specifier, importerAbs, repoRoot);
  if (resolved === null) return null;
  return SOURCE_CANDIDATES(resolved).find((candidate) => SOURCE_FILE.test(candidate) && view.exists(path.join(repoRoot, candidate))) ?? null;
}

/**
 * ファイルの静的 import が決まりに合うかを見て、合わない点を返す。
 * entry = true は domainEntry.ts / domainEntry.override.ts 自身(文は自由、import だけ見る)。
 * false は値の import の先(中身が値だけのファイルか)。結果は memo に覚え、循環は止まる。
 * @param {string} file repo 相対
 * @param {{ repoRoot: string, view: FileView, memo: Map<string, string[]> }} context
 * @returns {string[]} 問題の文(先頭は file から見た経路)
 */
function staticImportProblems(file, entry, context) {
  const { repoRoot, view, memo } = context;
  if (!entry && memo.has(file)) return memo.get(file);
  if (!entry) memo.set(file, []); // 循環: 辿り中のファイルは通す(同じファイルの他の文が判定する)
  const abs = path.join(repoRoot, file);
  const source = ts.createSourceFile(file, view.read(abs), ts.ScriptTarget.Latest, true);
  const problems = [];
  const names = new Set();
  /** 値の import / 再 export の先を確かめる */
  const follow = (specifier) => {
    const target = resolveSourceFile(specifier, abs, repoRoot, view);
    if (!target) {
      problems.push(`"${specifier}" を値で import している(解けない指定子: パッケージか、無いファイル。値は値だけのファイルからだけ。サービスは service: () => import(...) で遅延読み込みにする)`);
      return;
    }
    for (const problem of staticImportProblems(target, false, context)) problems.push(`"${specifier}" → ${problem}`);
  };
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : statement.moduleSpecifier.getText(source);
      const clause = statement.importClause;
      if (isTypeOnlyClause(clause)) continue;
      if (!clause) {
        problems.push(`"${specifier}" を副作用の import している(値だけのファイルにならない)`);
        continue;
      }
      if (clause.name) names.add(clause.name.text);
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) names.add(clause.namedBindings.name.text);
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) if (!element.isTypeOnly) names.add(element.name.text);
      }
      follow(specifier);
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) follow(statement.moduleSpecifier.text);
      continue;
    }
    if (entry) continue;
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isEmptyStatement(statement)) continue;
    if (ts.isVariableStatement(statement)) {
      if (!(statement.declarationList.flags & ts.NodeFlags.Const) || statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)) {
        problems.push(`${file}: let / var / declare の宣言がある(値だけのファイルは const だけ)`);
        continue;
      }
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          problems.push(`${file}: 分割代入か値の無い const がある`);
          continue;
        }
        const problem = valueExpressionProblem(declaration.initializer, names, source);
        if (problem) problems.push(`${file}: const ${declaration.name.text} が ${problem}`);
        names.add(declaration.name.text);
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      const problem = valueExpressionProblem(statement.expression, names, source);
      if (problem) problems.push(`${file}: export default が ${problem}`);
      continue;
    }
    problems.push(`${file}: 値だけのファイルに置けない文がある(関数・class・enum・式の文など): ${statement.getText(source).split("\n")[0].slice(0, 60)}`);
  }
  if (!entry) memo.set(file, problems);
  return problems;
}

/**
 * domainEntry.ts / domainEntry.override.ts の静的 import の決まり(上の説明)に合わない点を返す。
 * 型だけの import はどこからでも可、値の import は値だけのファイルからだけ(推移的に確かめる)
 * @param {string} file repo 相対(domainEntry.ts か domainEntry.override.ts)
 * @param {string} repoRoot
 * @param {FileView} [view]
 * @param {Map<string, string[]>} [memo] 同じ走査の中で同じファイルを二度読まない
 * @returns {string[]} `<file>: <問題>` の文
 */
export function checkEntryStaticImports(file, repoRoot, view = diskView, memo = new Map()) {
  return staticImportProblems(file, true, { repoRoot, view, memo }).map((problem) => `${file}: ${problem}`);
}

/** `export const <name> = {` 直下のキー一覧。無い・壊れていれば error */
export function readObjectKeys(text, exportName) {
  if (!new RegExp(`export\\s+const\\s+${exportName}\\b`).test(text)) {
    return { keys: null, error: `export const ${exportName} が無い` };
  }
  try {
    return { keys: scanObjectEntries(text, exportName).entries.map((entry) => entry.key), error: null };
  } catch (error) {
    return { keys: null, error: error.message };
  }
}

/** 登録の table / idColumn に書ける値（PostgreSQL の識別子の上限 63 文字。値の正しさは pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs が実物と比べる） */
const MAX_IDENTIFIER_LENGTH = 63;

/**
 * 1 キーの値（オブジェクトリテラル）の直下の項目を { name: 値の文字列 } で返す。オブジェクトでなければ null
 * @param {string} valueText `{ service: ..., table: "x", ... }`
 */
function readEntryFields(valueText) {
  const trimmed = valueText.trim().replace(/,$/, "");
  if (!trimmed.startsWith("{")) return null;
  const text = `const __entry = ${trimmed}`;
  const fields = {};
  for (const entry of scanObjectEntries(text, "__entry").entries) {
    const raw = text.slice(entry.start, entry.end).replace(/,$/, "");
    fields[entry.key] = raw.slice(raw.indexOf(":") + 1).replace(/^\s*(\/\/[^\n]*\n\s*)*/, "").trim();
  }
  return fields;
}

/** `"x"` / `'x'` → x、`null` → null、それ以外（定数・式・無し）→ undefined */
function readLiteral(raw) {
  if (raw === undefined) return undefined;
  const value = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*$/gm, "").trim();
  if (value === "null") return null;
  const match = /^(["'])([^"'\\]*)\1$/.exec(value);
  return match ? match[2] : undefined;
}

/**
 * domainEntry.ts の各キーの table / idColumn（D57）を読み、形の誤りを errors に積む。
 * 受け付けるのは文字列リテラルか null だけ（生成器はファイルを文字として読むので、定数・式は読めない）。
 * @returns {{ tables: Record<string, { table: string | null, idColumn: string | null }>, errors: string[] }}
 */
export function readEntryTables(text, entryPath) {
  const tables = {};
  const errors = [];
  for (const entry of scanObjectEntries(text, ENTRIES_EXPORT).entries) {
    const raw = text.slice(entry.start, entry.end);
    const fields = readEntryFields(raw.slice(raw.indexOf(":") + 1));
    const where = `${entryPath}: キー "${entry.key}"`;
    if (!fields) {
      errors.push(`${where} の値がオブジェクトリテラルでない（table / idColumn を読めない）`);
      continue;
    }
    const values = {};
    for (const name of ["table", "idColumn"]) {
      if (!(name in fields)) {
        errors.push(
          `${where} に ${name} が無い（生成ドメインは pnpm generate domain -- <domain> --yes --only registry、手書きは service の直後に ` +
            `table: "<表の物理名>", idColumn: "id" を書く。表を持たない Firestore 版は両方 null）`,
        );
        continue;
      }
      const value = readLiteral(fields[name]);
      if (value === undefined) {
        errors.push(`${where} の ${name} は文字列リテラルか null で書く（定数・式は読めない）: ${fields[name]}`);
        continue;
      }
      if (value !== null && (value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH || /[\s"'`]/.test(value))) {
        errors.push(`${where} の ${name} "${value}" は表・列の物理名の形でない（空でない・${MAX_IDENTIFIER_LENGTH} 文字以内・引用符と空白を含まない）`);
        continue;
      }
      values[name] = value;
    }
    if (!("table" in values) || !("idColumn" in values)) continue;
    if ((values.table === null) !== (values.idColumn === null)) {
      errors.push(`${where} の table と idColumn は両方 null（表を持たない Firestore 版）か両方文字列にする`);
      continue;
    }
    tables[entry.key] = { table: values.table, idColumn: values.idColumn };
  }
  return { tables, errors };
}

/**
 * 1 ドメイン分の情報
 * @typedef {{
 *   dir: string, camel: string, isCore: boolean,
 *   entryPath: string | null, importPath: string | null, keys: string[], entryErrors: string[],
 *   tables: Record<string, { table: string | null, idColumn: string | null }>,
 *   overridePath: string | null, overrideImportPath: string | null, overrideKeys: string[], overrideErrors: string[],
 *   hasBase: boolean, hasDomainJson: boolean, handManaged: boolean,
 * }} DomainEntryInfo
 */

/**
 * ファイルの見え方。既定はディスクそのまま。pnpm generate domain は「これから書くファイル」を重ねた見え方で、
 * 書く前に登録表の検査を通す（createOverlayView）
 * @typedef {{ exists: (file: string) => boolean, read: (file: string) => string }} FileView
 */
/** 空白とコメントだけのソースか */
export const isBlankSource = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim() === "";

export const diskView = { exists: (file) => fs.existsSync(file), read: (file) => fs.readFileSync(file, "utf8") };

/**
 * @param {Map<string, string | null>} overlay 絶対パス → これから書く内容（null = 消える）。無いパスはディスクを見る
 * @returns {FileView}
 */
export function createOverlayView(overlay) {
  return {
    exists: (file) => (overlay.has(file) ? overlay.get(file) !== null : fs.existsSync(file)),
    read: (file) => (overlay.has(file) ? overlay.get(file) : fs.readFileSync(file, "utf8")),
  };
}

/** domain.json が `"generate": false`（手で管理 = 生成器が domainEntry.ts を書かない）か。読めない JSON は false（生成側の検査が止める） */
export function readHandManaged(view, file) {
  try {
    return JSON.parse(view.read(file))?.generate === false;
  } catch {
    return false;
  }
}

/**
 * domainEntry.ts / override / drizzleBase / firestoreBase の有無とキーを集める
 * @param {string} repoRoot
 * @param {FileView} [view] ファイルの見え方（既定 = ディスク）
 */
export function discoverDomainEntries(repoRoot, view = diskView) {
  /** @type {DomainEntryInfo[]} */
  const domains = [];
  /** 値の import の先の判定(ファイル → 問題)。全ドメインで共有して同じファイルを二度読まない */
  const importMemo = new Map();
  for (const dir of listDomainDirs(repoRoot)) {
    const serverDir = path.join(repoRoot, "src", "features", dir, "services", "server");
    const entryFile = path.join(serverDir, ENTRY_FILE);
    const overrideFile = path.join(serverDir, OVERRIDE_FILE);
    const hasBase = view.exists(path.join(serverDir, "drizzleBase.ts")) || view.exists(path.join(serverDir, "firestoreBase.ts"));
    const domainJsonFile = path.join(repoRoot, "src", "features", dir, "domain.json");
    const hasDomainJson = view.exists(domainJsonFile);
    const camel = toCamelCase(path.basename(dir)) || path.basename(dir);
    const info = {
      dir,
      camel,
      isCore: dir.startsWith("core/"),
      entryPath: null,
      importPath: null,
      keys: [],
      entryErrors: [],
      tables: {},
      overridePath: null,
      overrideImportPath: null,
      overrideKeys: [],
      overrideErrors: [],
      hasBase,
      hasDomainJson,
      handManaged: hasDomainJson && readHandManaged(view, domainJsonFile),
    };
    const rel = `src/features/${dir}/services/server`;
    if (view.exists(entryFile)) {
      info.entryPath = `${rel}/${ENTRY_FILE}`;
      info.importPath = `@/features/${dir}/services/server/domainEntry`;
      const text = view.read(entryFile);
      const { keys, error } = readObjectKeys(text, ENTRIES_EXPORT);
      if (error) info.entryErrors.push(`${info.entryPath}: ${error}`);
      else {
        info.keys = keys;
        const read = readEntryTables(text, info.entryPath);
        info.tables = read.tables;
        info.entryErrors.push(...read.errors);
      }
      info.entryErrors.push(...checkEntryStaticImports(info.entryPath, repoRoot, view, importMemo));
    }
    // 空(空白とコメントだけ)の上書きは不在と同じ(多段で下の Tier が親の上書きを空にしてよい、D34 K1)
    if (view.exists(overrideFile) && !isBlankSource(view.read(overrideFile))) {
      info.overridePath = `${rel}/${OVERRIDE_FILE}`;
      info.overrideImportPath = `@/features/${dir}/services/server/domainEntry.override`;
      const text = view.read(overrideFile);
      const { keys, error } = readObjectKeys(text, OVERRIDES_EXPORT);
      if (error) info.overrideErrors.push(`${info.overridePath}: ${error}`);
      else info.overrideKeys = keys;
      info.overrideErrors.push(...checkEntryStaticImports(info.overridePath, repoRoot, view, importMemo));
      if (!info.entryPath) {
        info.overrideErrors.push(`${info.overridePath}: 隣に ${ENTRY_FILE} が無い（上書きだけでは登録できない）`);
      } else {
        for (const key of info.overrideKeys) {
          if (!info.keys.includes(key)) {
            info.overrideErrors.push(`${info.overridePath}: キー "${key}" は隣の ${ENTRY_FILE} に無い`);
          }
        }
      }
    }
    domains.push(info);
  }
  return domains;
}

/** src/ 配下（*.test.* を除く）の storageBindingFor("<record_type>", ...) の第 1 引数とファイル */
export function listStorageBindingRecordTypes(repoRoot) {
  const result = [];
  const walk = (dir) => {
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        if (dirent.name === "node_modules" || dirent.name.startsWith(".")) continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|mts)$/.test(dirent.name) || /\.test\./.test(dirent.name)) continue;
      const text = fs.readFileSync(full, "utf8");
      if (!text.includes("storageBindingFor(")) continue;
      for (const match of stripComments(text).matchAll(/storageBindingFor\(\s*["']([^"']+)["']/g)) {
        result.push({ recordType: match[1], file: path.relative(repoRoot, full).split(path.sep).join("/") });
      }
    }
  };
  walk(path.join(repoRoot, "src"));
  return result;
}

/** 既存の serviceRegistry.ts の情報（無ければ null） */
export function readExistingRegistry(repoRoot) {
  const file = path.join(repoRoot, REGISTRY_FILE);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const generated = text.split(/\r?\n/)[0] === GENERATED_HEADER;
  const { keys, error } = readObjectKeys(text, "serviceRegistry");
  // 旧形式: `import { xService } from "@/features/.../services/server/xService"` からキー → ドメインを推定（移し先の案内に使う）
  const serviceImports = new Map();
  for (const match of text.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*["']@\/features\/((?:core\/)?[\w-]+)\/services\/server[^"']*["']/g)) {
    serviceImports.set(match[1], match[2]);
  }
  return { text, generated, keys: keys ?? [], error, serviceImports };
}
