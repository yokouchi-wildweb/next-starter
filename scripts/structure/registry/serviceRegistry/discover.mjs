// scripts/structure/registry/serviceRegistry/discover.mjs
// 登録の宣言(src/domains/**/entities/<登録名>/entity.json、D335・D336)と fork の上書き entities/<登録名>/entity.override.ts を読み、
// src/registry/serviceRegistry.ts の生成・検査に必要な行を集める(一覧ファイルは持たない)。
//
// 利用者: ./generate.mjs(pnpm generate registry), ./check.mjs(pnpm check registry),
//         ./serviceRegistry.test.mjs, scripts/structure/domain(pnpm generate domain / pnpm generate domain -- --delete の最後)
// 宣言は宣言の読み込みの部品(src/lib/domain の readDomain)だけで読み、上書きは TS を実行せずテキストで読む(キーの一覧・import 行)。
// plain node で動くので pnpm generate domain から直接呼べる。サービスを実際に読み込む検査はテスト側(tsx)。

import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

import { resolveImport } from "../../../../eslint-rules/resolve-import.mjs";
import { overrideKeysOf, readDistrictMapAt } from "../../../../src/lib/districtMap/node.mjs";
import { ENTITIES_DIR, ENTITY_DECLARATION_FILE, isRegisteredRegistration, nodeDomainSource, readDomain } from "../../../../src/lib/domain/node.mjs";
import { toSnakeCase } from "../../../../src/lib/stringCase/index.mjs";
import { domainTableName } from "../../domain/domain/names.mjs";
import { scanObjectEntries } from "../../domain/text/objectEntry.mjs";
import { accessOfDeclaration } from "./access.mjs";

/** fork の上書きのファイル(登録のフォルダ entities/<登録名>/ の直下、entity.json の隣) */
export const OVERRIDE_FILE = "entity.override.ts";
/** 上書きの点の名前(src/lib/domain/extensionPoints.ts) */
export const OVERRIDE_POINT = "entities";
export const OVERRIDE_EXPORT = "entityOverride";
export const REGISTRY_FILE = "src/registry/serviceRegistry.ts";
/** 上書きしてよい鍵の宣言(src/lib/domain/extensionPoints.ts の entities) */
export const OVERRIDE_DECLARATION = "src/lib/domain/extensionPoints.ts";
/** サービスのファイルの置き場(ドメインのフォルダからの相対) */
export const SERVICE_DIR = "services/server";

/**
 * entity.override.ts が差し替える鍵(宣言の overrideOf)。登録表の行の access を丸ごと差し替える 1 つだけ(apiAccess)
 * @returns {string}
 */
export function overrideAttribute() {
  const keys = overrideKeysOf(OVERRIDE_DECLARATION, OVERRIDE_POINT);
  if (keys.length !== 1) {
    throw new Error(`${OVERRIDE_DECLARATION} の ${OVERRIDE_POINT} の overrideOf は 1 つだけ(${OVERRIDE_FILE} は登録表の access を丸ごと差し替える。今: ${keys.join(" / ")})`);
  }
  return keys[0];
}
/** 生成物の 1 行目 */
export const GENERATED_HEADER = "// 生成物・編集不可: pnpm generate registry が src/domains/**/entities/*/entity.json(と fork の entity.override.ts)から生成する";
/** 生成物の印(前の版の 1 行目も生成物として読む) */
const GENERATED_PREFIX = "// 生成物・編集不可: pnpm generate registry が ";

/**
 * ドメインのフォルダの一覧(`src/domains` からの相対 `<dir>` か `core/<dir>`、`_` 始まりの雛形は地区でないので含まない)。
 * ドメインの見つけ方は地区の地図の読み手 src/lib/districtMap が持つ(目録 D1・D3)
 */
export function listDomainDirs(repoRoot) {
  return readDistrictMapAt(repoRoot)
    .districts.filter((district) => district.kind === "domains")
    .map((district) => district.dir.slice("src/domains/".length))
    .sort();
}

