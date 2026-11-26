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

/**
 * 読み込んだモジュールの export の値。tsx が CJS として読んだ .ts(package.json に "type": "module" が無い)は名前の export が default の下に入ることがあるので、そこも見る
 * @param {Record<string, unknown>} moduleExports
 */
function exportedValues(moduleExports) {
  const fallback = moduleExports.default;
  return [...Object.values(moduleExports), ...(fallback && typeof fallback === "object" ? Object.values(fallback) : [])];
}

/** export の中から物理名 name の pgTable */
function tableIn(moduleExports, name) {
  return exportedValues(moduleExports).find((value) => is(value, PgTable) && getTableConfig(value).name === name) ?? null;
}

/**
 * @/… の import の道 → このリポジトリのファイル(tsconfig の paths と同じ: @/domains/<core のドメイン>/… は src/domains/core/ の下)。無ければ null
 * @param {string} repoRoot
 * @param {string} specifier
 * @param {string} [fromFile] 相対の道(./…)の起点のファイル(絶対)
 */
export function resolveRepoImport(repoRoot, specifier, fromFile) {
  let base;
  if (specifier.startsWith("@/domains/")) {
    const [name, ...rest] = specifier.slice("@/domains/".length).split("/");
    const coreDir = path.join(repoRoot, "src", "domains", "core", name);
    base = path.join(fs.existsSync(coreDir) ? coreDir : path.join(repoRoot, "src", "domains", name), ...rest);
  } else if (specifier.startsWith("@/")) base = path.join(repoRoot, "src", specifier.slice(2));
  else if (specifier.startsWith(".") && fromFile) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, path.join(base, "index.ts"), path.join(base, "index.mjs")];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

/** import の道をこのリポジトリの実物の file URL に直す(一時ファイルは OS の一時フォルダにあり、tsconfig の paths も node_modules も届かない) */
function resolveSpecifier(repoRoot, specifier) {
  if (specifier.startsWith("@/")) {
    const file = resolveRepoImport(repoRoot, specifier);
    if (!file) throw new Error(`宣言から組んだ表の import "${specifier}" のファイルが見つからない`);
    return pathToFileURL(file).href;
  }
  return import.meta.resolve(specifier);
}

let renderCount = 0;

/**
 * 宣言から生成器で組んだ出力: その登録の表と、同じ出力に出る全部の表(中間表を含む)
 * @param {string} repoRoot
 * @param {RegistrationToMatch} registration
 * @param {string} tempDir 一時ファイルの置き場(呼び手が消す)
 * @returns {Promise<{ table: PgTable, tables: PgTable[] }>}
 */
export async function renderExpected(repoRoot, registration, tempDir) {
  const workspace = createWorkspace(repoRoot);
  // hiddenColumns は表の事実でない(サービスの戻り値で null に置く TS のプロパティ名の一覧)。手で持つ登録はプロパティ名が宣言の項目名と違ってよいので、照らしの表には渡さない
  const { hiddenColumns: _hidden, ...config } = registration.config;
  const ctx = createDomainContext(workspace, registration.registration, { config });
  const text = renderDrizzleEntity(ctx, workspace).replace(/from "([^"]+)"/g, (_, specifier) => `from "${resolveSpecifier(repoRoot, specifier)}"`);
  // 1 回ごとに別の名前(import は同じ URL を読み直さない。同じ登録を組み直す起こす道具が続けて呼ぶ)
  const file = path.join(tempDir, `${registration.domain}.${registration.registration}.${++renderCount}.ts`);
  fs.writeFileSync(file, text);
  const moduleExports = await import(pathToFileURL(file).href);
  const table = tableIn(moduleExports, registration.table);
  if (!table) throw new Error(`${registration.dir}: 宣言から組んだ表に "${registration.table}" が無い`);
  return { table, tables: [...new Set(exportedValues(moduleExports).filter((value) => is(value, PgTable)))] };
}

/**
 * 宣言から生成器で組んだ表
 * @param {string} repoRoot
 * @param {RegistrationToMatch} registration
 * @param {string} tempDir
 */
export const expectedTable = async (repoRoot, registration, tempDir) => (await renderExpected(repoRoot, registration, tempDir)).table;

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
