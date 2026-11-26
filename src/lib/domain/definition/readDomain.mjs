// src/lib/domain/definition/readDomain.mjs
// ドメインと登録をまとめて返す読み込みの部品(D335。読み手は全員これだけを通す)。宣言の形は ./declaration.mjs。
// 読むのは domain.json と entities/<登録名>/entity.json だけで、無い・壊れた・知らない鍵は problems に入れる(推測で埋めない、
// 無い側の別の読み方を持たない)。木は source(地区の地図と同じ { listDir, readText })で渡す = 今の木も git の木も同じに読む

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { DOMAIN_DECLARATION_FILE, DOMAIN_KEYS, ENTITIES_DIR, ENTITY_DECLARATION_FILE, ENTITY_KEYS, ENTITY_NESTED_KEYS } from "./declaration.mjs";

/** ドメインのフォルダの根(リポジトリ直下からの相対) */
const DOMAINS_ROOT = "src/domains";
/** core のドメインを並べるフォルダ(src/domains の直下) */
const CORE_DIR = "core";

/**
 * @typedef {{ listDir: (rel: string) => { name: string, isDir: boolean }[], readText: (rel: string) => string | null }} DomainSource
 *   listDir = フォルダの直下(無ければ [])、readText = ファイルの本文(無ければ null)。パスはリポジトリ直下からの相対(/ 区切り)
 * @typedef {{ name: string, dir: string, entity: Record<string, unknown> | null }} DomainRegistration
 *   name = 登録名(フォルダ名)、dir = entities/<登録名> の相対、entity = entity.json の中身(読めなければ null)
 * @typedef {{
 *   name: string, core: boolean, dir: string, domain: Record<string, unknown> | null,
 *   registrations: DomainRegistration[], problems: string[],
 * }} DomainDeclaration
 */

/** @param {string} a @param {string} b */
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * リポジトリの木を読む source
 * @param {string} repoRoot
 * @returns {DomainSource}
 */
export function nodeDomainSource(repoRoot) {
  return {
    listDir(rel) {
      const abs = join(repoRoot, rel);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) return [];
      return readdirSync(abs, { withFileTypes: true })
        .map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }))
        .sort((a, b) => byName(a.name, b.name));
    },
    readText(rel) {
      const abs = join(repoRoot, rel);
      return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, "utf8") : null;
    },
  };
}

/** @param {DomainSource} source @param {string} rel */
const dirsOf = (source, rel) =>
  source
    .listDir(rel)
    .filter((entry) => entry.isDir && !entry.name.startsWith(".") && !entry.name.startsWith("_"))
    .map((entry) => entry.name);

/**
 * ドメインの一覧: src/domains の直下(業務)と src/domains/core の直下(core)のフォルダ。`_` で始まる物(_template)は除く。
 * domain.json の有無で選ばない(無いドメインは readDomain の problems になる)
 * @param {DomainSource} source
 * @returns {{ domains: { name: string, core: boolean, dir: string }[], problems: string[] }} domains は名前順
 */
