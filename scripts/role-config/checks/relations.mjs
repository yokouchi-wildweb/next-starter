// 検査: プロフィールのリレーション（種類・外部キーの名前と型・削除時の挙動・入力欄）。
// プロフィールの生成器は belongsTo / belongsToMany しか読まず（ほかは黙って無視）、外部キーの列は uuid 以外だと text になるのに
// Zod は uuid 固定でずれる。SET_NULL × required はドメインの生成器は止めるがプロフィールの生成器は止めない。どれも生成前に止める。
// 規則の正: src/features/core/userProfile/README.md「リレーション設定」

import { RELATION_FORM_INPUTS } from "../../domain-config/spec/domainJson.mjs";

const RELATION_TYPES = new Set(["belongsTo", "belongsToMany"]);
const ON_DELETE = new Set(["CASCADE", "RESTRICT", "SET_NULL"]);

/**
 * @param {object} profile プロフィール設定
 * @returns {string[]} 問題（空なら無し）
 */
export function profileRelationIssues(profile) {
  const issues = [];
  (profile.relations ?? []).forEach((relation, index) => {
    const where = `relations[${index}] "${relation?.domain ?? "?"}"`;
    if (typeof relation?.domain !== "string" || relation.domain.length === 0) issues.push(`relations[${index}]: domain（リレーション先の singular）を書いてください`);
    const type = relation?.relationType;
    if (!RELATION_TYPES.has(type)) {
      issues.push(`${where}: relationType ${JSON.stringify(type)} はプロフィールでは使えません（belongsTo / belongsToMany。ほかは生成器が何も出しません）`);
      return;
    }
    if (typeof relation.fieldName !== "string" || relation.fieldName.length === 0) {
      issues.push(`${where}: fieldName（外部キーの名前。例: ${relation.domain ?? "x"}_id）を書いてください`);
    }
    if (relation.fieldType !== undefined && relation.fieldType !== "uuid") {
      issues.push(`${where}: fieldType ${JSON.stringify(relation.fieldType)} は使えません（省略か "uuid"。プロフィールの外部キーの検証は uuid 固定です）`);
    }
    if (relation.onDelete !== undefined && !ON_DELETE.has(relation.onDelete)) {
      issues.push(`${where}: onDelete ${JSON.stringify(relation.onDelete)} は ${[...ON_DELETE].join(" / ")} のどれかにしてください`);
    }
    if (type === "belongsTo" && relation.onDelete === "SET_NULL" && relation.required === true) {
      issues.push(`${where}: onDelete "SET_NULL" は required: true と両立しません（NOT NULL の列は null にできない。RESTRICT か CASCADE に）`);
    }
    const inputs = RELATION_FORM_INPUTS[type];
    if (relation.formInput !== undefined && !inputs.has(relation.formInput) && relation.formInput !== "hidden") {
      issues.push(`${where}: formInput ${JSON.stringify(relation.formInput)} は ${[...inputs, "hidden"].join(" / ")} のどれかにしてください`);
    }
  });
  return issues;
}
