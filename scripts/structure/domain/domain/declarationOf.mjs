// 生成器が宣言から取り出す物の決まり(純粋: ファイルを読まない。読むのは ./workspace.mjs)。
// - configOfDeclaration: ドメインの主の登録(登録名 = ドメイン名、表 1 つのドメイン)の entity.json
// - registrationConfigOf / generatedRegistrationsOf: 登録ごとの一式(D336)の config と、生成する登録の並び(主が先、あとはフォルダの順)
// - cacheDeclarationsOf: 共有の読みのキャッシュの宣言(登録ごとの entity.json の "cache"、fork の上書き entity.override.ts の cache、D353)

import ts from "typescript";

import { literalOf } from "../../../../src/lib/districtMap/index.mjs";
import { ENTITIES_DIR, ENTITY_DECLARATION_FILE, isGeneratedRegistration, primaryRegistrationOf } from "../../../../src/lib/domain/node.mjs";
import { ABOLISHED_CACHE_FILE } from "../spec/cache.mjs";

/** fork の上書きの置き場と export(登録のフォルダの隣、src/lib/domain/extensionPoints.ts の entities) */
const OVERRIDE_FILE = "entity.override.ts";
const OVERRIDE_EXPORT = "entityOverride";

/** 壊れた宣言(JSON として読めない・オブジェクトでない)は例外 */
function assertReadable(declaration) {
  const broken = declaration.problems.filter((problem) => problem.includes("JSON として読めない") || problem.includes("オブジェクトでない"));
  if (broken.length > 0) throw new Error(broken.join("\n"));
}

/**
 * ドメインの主の登録の entity.json の写し。主の登録が無ければ null。壊れた宣言 = 例外
 * @param {{ registrations: { name: string, entity: Record<string, unknown> | null }[], problems: string[] }} declaration readDomain の結果
 */
export function configOfDeclaration(declaration) {
  assertReadable(declaration);
  const registration = primaryRegistrationOf(declaration);
  return registration?.entity ? { ...registration.entity } : null;
}

/**
 * 名前の登録の entity.json の写し(登録ごとの一式の config)。無ければ null。壊れた宣言 = 例外
 * @param {{ registrations: { name: string, entity: Record<string, unknown> | null }[], problems: string[] }} declaration
 * @param {string} name 登録名
 */
export function registrationConfigOf(declaration, name) {
  assertReadable(declaration);
  const registration = declaration.registrations.find((candidate) => candidate.name === name);
  return registration?.entity ? { ...registration.entity } : null;
}

/**
 * 生成する登録の名前の並び(entity.json の generate が false でない物)。主の登録が先、あとはフォルダの順(ドメインに 1 つの物 = seed.ts などは先の登録が書く)
 * @param {{ name: string, registrations: { name: string, entity: Record<string, unknown> | null }[] }} declaration
 * @returns {string[]}
 */
export function generatedRegistrationsOf(declaration) {
  const primary = primaryRegistrationOf(declaration);
  const generated = declaration.registrations.filter(isGeneratedRegistration).map((registration) => registration.name);
  return primary && generated.includes(primary.name) ? [primary.name, ...generated.filter((name) => name !== primary.name)] : generated;
}

/**
 * fork の上書き entity.override.ts の cache(export const entityOverride = { cache: { … } } の字面、実行しない)
 * @param {string} text entity.override.ts の本文
 * @returns {{ cache: unknown, problem: string | null } | null} cache を書いていなければ null
 */
export function overrideCacheOf(text) {
  const source = ts.createSourceFile("entity.override.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== OVERRIDE_EXPORT || !declaration.initializer) continue;
      let node = declaration.initializer;
      while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
      if (!ts.isObjectLiteralExpression(node)) return null;
      const property = node.properties.find((p) => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === "cache");
      if (!property) return null;
      const read = literalOf(property.initializer);
      return read.problem !== undefined ? { cache: undefined, problem: `${OVERRIDE_EXPORT}.cache は字面で書いてください(${read.problem})` } : { cache: read.value, problem: null };
    }
  }
  return null;
}

/**
 * 1 ドメインの cache の宣言(D353): 読みの持ち主の宣言に置く = 登録ごとの entities/<登録名>/entity.json の "cache"(主でない登録も、
 * ドメインの既定を継がない)。fork の上書き entity.override.ts の cache はその登録の cache を丸ごと差し替える。cache.json は廃止(あれば止める)
 * @param {{ row: { name: string, dir: string }, declaration: object | null, hasCacheFile: boolean, readOverride: (registration: { dir: string }) => string | null }} input
 *   declaration = readDomain の結果(宣言の無いドメインは null)、readOverride = 登録の entity.override.ts の本文(無ければ null)
 * @returns {Array<{ row: object, registration: string | null, config: object | null, cache: object | null, source: string | null, problem: string | null }>}
 */
export function cacheDeclarationsOf({ row, declaration, hasCacheFile, readOverride = () => null }) {
  const found = [];
  const none = { row, registration: null, config: null, cache: null, source: null };
  if (hasCacheFile) found.push({ ...none, problem: `${row.dir}/${ABOLISHED_CACHE_FILE} は廃止(D353): 包む読みは登録の ${ENTITIES_DIR}/<登録名>/${ENTITY_DECLARATION_FILE} の "cache" に書き、${ABOLISHED_CACHE_FILE} を消す` });
  for (const registration of declaration?.registrations ?? []) {
    const config = registration.entity;
    if (!config) continue;
    const overrideText = readOverride(registration);
    const override = overrideText ? overrideCacheOf(overrideText) : null;
    const at = { ...none, registration: registration.name, config };
    if (override?.problem) {
      found.push({ ...at, problem: `${registration.dir}/${OVERRIDE_FILE}: ${override.problem}` });
      continue;
    }
    if (override) {
      found.push({ ...at, cache: override.cache, source: `${registration.dir}/${OVERRIDE_FILE}`, problem: null });
      continue;
    }
    if (config.cache === undefined) continue;
    found.push({ ...at, cache: config.cache, source: `${registration.dir}/${ENTITY_DECLARATION_FILE}`, problem: null });
  }
  return found;
}