export function listDomains(source) {
  const business = dirsOf(source, DOMAINS_ROOT).filter((name) => name !== CORE_DIR);
  const core = dirsOf(source, `${DOMAINS_ROOT}/${CORE_DIR}`);
  /** @type {string[]} */
  const problems = [];
  for (const name of business.filter((name) => core.includes(name))) {
    problems.push(`ドメイン "${name}" が ${DOMAINS_ROOT}/${name}/ と ${DOMAINS_ROOT}/${CORE_DIR}/${name}/ の両方にある(1 つにする)`);
  }
  const domains = [
    ...business.map((name) => ({ name, core: false, dir: `${DOMAINS_ROOT}/${name}` })),
    ...core.map((name) => ({ name, core: true, dir: `${DOMAINS_ROOT}/${CORE_DIR}/${name}` })),
  ].sort((a, b) => byName(a.name, b.name) || Number(a.core) - Number(b.core));
  return { domains, problems };
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * 入れ子の鍵を歩く: 表(ENTITY_NESTED_KEYS)にある鍵の中身の知らない鍵を problems へ(値の型の検査はしない)
 * @param {Record<string, unknown>} object
 * @param {Record<string, import("./declaration.mjs").NestedKeys>} nested
 * @param {string} rel
 * @param {string} path 今の道(例: fields[2].column)
 * @param {string[]} problems
 */
function checkNestedKeys(object, nested, rel, path, problems) {
  for (const [key, spec] of Object.entries(nested)) {
    if (!(key in object)) continue;
    const value = object[key];
    const keyPath = path ? `${path}.${key}` : key;
    const items = spec.list ? (Array.isArray(value) ? value.map((item, index) => [`${keyPath}[${index}]`, item]) : null) : [[keyPath, value]];
    if (items === null) {
      problems.push(`${rel}: ${keyPath} が配列でない`);
      continue;
    }
    for (const [itemPath, item] of items) {
      if (!isObject(item)) {
        // 鍵の検査だけ: オブジェクトでない項目(値の形の誤り)は値の検査(生成器・照らし)に任せる
        continue;
      }
      for (const itemKey of Object.keys(item)) {
        if (!spec.keys.has(itemKey)) problems.push(`${rel}: ${itemPath} の知らない鍵 "${itemKey}"`);
      }
      if (spec.nested) checkNestedKeys(item, spec.nested, rel, itemPath, problems);
    }
  }
}

/**
 * JSON の宣言を読む: 無い・壊れた・オブジェクトでない・知らない鍵(nested があれば入れ子の中も)は problems へ
 * @param {DomainSource} source
 * @param {string} rel
 * @param {Set<string>} keys
 * @param {string[]} problems
 * @param {Record<string, import("./declaration.mjs").NestedKeys>} [nested]
 * @returns {Record<string, unknown> | null}
 */
function readDeclaration(source, rel, keys, problems, nested) {
  const text = source.readText(rel);
  if (text === null) {
    problems.push(`${rel} が無い`);
    return null;
  }
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    problems.push(`${rel}: JSON として読めない(${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
  if (!isObject(parsed)) {
    problems.push(`${rel}: 中身がオブジェクトでない`);
    return null;
  }
  for (const key of Object.keys(parsed)) {
    if (!keys.has(key)) problems.push(`${rel}: 知らない鍵 "${key}"`);
  }
  if (nested) checkNestedKeys(parsed, nested, rel, "", problems);
  return parsed;
}

/**
 * 1 つのドメインの宣言(ドメインと登録)。name はフォルダ名(業務か core かは木から決める)
 * @param {DomainSource} source
 * @param {string} name
 * @returns {DomainDeclaration}
 */
export function readDomain(source, name) {
  const listed = listDomains(source);
  const found = listed.domains.filter((domain) => domain.name === name);
  /** @type {string[]} */
  const problems = listed.problems.filter((problem) => problem.startsWith(`ドメイン "${name}" `));
  if (found.length === 0) {
    problems.push(`ドメイン "${name}" のフォルダが ${DOMAINS_ROOT}/ にも ${DOMAINS_ROOT}/${CORE_DIR}/ にも無い`);
    return { name, core: false, dir: `${DOMAINS_ROOT}/${name}`, domain: null, registrations: [], problems };
  }
  const { core, dir } = found[0];
  const domain = readDeclaration(source, `${dir}/${DOMAIN_DECLARATION_FILE}`, DOMAIN_KEYS, problems);
  const registrations = dirsOf(source, `${dir}/${ENTITIES_DIR}`).map((registrationName) => {
    const registrationDir = `${dir}/${ENTITIES_DIR}/${registrationName}`;
    const entity = readDeclaration(source, `${registrationDir}/${ENTITY_DECLARATION_FILE}`, ENTITY_KEYS, problems, ENTITY_NESTED_KEYS);
    return { name: registrationName, dir: registrationDir, entity };
  });
  return { name, core, dir, domain, registrations, problems };
}

/**
 * 全部のドメインの宣言(listDomains の順)。一覧の問題(業務と core の重なり)は重なったドメインの problems に入る
 * @param {DomainSource} source
 * @returns {DomainDeclaration[]}
 */
export function readDomains(source) {
  const names = [...new Set(listDomains(source).domains.map((domain) => domain.name))];
  return names.map((name) => readDomain(source, name));
}
