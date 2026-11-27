// 生成器が宣言から取り出す物の決まり(純粋: ファイルを読まない。読むのは ./workspace.mjs)。
// - configOfDeclaration: ドメインの主の登録(登録名 = ドメイン名、表 1 つのドメイン)の entity.json
// - registrationConfigOf / generatedRegistrationsOf: 登録ごとの一式(D336)の config と、生成する登録の並び(主が先、あとはフォルダの順)
// - cacheDeclarationOf: 共有の読みのキャッシュの宣言(主の登録の entity.json の "cache" か <domain>/cache.json のどちらか 1 つ)

import { DOMAIN_DECLARATION_FILE, ENTITY_DECLARATION_FILE, isGeneratedRegistration, primaryRegistrationOf } from "../../../../src/lib/domain/node.mjs";
import { CACHE_FILE } from "../spec/cache.mjs";

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
 * 1 ドメインの cache の宣言(両方・置き場の誤り・読めない JSON は problem)
 * @param {{ row: { dir: string }, declaration: object | null, hasCacheFile: boolean, readCacheFile: () => unknown }} input
 *   declaration = readDomain の結果(宣言の無いドメインは null)、readCacheFile = <domain>/cache.json を読む(workspace)
 * @returns {{ row: object, config: object | null, cache: object | null, source: string | null, problem: string | null }}
 */
export function cacheDeclarationOf({ row, declaration, hasCacheFile, readCacheFile }) {
  const registration = declaration ? primaryRegistrationOf(declaration) : null;
  const config = registration?.entity ?? null;
  const hasRegistrations = (declaration?.registrations ?? []).length > 0;
  // 置き場(core/domain-definition.md cache_declaration): 主の登録の entity.json の "cache" / 主の登録の無い(登録はある)ドメインは domain.json の "cache" /
  // 登録の無いドメインは cache.json。1 ドメイン 1 か所
  const domainJson = `${row.dir}/${DOMAIN_DECLARATION_FILE}`;
  const inDomainJson = declaration?.domain?.cache !== undefined;
  const at = registration ? `${registration.dir}/${ENTITY_DECLARATION_FILE}` : hasRegistrations ? domainJson : null;
  const inJson = Boolean(config) && config.cache !== undefined;
  const none = { row, config, cache: null, source: null };
  if (!hasRegistrations && inDomainJson) return { ...none, problem: `登録の無いドメインの cache は ${domainJson} でなく ${CACHE_FILE} に書いてください` };
  if (registration && inDomainJson) return { ...none, problem: `主の登録のあるドメインの cache は ${domainJson} でなく ${at} の "cache" に書いてください` };
  if ((inJson || inDomainJson) && hasCacheFile) return { ...none, problem: `cache は ${at} の "cache" か ${CACHE_FILE} のどちらか 1 つに書いてください(両方ある)` };
  if (hasRegistrations && hasCacheFile) return { ...none, problem: `登録のあるドメインは ${CACHE_FILE} でなく ${at} の "cache" に書いてください` };
  if (inDomainJson) return { row, config, cache: declaration.domain.cache, source: domainJson, problem: null };
  if (!inJson && !hasCacheFile) return { ...none, problem: null };
  if (inJson) return { row, config, cache: config.cache, source: at, problem: null };
  try {
    return { row, config, cache: readCacheFile(), source: `${row.dir}/${CACHE_FILE}`, problem: null };
  } catch (error) {
    return { ...none, problem: `${CACHE_FILE} が JSON として読めません: ${error.message}` };
  }
}
