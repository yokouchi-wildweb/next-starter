// src/features/core/userProfile/components/common/RoleProfileFields.tsx

"use client";

import { useMemo } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { DomainFieldRenderer } from "@/components/Form/DomainFieldRenderer";
import type { DomainJsonField } from "@/components/Form/DomainFieldRenderer/types";
import type { ProfileFieldConfig } from "../../types";
import type { ProfileConfig } from "../../profiles";
import { pickFieldsByTag } from "../../utils/profileSchemaHelpers";

/**
 * snake_case を camelCase に変換
 * domain.json では snake_case、TypeScript では camelCase を使用するため
 */
const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export type RoleProfileFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  /** ロール */
  role: string;
  /** ロール別プロフィール設定のマッピング */
  profiles: Record<string, ProfileConfig>;
  /**
   * 表示するタグ
   * - 指定した場合: 指定タグに属するフィールドを表示
   * - 指定しない場合: hidden 以外の全フィールドを表示（管理画面向け）
   */
  tag?: string;
  /** フィールド名のプレフィックス（デフォルト: "profileData"） */
  fieldPrefix?: string;
  /** hidden フィールドを除外するか（デフォルト: true） */
  excludeHidden?: boolean;
  /** ラッパー div のクラス名 */
  wrapperClassName?: string;
};

/**
 * ロール別プロフィールフィールドを動的に表示する汎用コンポーネント
 *
 * @example
 * // 登録画面（registration タグのフィールドのみ）
 * import userProfile from ".../profiles/user.profile.json";
 * import contributorProfile from ".../profiles/contributor.profile.json";
 *
 * const profiles = { user: userProfile, contributor: contributorProfile };
 *
 * <RoleProfileFields
 *   methods={methods}
 *   role={selectedRole}
 *   profiles={profiles}
 *   tag="registration"
 * />
 *
 * @example
 * // 管理画面（hidden 以外の全フィールド）
 * <RoleProfileFields
 *   methods={methods}
 *   role={selectedRole}
 *   profiles={profiles}
 * />
 */
export function RoleProfileFields<TFieldValues extends FieldValues>({
  methods,
  role,
  profiles,
  tag,
  fieldPrefix = "profileData",
  excludeHidden = true,
  wrapperClassName,
}: RoleProfileFieldsProps<TFieldValues>) {
  const fields = useMemo(() => {
    const profileConfig = profiles[role];
    if (!profileConfig) {
      return [];
    }

    // tag が指定されていない場合は全フィールド（hidden 以外）
    const profileFields = tag
      ? pickFieldsByTag(
          profileConfig.fields as ProfileFieldConfig[],
          profileConfig.tags?.[tag],
          excludeHidden
        )
      : (profileConfig.fields as ProfileFieldConfig[]).filter(
          (field) => !excludeHidden || field.formInput !== "hidden"
        );

    // ProfileFieldConfig を DomainJsonField に変換（snake_case → camelCase）
    return profileFields.map(
      (field: ProfileFieldConfig) =>
        ({
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
        }) as DomainJsonField
    );
  }, [role, profiles, tag, fieldPrefix, excludeHidden]);

  if (fields.length === 0) {
    return null;
  }

  const renderer = (
    <DomainFieldRenderer
      control={methods.control}
      methods={methods}
      domainJsonFields={fields}
    />
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{renderer}</div>;
  }

  return renderer;
}
