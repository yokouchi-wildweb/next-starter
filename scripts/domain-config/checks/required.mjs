// 検査: 必須のキーと、決まった値の集合を持つキー（singular・plural・dbEngine・idType・useCreatedAt / useUpdatedAt・generateFiles）。
// どれも書き忘れると生成器が黙って別の既定（plural の推定・dbEngine ""・作成日時なし・何も生成しない）で進むので、生成前に止める。
// 規則の正: src/features/README.md「domain.json スキーマ定義」（🟢 = 必須）

import { GENERATE_CATEGORIES } from "../spec/categories.mjs";
import { DB_ENGINES, ID_TYPES } from "../spec/domainJson.mjs";

const isNonEmptyString = (value) => typeof value === "string" && value.length > 0;

/**
 * @param {object} config domain.json
 * @returns {string[]} 問題（空なら無し）
 */
export function requiredIssues(config) {
  const issues = [];
  if (!isNonEmptyString(config.singular)) issues.push("singular を書いてください");
  if (!isNonEmptyString(config.plural)) issues.push("plural を書いてください（テーブル名・ルートになります）");
  if (!DB_ENGINES.has(config.dbEngine)) issues.push(`dbEngine は ${[...DB_ENGINES].join(" / ")} のどちらかにしてください`);
  if (config.idType !== undefined && !ID_TYPES.has(config.idType)) {
    issues.push(`idType "${config.idType}" は使えません（${[...ID_TYPES].join(" / ")}）`);
  }
  for (const key of ["useCreatedAt", "useUpdatedAt"]) {
    if (typeof config[key] !== "boolean") issues.push(`${key} を true か false で書いてください（書かないと列が作られません）`);
  }
  const generateFiles = config.generateFiles;
  if (!generateFiles || typeof generateFiles !== "object" || Array.isArray(generateFiles)) {
    issues.push(`generateFiles を書いてください（${GENERATE_CATEGORIES.join(" / ")} を true / false で）`);
  } else {
    const missing = GENERATE_CATEGORIES.filter((key) => typeof generateFiles[key] !== "boolean");
    if (missing.length > 0) issues.push(`generateFiles の ${missing.join(" / ")} を true か false で書いてください`);
  }
  return issues;
}
