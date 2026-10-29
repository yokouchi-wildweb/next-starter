// 検査: 名前の形（singular・plural・項目名・リレーション先・従属ドメイン名は snake_case）。
// テーブル名・列名・フォルダ名・import のパスは全部この名前から組み立てるので、形が崩れた名前で生成を進めない。
// singular・plural・リレーション先は生成器が snake_case に直して扱う（camelCase でも動く）ので警告だけ（nameWarnings）。
// 項目名・従属ドメイン名はそのまま列名・singular になるので止める（nameIssues）
// 規則の正: src/features/README.md「domain.json スキーマ定義」（singular / plural / Field の name / Relation の domain）

import { isSnakeCaseName } from "../spec/collectionField.mjs";

const snakeIssue = (where, value) => `${where} "${value}" は snake_case にしてください（例: sample_tag）`;

/**
 * @param {object} config domain.json
 * @returns {string[]} 問題（空なら無し）
 */
export function nameIssues(config) {
  const issues = [];
  (config.fields ?? []).forEach((field, index) => {
    if (typeof field?.name !== "string" || field.name.length === 0) {
      issues.push(`fields[${index}]: name を書いてください`);
      return;
    }
    if (!isSnakeCaseName(field.name)) issues.push(snakeIssue(`fields[${index}] の name`, field.name));
    const childDomain = field.collection?.domain;
    if (typeof childDomain === "string" && childDomain.length > 0 && !isSnakeCaseName(childDomain)) {
      issues.push(snakeIssue(`fields "${field.name}" の collection.domain`, childDomain));
    }
  });
  (config.relations ?? []).forEach((relation, index) => {
    if (typeof relation?.domain !== "string" || relation.domain.length === 0) {
      issues.push(`relations[${index}]: domain（リレーション先の singular）を書いてください`);
    }
  });
  return issues;
}

/**
 * 止めない警告: singular・plural・リレーション先の名前が snake_case でない
 * @param {object} config domain.json
 * @returns {string[]}
 */
export function nameWarnings(config) {
  const warnings = [];
  if (config.singular !== undefined && !isSnakeCaseName(config.singular)) warnings.push(snakeIssue("singular", config.singular));
  if (config.plural !== undefined && !isSnakeCaseName(config.plural)) warnings.push(snakeIssue("plural", config.plural));
  (config.relations ?? []).forEach((relation, index) => {
    if (typeof relation?.domain === "string" && relation.domain.length > 0 && !isSnakeCaseName(relation.domain)) {
      warnings.push(snakeIssue(`relations[${index}] の domain`, relation.domain));
    }
  });
  return warnings;
}
