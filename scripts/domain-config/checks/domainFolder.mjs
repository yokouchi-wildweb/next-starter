// 検査: ドメインフォルダ名 = camelCase(singular)。
//
// 生成器は全体で「フォルダ名 = camel(singular)」を前提にパス（生成先・import・レジストリ登録・他ドメインからの
// リレーション import）を組み立てる。フォルダ名を手で変えたドメインを生成すると、存在しない
// `@/features/<camel(singular)>/...` への参照や別フォルダへの生成物が黙って書き出されるため、生成前に止める。

import { toCamelCase } from "../../../src/utils/stringCase.mjs";

/**
 * @param {string} folder src/features/ 直下のフォルダ名
 * @param {{ singular?: string }} config domain.json の内容
 * @returns {string | null} 不一致ならエラーメッセージ、一致（または singular 未宣言）なら null
 */
export function checkDomainFolderName(folder, config) {
  const singular = config?.singular;
  if (!singular) return null;
  const expected = toCamelCase(singular) || singular;
  if (folder === expected) return null;
  return (
    `ドメインフォルダ "${folder}" が domain.json の singular "${singular}" と一致しません` +
    `（期待するフォルダ名: "${expected}"）。` +
    `フォルダ名を "${expected}" に改名してください（singular を変えるとテーブル名・FK 名が変わります）。`
  );
}

/**
 * 複数ドメインのフォルダ名をまとめて検査し、不一致があれば全件を並べて例外を投げる。
 * 一括生成で途中まで書き出して止まらないよう、生成ループの前に呼ぶ。
 * @param {import("../domain/workspace.mjs").Workspace} workspace
 * @param {string[]} folders 検査するフォルダ名
 */
export function assertDomainFolderNames(workspace, folders) {
  const errors = [];
  for (const folder of folders) {
    const config = workspace.readConfig(folder);
    if (!config) continue;
    const error = checkDomainFolderName(folder, config);
    if (error) errors.push(`  - ${error}`);
  }
  if (errors.length > 0) {
    throw new Error(`フォルダ名と singular が一致しないドメインがあるため、何も生成せずに終了します:\n${errors.join("\n")}`);
  }
}
