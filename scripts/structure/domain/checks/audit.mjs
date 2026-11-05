// 検査: audit の形（domain.json と profile.json・profile override で共用）。
// 書き間違いは監査ログが黙って残らない・実行時に落ちる形で出るので、生成の前に止める。
// 規則の正: src/features/core/auditLog/README.md

import { toCamelCase } from "../../../../src/utils/stringCase.mjs";
import { AUDIT_BULK_MODES, AUDIT_KEYS } from "../spec/audit.mjs";

/** trackedFields に書ける列（TS の列名 = camelCase）: 項目と belongsTo の FK */
function columnNames(config) {
  return new Set([
    ...(config.fields ?? []).map((field) => toCamelCase(field?.name ?? "")),
    ...(config.relations ?? []).filter((relation) => relation?.relationType === "belongsTo").map((relation) => toCamelCase(relation?.fieldName ?? "")),
  ]);
}

/**
 * @param {object} config domain.json かプロフィール設定（fields・relations・audit を見る）
 * @param {string} [dbEngine] 既定は config.dbEngine
 * @returns {string[]} 問題（空なら無し）
 */
export function auditIssues(config, dbEngine = config.dbEngine) {
  const { audit } = config;
  if (audit === undefined) return [];
  if (audit === null || typeof audit !== "object" || Array.isArray(audit)) return ["audit は { targetType, actionPrefix, ... } のオブジェクトで書いてください"];
  const issues = Object.keys(audit)
    .filter((key) => !AUDIT_KEYS.has(key))
    .map((key) => `audit: 知らないキー ${key}（書けるのは ${[...AUDIT_KEYS].join(" / ")}。recorder は生成器が渡す）`);
  if (audit.enabled !== undefined && typeof audit.enabled !== "boolean") issues.push("audit.enabled は true か false にしてください");
  if (audit.enabled === false) return issues;
  if (dbEngine !== "Neon") issues.push(`audit は Neon のドメインだけで使えます（今: ${JSON.stringify(dbEngine)}）`);
  for (const key of ["targetType", "actionPrefix"]) {
    if (typeof audit[key] !== "string" || audit[key].length === 0) issues.push(`audit.${key} を文字列で書いてください（enabled: false 以外は必須）`);
  }
  if (audit.bulkMode !== undefined && !AUDIT_BULK_MODES.has(audit.bulkMode)) issues.push(`audit.bulkMode は ${[...AUDIT_BULK_MODES].join(" / ")} にしてください（今: ${JSON.stringify(audit.bulkMode)}）`);
  if (audit.retentionDays !== undefined && !(Number.isInteger(audit.retentionDays) && audit.retentionDays > 0)) issues.push(`audit.retentionDays は正の整数にしてください（今: ${JSON.stringify(audit.retentionDays)}）`);
  if (audit.strict !== undefined && typeof audit.strict !== "boolean") issues.push("audit.strict は true か false にしてください");
  if (audit.trackedFields !== undefined) {
    if (!Array.isArray(audit.trackedFields)) {
      issues.push("audit.trackedFields は列名の配列で書いてください");
    } else {
      const columns = columnNames(config);
      for (const name of audit.trackedFields) {
        if (!columns.has(name)) issues.push(`audit.trackedFields の ${JSON.stringify(name)} が列にありません（camelCase の列名で書く: ${[...columns].join(" / ")}）`);
      }
    }
  }
  return issues;
}
