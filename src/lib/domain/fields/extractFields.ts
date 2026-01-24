// src/lib/domain/fields/extractFields.ts
// ドメイン設定からフィールド情報を抽出するユーティリティ

import type { DomainConfig } from "../config";
import type { DomainFieldInfo } from "../types";

export type { DomainFieldInfo };

/** フィールドオプションの型 */
export type FieldOption = {
  value: string | number | boolean;
  label: string;
};

/**
 * ドメイン設定から指定フィールドを取得
 *
 * @example
 * const config = getDomainConfig("sample");
 * const field = getField(config, "select");
 * // { name: "select", label: "セレクトボックス", fieldType: "enum", options: [...] }
 */
export function getField(config: DomainConfig, fieldName: string) {
  return config.fields.find((f) => f.name === fieldName);
}

/**
 * ドメイン設定から指定フィールドのオプションを取得
 * enumやselect/multiSelectフィールドの選択肢を取得する
 *
 * @example
 * const config = getDomainConfig("sample");
 * const options = getFieldOptions(config, "select");
 * // [{ value: "apple", label: "りんご" }, ...]
 */
export function getFieldOptions(
  config: DomainConfig,
  fieldName: string
): FieldOption[] {
  const field = getField(config, fieldName);
  if (!field) return [];

  // optionsプロパティがある場合はそれを返す
  if ("options" in field && Array.isArray(field.options)) {
    return field.options as FieldOption[];
  }

  return [];
}

/**
 * ドメイン設定から指定フィールドのラベルを取得
 */
export function getFieldLabel(config: DomainConfig, fieldName: string): string {
  const field = getField(config, fieldName);
  return field?.label ?? fieldName;
}

/**
 * ドメイン設定からフィールド情報を抽出
 * システムフィールド（id, createdAt, updatedAt, deletedAt）も含む
 *
 * @example
 * const config = getDomainConfig("sample");
 * const fields = extractFields(config);
 * // [{ name: "id", label: "ID", fieldType: "uuid" }, ...]
 */
export function extractFields(config: DomainConfig): DomainFieldInfo[] {
  const fields: DomainFieldInfo[] = [];

  // システムフィールド: id
  fields.push({ name: "id", label: "ID", fieldType: "uuid" });

  // ドメインフィールド
  for (const field of config.fields) {
    fields.push({
      name: field.name,
      label: field.label,
      fieldType: field.fieldType,
      formInput: field.formInput,
    });
  }

  // リレーションフィールド（belongsTo の外部キー）
  for (const relation of config.relations || []) {
    if (relation.relationType === "belongsTo" && "fieldType" in relation) {
      fields.push({
        name: relation.fieldName,
        label: relation.label,
        fieldType: relation.fieldType,
      });
    }
  }

  // システムフィールド: createdAt, updatedAt, deletedAt
  if (config.useCreatedAt) {
    fields.push({ name: "createdAt", label: "作成日時", fieldType: "timestamp" });
  }
  if (config.useUpdatedAt) {
    fields.push({ name: "updatedAt", label: "更新日時", fieldType: "timestamp" });
  }
  // useSoftDelete はオプショナルなので in 演算子でチェック
  if ("useSoftDelete" in config && config.useSoftDelete) {
    fields.push({ name: "deletedAt", label: "削除日時", fieldType: "timestamp" });
  }

  return fields;
}
