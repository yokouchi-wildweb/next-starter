// 検査: 名前の形（singular・plural・項目名・リレーション先・従属の登録名は snake_case）。
// テーブル名・列名・フォルダ名・import のパスは全部この名前から組み立てるので、形が崩れた名前で生成を進めない。
// 全部止める（nameIssues）: 項目名・従属の登録名はそのまま列名・singular になる。singular・plural・リレーション先は
// 生成器が snake_case に直して読むが、決まりは snake_case（README「API」:90・:91・:168）なので書き方を 1 つにする
// 規則の正: src/domains/README.md「API」（singular / plural / Field の name / Relation の domain）

import { isSnakeCaseName } from "../spec/collectionField.mjs";

const snakeIssue = (where, value) => `${where} "${value}" は snake_case にしてください（例: sample_tag）`;

/**
 * @param {object} config 登録の entity.json
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
    const childDomain = field.collection?.registration;
    if (typeof childDomain === "string" && childDomain.length > 0 && !isSnakeCaseName(childDomain)) {
      issues.push(snakeIssue(`fields "${field.name}" の collection.registration`, childDomain));
    }
  });
  if (typeof config.singular === "string" && config.singular.length > 0 && !isSnakeCaseName(config.singular)) issues.push(snakeIssue("singular", config.singular));
  if (typeof config.plural === "string" && config.plural.length > 0 && !isSnakeCaseName(config.plural)) issues.push(snakeIssue("plural", config.plural));
  (config.relations ?? []).forEach((relation, index) => {
    if (typeof relation?.domain !== "string" || relation.domain.length === 0) {
      issues.push(`relations[${index}]: domain（リレーション先の singular）を書いてください`);
    } else if (!isSnakeCaseName(relation.domain)) {
      issues.push(snakeIssue(`relations[${index}] の domain`, relation.domain));
    }
  });
  return issues;
}
