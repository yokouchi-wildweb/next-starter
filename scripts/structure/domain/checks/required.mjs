// 検査: 必須のキーと、決まった値の集合を持つキー（singular・plural・dbEngine・idType・useCreatedAt / useUpdatedAt・generate）。
// どれも書き忘れると生成器が黙って別の既定（plural の推定・dbEngine ""・作成日時なし）で進むので、生成前に止める。
// 区分ごとの generateFiles は廃止（generate の旗 1 つ）。残っていれば止める（読み替えると手で直したファイルを上書きしかねない）
// 規則の正: src/features/README.md「domain.json スキーマ定義」（🟢 = 必須）

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
  if (config.generate !== undefined && typeof config.generate !== "boolean") {
    issues.push(`generate は true か false で書いてください（省略 = true。今: ${JSON.stringify(config.generate)}）`);
  }
  if (config.generateFiles !== undefined) {
    issues.push(
      "generateFiles は廃止しました。消してください（全部 true だったなら消すだけ。手で直しているファイルがあるなら \"generate\": false = このドメインは生成しない）",
    );
  }
  return issues;
}