/** 文字列・コメントを除いたテキスト（import 行や識別子の検出用） */
function stripComments(text) {
  // 行コメントを先に消す（`/api/<domain>/**` のような行コメント内の `/**` をブロックコメントの開始と誤認しないため）
  return text.replace(/^[ \t]*\/\/[^\n]*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

// ---------------------------------------------------------------------------
// fork の上書き entities/<登録名>/entity.override.ts の静的 import の決まり(設定の議会 D63・L1.23)
// 目的: 登録表 serviceRegistry.ts は上書きを静的に読むので、上書きは軽く副作用なしに保つ
// (サービスは登録表の service: () => import(...) で遅延読み込み)。決まりは置き場や名前でなく中身で見る:
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
 * entry = true は上書きのファイル自身(文は自由、import だけ見る)。
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
 * 上書き(entity.override.ts)の静的 import の決まり(上の説明)に合わない点を返す。
 * 型だけの import はどこからでも可、値の import は値だけのファイルからだけ(推移的に確かめる)
 * @param {string} file repo 相対(entities/<登録名>/entity.override.ts)
 * @param {string} repoRoot
 * @param {FileView} [view]
 * @param {Map<string, string[]>} [memo] 同じ走査の中で同じファイルを二度読まない
 * @returns {string[]} `<file>: <問題>` の文
 */
export function checkOverrideStaticImports(file, repoRoot, view = diskView, memo = new Map()) {
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


/** PostgreSQL の識別子の上限(表・列の物理名) */
const MAX_IDENTIFIER_LENGTH = 63;
const SERVICE_SOURCES = (base) => [`${base}.ts`, `${base}/index.ts`];

/**
 * 登録表の 1 行(登録 1 件)
 * @typedef {{
 *   key: string, dir: string, isCore: boolean, entityPath: string,
 *   service: { file: string, export: string }, serviceImport: string,
 *   table: string | null, idColumn: string | null, access: object, requires: string[],
 *   overridePath: string | null, overrideImport: string | null,
 * }} RegistryRow
 */

/**
 * 登録の表の物理名と主キーの列: Firestore は表を持たないので両方 null。表 = entity.table か snake(plural)、主キー = primaryKey の 1 列の物理名か id
 * @param {string} registration 登録名
 * @param {Record<string, any>} entity
 */
export function tableOfRegistration(registration, entity) {
  if (entity.dbEngine === "Firestore") return { table: null, idColumn: null };
  const table = typeof entity.table === "string" ? entity.table : domainTableName(registration, entity);
  const keyColumns = entity.primaryKey?.columns ?? [];
  if (keyColumns.length !== 1) return { table, idColumn: "id" };
  const name = keyColumns[0];
  const declared = [...(entity.fields ?? []), ...(entity.columns ?? [])].find((item) => item?.name === name);
  return { table, idColumn: declared?.column?.name ?? toSnakeCase(name) };
}

/** 登録のサービスの結び付き(entity.json の service か、既定 <登録名>Service) */
export const serviceOfRegistration = (registration, entity) => entity.service ?? { file: `${registration}Service`, export: `${registration}Service` };

/**
 * 全ドメインの登録(registered が false でない物)を登録表の行にし、形の誤りを errors に積む。
 * 検査: 登録名の重なり(登録表のキー = 登録名、全ドメインで一意。registered:false の登録も同じ名前の空間)・表の重なり・
 * サービスのファイルが無い・登録の無い表のサービスの土台(services/server/<名前>Base.ts の <名前> の登録が無い)・上書きの形
 * @param {string} repoRoot
 * @param {FileView} [view] ファイルの見え方(既定 = ディスク)。pnpm generate domain がこれから書くサービスを重ねて渡す
 * @returns {{ rows: RegistryRow[], errors: string[] }}
 */
export function discoverRegistrations(repoRoot, view = diskView) {
  const source = nodeDomainSource(repoRoot);
  /** @type {RegistryRow[]} */
  const rows = [];
  const errors = [];
  /** 登録名 → 宣言のパス(登録表のキーの重なり、目録 D4・cache 議会 D127) */
  const nameOwners = new Map();
  /** 値の import の先の判定(ファイル → 問題)。全ドメインで共有して同じファイルを二度読まない */
  const importMemo = new Map();
  for (const dir of listDomainDirs(repoRoot)) {
    const domainRel = `src/domains/${dir}`;
    const name = path.basename(dir);
    const declaration = readDomain(source, name);
    // 業務と core の同じフォルダ名は readDomain が片方しか読めない(登録名も重なる)。もう片方は名指して止める
    if (declaration.dir !== domainRel) {
      errors.push(`${domainRel}: フォルダ名 ${name} が ${declaration.dir} と重なる(登録のキーが同じになる。後から足した側の名前を変える)`);
      continue;
    }
    // 土台(services/server/<登録名>Base.ts)は登録ごと: 登録の無い土台は、宣言の無い表のサービス
    const serviceDir = path.join(repoRoot, domainRel, SERVICE_DIR);
    const strayBases = (fs.existsSync(serviceDir) ? fs.readdirSync(serviceDir) : []).filter((name) => /^[a-z][A-Za-z0-9]*Base\.ts$/.test(name) && !declaration.registrations.some((registration) => `${registration.name}Base.ts` === name));
    for (const name of strayBases) {
      errors.push(`${domainRel}/${SERVICE_DIR}/${name} の登録(${ENTITIES_DIR}/${name.slice(0, -"Base.ts".length)}/${ENTITY_DECLARATION_FILE})が無い(土台は登録ごと: 宣言を書くか、ファイルの名前を登録名に合わせる。形: src/domains/README.md)`);
    }
    for (const registration of declaration.registrations) {
      const entityPath = `${registration.dir}/${ENTITY_DECLARATION_FILE}`;
      const owner = nameOwners.get(registration.name);
      if (owner) {
        errors.push(`登録名 "${registration.name}" が重なる: ${owner} と ${entityPath}(登録表のキー = 登録名は全ドメインで一意。後から足した側の登録名を変える)`);
        continue;
      }
      nameOwners.set(registration.name, entityPath);
      const overrideRel = `${registration.dir}/${OVERRIDE_FILE}`;
      const overrideAbs = path.join(repoRoot, overrideRel);
      // 空(空白とコメントだけ)の上書きは不在と同じ(多段で下の Tier が親の上書きを空にしてよい、D34 K1)
      const hasOverride = view.exists(overrideAbs) && !isBlankSource(view.read(overrideAbs));
      const entity = registration.entity;
      if (!entity) continue; // 読めない entity.json は宣言の読み込みの部品の問題(pnpm check domain)
      if (!isRegisteredRegistration(registration)) {
        if (hasOverride) errors.push(`${overrideRel}: 登録が registered: false なので上書きする登録表の行が無い(上書きを消す)`);
        continue;
      }
      const service = serviceOfRegistration(registration.name, entity);
      const serviceBase = `${domainRel}/${SERVICE_DIR}/${service.file}`;
      if (!SERVICE_SOURCES(serviceBase).some((file) => view.exists(path.join(repoRoot, file)))) {
        errors.push(`${entityPath}: サービスのファイル ${serviceBase}.ts が無い(既定は ${SERVICE_DIR}/<登録名>Service.ts の <登録名>Service。違う時は entity.json の service に { file, export })`);
      }
      const { table, idColumn } = tableOfRegistration(registration.name, entity);
      for (const [label, value] of [["表", table], ["主キーの列", idColumn]]) {
        if (value !== null && (value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH || /[\s"'`]/.test(value))) {
          errors.push(`${entityPath}: ${label}の物理名 "${value}" が形でない(空でない・${MAX_IDENTIFIER_LENGTH} 文字以内・引用符と空白を含まない)`);
        }
      }
      const row = {
        key: registration.name,
        dir,
        isCore: dir.startsWith("core/"),
        entityPath,
        service,
        serviceImport: `@/domains/${dir}/${SERVICE_DIR}${service.file === "index" ? "" : `/${service.file}`}`,
        table,
        idColumn,
        access: accessOfDeclaration(entity),
        requires: Array.isArray(entity.requires) ? [...entity.requires] : [],
        overridePath: null,
        overrideImport: null,
      };
      if (hasOverride) {
        const { error } = readObjectKeys(view.read(overrideAbs), OVERRIDE_EXPORT);
        if (error) errors.push(`${overrideRel}: ${error}`);
        errors.push(...checkOverrideStaticImports(overrideRel, repoRoot, view, importMemo));
        // 宣言に無い鍵は pnpm check extensions(鍵の検査 overrideKeys.mjs)
        row.overridePath = overrideRel;
        row.overrideImport = `@/${overrideRel.slice("src/".length).replace(/\.ts$/, "")}`;
      }
      rows.push(row);
    }
  }
  // 1 テーブル 1 登録(D58: 表名 → 登録の逆引きが一意に決まるように)
  const tableOwners = new Map();
  for (const row of rows) {
    if (row.table === null) continue;
    const owner = tableOwners.get(row.table);
    if (owner) errors.push(`表 "${row.table}" が 2 つの登録にある: ${owner.entityPath} と ${row.entityPath}(1 つの表は 1 つの登録だけ)`);
    else tableOwners.set(row.table, row);
  }
  return { rows, errors };
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


/** 既存の serviceRegistry.ts の情報(無ければ null)。generated = 生成物の印がある(無い = 手書き) */
export function readExistingRegistry(repoRoot) {
  const file = path.join(repoRoot, REGISTRY_FILE);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const generated = text.split(/\r?\n/)[0].startsWith(GENERATED_PREFIX);
  const { keys, error } = readObjectKeys(text, "serviceRegistry");
  return { text, generated, keys: keys ?? [], error };
}
