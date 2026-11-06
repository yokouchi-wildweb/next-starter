// 検査: プロフィール設定（<id>.profile.json）の項目とタグ。
// 型と入力欄の組・選択肢・既定値はドメインの検査（scripts/structure/domain/checks/fields.mjs、表は src/lib/domain/fields/fieldFormInputs.mjs の Neon）を共用する。
// プロフィール固有: 項目は 1 つ以上、既定値のキーは defaultValue（default は止める）、型は表にあるものだけ、メディア型（mediaUploader / mediaCollection）は使えない（プロフィールのテーブルはファイル台帳に未対応）、
// tags のキーは PROFILE_FIELD_TAGS、値は項目名か belongsTo / belongsToMany の fieldName。
// 規則の正: src/features/core/userProfile/README.md（プロフィール設定）

import { PROFILE_FIELD_TAGS } from "../../../../src/features/core/userProfile/constants/fieldTags.mjs";
import { FIELD_TYPES, isCollectionFieldType, isMediaFieldType } from "../../../../src/lib/domain/fields/fieldTypes.mjs";
import { fieldsIssues, fieldsWarnings } from "../../domain/checks/fields.mjs";

/** プロフィールのテーブルは Neon（型と入力欄の組はドメインの Neon の表で照らす） */
const asDomainConfig = (profile) => ({ dbEngine: "Neon", fields: profile.fields ?? [] });

/**
 * @param {object} profile プロフィール設定
 * @returns {string[]} 問題（空なら無し）
 */
export function profileFieldIssues(profile) {
  const issues = [];
  const fields = profile.fields;
  if (!Array.isArray(fields) || fields.length === 0) {
    issues.push("fields に項目を 1 つ以上書いてください");
    return issues;
  }
  fields.forEach((field, index) => {
    if (typeof field?.name !== "string" || field.name.length === 0) issues.push(`fields[${index}]: name を書いてください`);
    else if (!Object.hasOwn(FIELD_TYPES, String(field.fieldType))) {
      // 表に無い型は text 列・z.any() で生成が通り、列の型が黙って変わる（ドメインは forge の後の検査で止まる）
      issues.push(`fields "${field.name}": fieldType ${JSON.stringify(field.fieldType)} は型の表にありません（綴りを直してください）`);
    }
    else if (isMediaFieldType(field.fieldType) || isCollectionFieldType(field.fieldType)) {
      issues.push(`fields "${field.name}": fieldType "${field.fieldType}" はプロフィールでは使えません（ファイル台帳に未対応。用途を登録した別ドメインの列に置く）`);
    }
    // 生成器が読むのは defaultValue だけ。default と書くと黙って無視され、既定値の無い列になる
    if (field && typeof field === "object" && Object.hasOwn(field, "default")) {
      issues.push(`fields "${field.name ?? index}": キー "default" は使えません（既定値は defaultValue に書いてください。default は生成器が読まず黙って無視されます）`);
    }
  });
  issues.push(...fieldsIssues(asDomainConfig(profile)));
  return issues;
}

/**
 * tags: キーは PROFILE_FIELD_TAGS、値は項目名かリレーションの fieldName
 * @returns {string[]} 問題（空なら無し）
 */
export function profileTagIssues(profile) {
  const tags = profile.tags;
  if (tags === undefined) return [];
  if (tags === null || typeof tags !== "object" || Array.isArray(tags)) return ["tags は { タグ名: [項目名, ...] } のオブジェクトで書いてください"];
  const known = new Set(PROFILE_FIELD_TAGS);
  const names = new Set([
    ...(profile.fields ?? []).map((field) => field?.name),
    ...(profile.relations ?? []).map((relation) => relation?.fieldName),
  ]);
  const issues = [];
  for (const [tag, members] of Object.entries(tags)) {
    if (!known.has(tag)) {
      issues.push(`tags "${tag}" は知らないタグです（${[...known].join(" / ")}。足すときは src/features/core/userProfile/constants/fieldTags.mjs）`);
      continue;
    }
    if (!Array.isArray(members)) {
      issues.push(`tags "${tag}" は項目名の配列で書いてください`);
      continue;
    }
    for (const member of members) {
      if (!names.has(member)) issues.push(`tags "${tag}" の ${JSON.stringify(member)} が fields の name にもリレーションの fieldName にもありません`);
    }
  }
  return issues;
}

/**
 * 止めない警告: 型と入力欄の組が表に無い、選択肢が要る入力欄に options が無い（ドメインと同じ）
 * @returns {string[]}
 */
export function profileWarnings(profile, registeredInputs = new Set()) {
  return fieldsWarnings(asDomainConfig(profile), registeredInputs);
}
