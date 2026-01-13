// src/features/core/userProfile/components/common/RoleProfileFields.tsx

"use client";

import { useMemo } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { DomainFieldRenderer } from "@/components/Form/DomainFieldRenderer";
import type { DomainJsonField } from "@/components/Form/DomainFieldRenderer/types";
import {
  hasRoleProfile,
  type UserRoleType,
} from "@/features/core/user/constants";
import {
  getFieldsByTags,
  getAdminFields,
  type ProfileFieldTag,
} from "../../utils";

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
  /**
   * 表示するタグ
   * - 指定した場合: 指定タグのいずれかを持つフィールドを表示
   * - 指定しない場合: hidden 以外の全フィールドを表示（管理画面向け）
   */
  tags?: ProfileFieldTag[];
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
 * <RoleProfileFields
 *   methods={methods}
 *   role={selectedRole}
 *   tags={["registration"]}
 * />
 *
 * @example
 * // マイページ（mypage タグのフィールドのみ）
 * <RoleProfileFields
 *   methods={methods}
 *   role={user.role}
 *   tags={["mypage"]}
 * />
 *
 * @example
 * // 管理画面（hidden 以外の全フィールド）
 * <RoleProfileFields
 *   methods={methods}
 *   role={selectedRole}
 * />
 *
 * @example
 * // 通知設定画面
 * <RoleProfileFields
 *   methods={methods}
 *   role={user.role}
 *   tags={["notification"]}
 * />
 */
export function RoleProfileFields<TFieldValues extends FieldValues>({
  methods,
  role,
  tags,
  fieldPrefix = "profileData",
  excludeHidden = true,
  wrapperClassName,
}: RoleProfileFieldsProps<TFieldValues>) {
  const fields = useMemo(() => {
    if (!hasRoleProfile(role as UserRoleType)) {
      return [];
    }

    // tags が指定されていない場合は管理画面向け（hidden 以外の全フィールド）
    const profileFields = tags
      ? getFieldsByTags(role as UserRoleType, tags, excludeHidden)
      : getAdminFields(role as UserRoleType);

    // ProfileFieldConfig を DomainJsonField に変換（snake_case → camelCase）
    return profileFields.map(
      (field) =>
        ({
          name: `${fieldPrefix}.${snakeToCamel(field.name)}`,
          label: field.label,
          formInput: field.formInput,
          fieldType: field.fieldType,
          options: field.options,
          placeholder: field.placeholder,
          readonly: field.readonly,
        }) as DomainJsonField,
    );
  }, [role, tags, fieldPrefix, excludeHidden]);

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
