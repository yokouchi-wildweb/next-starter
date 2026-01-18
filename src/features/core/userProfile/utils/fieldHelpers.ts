// src/features/core/userProfile/utils/fieldHelpers.ts
// プロフィールフィールド配列の操作ヘルパー

import type { FieldConfig } from "@/components/Form/Field";
import type { ProfileFieldConfig } from "../types";
import type { ProfileConfig } from "../profiles";

/**
 * snake_case を camelCase に変換
 */
const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/**
 * フィールド配列から指定タグに属するフィールドのみを抽出
 * @param fields - 全フィールド配列（profile.json の fields）
 * @param tagFields - 抽出するフィールド名の配列（profile.json の tags[tag]）
 * @param excludeHidden - hidden フィールドを除外するか（デフォルト: true）
 */
export function pickFieldsByTag(
  fields: ProfileFieldConfig[],
  tagFields: string[] | undefined,
  excludeHidden = true
): ProfileFieldConfig[] {
  if (!tagFields || tagFields.length === 0) return [];
  return fields.filter((field) => {
    if (excludeHidden && field.formInput === "hidden") return false;
    return tagFields.includes(field.name);
  });
}

/**
 * ProfileFieldConfig を FieldConfig に変換
 * - フィールド名にプレフィックスを追加
 * - snake_case → camelCase 変換
 */
function toFieldConfig(
  field: ProfileFieldConfig,
  fieldPrefix: string
): FieldConfig {
  return {
    name: `${fieldPrefix}.${snakeToCamel(field.name)}`,
    label: field.label,
    formInput: field.formInput,
    fieldType: field.fieldType,
    options: field.options,
    placeholder: field.placeholder,
    readonly: field.readonly,
    required: field.required,
    defaultValue: field.defaultValue,
    displayType: field.displayType,
    helperText: field.helperText,
    // MediaUploader 関連
    uploadPath: field.uploadPath,
    slug: field.slug,
    mediaTypePreset: field.mediaTypePreset,
    accept: field.accept,
    validationRule: field.validationRule,
    metadataBinding: field.metadataBinding,
  } as FieldConfig;
}

export type GetFieldConfigsForFormOptions = {
  /** 表示するタグ（省略時は hidden 以外の全フィールド） */
  tag?: string;
  /** フィールド名のプレフィックス（デフォルト: "profileData"） */
  fieldPrefix?: string;
  /** hidden フィールドを除外するか（デフォルト: true） */
  excludeHidden?: boolean;
};

/**
 * プロフィールフィールドをフォーム用の FieldConfig に変換
 * - プレフィックス追加: prefecture → profileData.prefecture
 * - snake_case → camelCase 変換
 * - Map形式で返却（元のフィールド名をキーに）
 *
 * @param profiles - ロール別プロフィール設定のマッピング
 * @param role - 対象ロール
 * @param options - オプション
 * @returns 元のフィールド名 → FieldConfig のマッピング
 *
 * @example
 * const fieldMap = getFieldConfigsForForm(profiles, "user", { tag: "registration" });
 * const prefectureField = fieldMap.get("prefecture");
 * // => { name: "profileData.prefecture", label: "都道府県", ... }
 *
 * // ConfiguredField で使用
 * <ConfiguredField control={control} fieldConfig={fieldMap.get("prefecture")!} />
 */
export function getFieldConfigsForForm(
  profiles: Record<string, ProfileConfig>,
  role: string,
  options?: GetFieldConfigsForFormOptions
): Map<string, FieldConfig> {
  const {
    tag,
    fieldPrefix = "profileData",
    excludeHidden = true,
  } = options ?? {};

  const result = new Map<string, FieldConfig>();

  const profileConfig = profiles[role];
  if (!profileConfig) {
    return result;
  }

  // フィールドを取得（タグ指定 or 全フィールド）
  const profileFields = tag
    ? pickFieldsByTag(
        profileConfig.fields as ProfileFieldConfig[],
        profileConfig.tags?.[tag],
        excludeHidden
      )
    : (profileConfig.fields as ProfileFieldConfig[]).filter(
        (field) => !excludeHidden || field.formInput !== "hidden"
      );

  // Map に変換
  for (const field of profileFields) {
    result.set(field.name, toFieldConfig(field, fieldPrefix));
  }

  return result;
}

/**
 * getFieldConfigsForForm の結果を配列で取得
 * FieldRenderer の baseFields に渡す場合に便利
 *
 * @example
 * const fields = getFieldConfigsForFormAsArray(profiles, "user", { tag: "registration" });
 * <FieldRenderer baseFields={fields} ... />
 */
export function getFieldConfigsForFormAsArray(
  profiles: Record<string, ProfileConfig>,
  role: string,
  options?: GetFieldConfigsForFormOptions
): FieldConfig[] {
  return Array.from(getFieldConfigsForForm(profiles, role, options).values());
}
