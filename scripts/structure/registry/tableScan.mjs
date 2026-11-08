// scripts/structure/registry/tableScan.mjs
// src/features の地区(ドメイン)の pgTable の表名 → 定義ファイルと、機能のフォルダ → 表名の対応を返す。
// 走査と字面の読み方は地区の地図の読み手 src/lib/districtMap(地区の発見と readTableNames)が持ち、ここはその利用者(目録 D1・D13)。
// 表の定義ファイルは import しない(drizzle・DB の依存を読み込まない)。
//
// 使い手: scripts/structure/extensions/derive/featureTables.mjs(機能を閉じる規則の features → tables の導出、D16・D20 K1)、
//         scripts/structure/registry/tableScan.test.mjs(走査の集合 = schemaRegistry の全表、pnpm test scripts/structure/registry)。
//         ./alpha/index.mjs(pnpm generate registry の schemaRegistry、親 D67)・scripts/structure/forge/tables.mjs・proxyFrame.test.mjs。
//
// 走査の範囲: features の地区(src/features と src/features/core の直下の _ で始まらないフォルダ)の下の .ts / .tsx(*.test.* を除く)。
// entities/drizzle.ts の外(entities/notificationRead.ts、userProfile/entities/profiles/<role>/drizzle.ts などの生成物)も拾う。
// 地区の外(_ で始まる雛形・src/features 直下のファイル)の pgTable は数えない。
// 字面で読めない pgTable(名前を変数・定数で渡す)は problems に場所を出す(走査の漏れを黙って通さない)。
// コメントの中(JSDoc の使用例など)は見ない。

import { readDistrictMapAt } from "../../../src/lib/districtMap/node.mjs";

export const FEATURES_DIR = "src/features";

/**
 * features の地区の pgTable を集める
 * @param {string} repoRoot
 * @returns {{ tables: { name: string, file: string }[], problems: string[] }} file はリポジトリ相対(/ 区切り)、並びはパス順 → 出現順
 */
export function scanFeatureTables(repoRoot) {
  const { tableFiles, tableProblems } = readDistrictMapAt(repoRoot);
  return { tables: tableFiles.map(({ name, file }) => ({ name, file })), problems: tableProblems };
}

/**
 * 機能のフォルダ(src/features からの相対、例 "core/wallet"・"sample")の表名を返す。フォルダの下の全ファイルが対象
 * @param {{ name: string, file: string }[]} tables scanFeatureTables の結果
 * @param {string} folder
 * @returns {string[]} 表名(定義ファイル → 出現順)
 */
export function tablesOfFolder(tables, folder) {
  const prefix = `${FEATURES_DIR}/${folder.replace(/\/+$/, "")}/`;
  return tables.filter((table) => table.file.startsWith(prefix)).map((table) => table.name);
}
