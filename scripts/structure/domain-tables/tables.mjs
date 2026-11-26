// scripts/structure/domain-tables/tables.mjs
// 照らしの検査の段取り: entity.json を持つ Neon の登録ごとに、宣言から生成器で組んだ表(renderDrizzleEntity の出力を一時ファイルに
// 書いて import)と、今の表(物理名で地区の地図の tableFiles から引いて import)を返す。.ts を読むので tsx の上で走らせる
// (段の検査・pnpm test)。一時ファイルは OS の一時フォルダに置き、import の道(@/…・drizzle-orm)をこのリポジトリの実物の道に直す

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";

import { nodeDomainSource, readDomains } from "../../../src/lib/domain/node.mjs";
import { readDistrictMapAt } from "../../../src/lib/districtMap/node.mjs";
import { toSnakeCase } from "../../../src/lib/stringCase/index.mjs";
import { createDomainContext } from "../domain/domain/context.mjs";
import { createWorkspace } from "../domain/domain/workspace.mjs";
import { renderDrizzleEntity } from "../domain/render/entities/drizzle/index.mjs";

/**
 * @typedef {{ domain: string, registration: string, dir: string, domainDir: string, config: Record<string, unknown>, table: string, problems: string[] }} RegistrationToMatch
 */

/**
 * 照らす登録: entity.json の読めた Neon の登録(Firestore は表が無い)。登録の宣言の問題(知らない鍵など)は problems に持つ
 * @param {string} repoRoot
 * @returns {RegistrationToMatch[]}
 */
export function registrationsToMatch(repoRoot) {
  /** @type {RegistrationToMatch[]} */
  const found = [];
  for (const domain of readDomains(nodeDomainSource(repoRoot))) {
    for (const registration of domain.registrations) {
      const entity = registration.entity;
      if (entity === null || (entity.dbEngine ?? "Neon") !== "Neon") continue;
      const config = { ...entity, label: entity.label ?? domain.domain?.label };
      const plural = typeof entity.plural === "string" ? entity.plural : registration.name;
      const table = typeof entity.table === "string" ? entity.table : toSnakeCase(plural);
      const problems = domain.problems.filter((problem) => problem.startsWith(`${registration.dir}/`));
      found.push({ domain: domain.name, registration: registration.name, dir: registration.dir, domainDir: domain.dir, config, table, problems });
    }
  }
  return found;
}

/** export の中から物理名 name の pgTable */
function tableIn(moduleExports, name) {
  return Object.values(moduleExports).find((value) => is(value, PgTable) && getTableConfig(value).name === name) ?? null;
}

/**
 * import の道をこのリポジトリの実物の file URL に直す(一時ファイルは OS の一時フォルダにあり、tsconfig の paths も node_modules も届かない)
 * @param {string} repoRoot
 * @param {string} specifier
 */
function resolveSpecifier(repoRoot, specifier) {
  if (specifier.startsWith("@/")) {
    const base = path.join(repoRoot, "src", specifier.slice(2));
    const candidates = [`${base}.ts`, `${base}.tsx`, `${base}.mjs`, path.join(base, "index.ts"), path.join(base, "index.mjs")];
    const file = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!file) throw new Error(`宣言から組んだ表の import "${specifier}" のファイルが見つからない`);
    return pathToFileURL(file).href;
  }
  return import.meta.resolve(specifier);
}

/**
 * 宣言から生成器で組んだ表
 * @param {string} repoRoot
 * @param {RegistrationToMatch} registration
 * @param {string} tempDir 一時ファイルの置き場(呼び手が消す)
 */
export async function expectedTable(repoRoot, registration, tempDir) {
  const workspace = createWorkspace(repoRoot);
  const ctx = createDomainContext(workspace, registration.registration, { config: registration.config });
  const text = renderDrizzleEntity(ctx, workspace).replace(/from "([^"]+)"/g, (_, specifier) => `from "${resolveSpecifier(repoRoot, specifier)}"`);
  const file = path.join(tempDir, `${registration.domain}.${registration.registration}.ts`);
  fs.writeFileSync(file, text);
  const table = tableIn(await import(pathToFileURL(file).href), registration.table);
  if (!table) throw new Error(`${registration.dir}: 宣言から組んだ表に "${registration.table}" が無い`);
  return table;
}

/**
 * 今の表(物理名で引く)。無ければ null
 * @param {string} repoRoot
 * @param {string} name
 */
export async function actualTable(repoRoot, name) {
  const found = readDistrictMapAt(repoRoot).tableFiles.find((table) => table.name === name);
  if (!found) return null;
  return tableIn(await import(pathToFileURL(path.join(repoRoot, found.file)).href), name);
}

/**
 * dbObjects の名指したファイルの無い物(道はドメインのフォルダからの相対)
 * @param {string} repoRoot
 * @param {RegistrationToMatch} registration
 * @returns {string[]}
 */
export function missingDbObjects(repoRoot, registration) {
  const objects = Array.isArray(registration.config.dbObjects) ? registration.config.dbObjects : [];
  return objects
    .map((object) => `${registration.domainDir}/${object.file}`)
    .filter((file) => !fs.existsSync(path.join(repoRoot, file)))
    .map((file) => `${registration.dir}: dbObjects のファイル ${file} が無い`);
}

/** 一時ファイルの置き場を作る */
export const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "domain-tables-"));
