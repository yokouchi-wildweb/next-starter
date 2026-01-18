// src/features/core/userProfile/components/common/RoleProfileFields.tsx

"use client";

import { useMemo } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { FieldRenderer } from "@/components/Form/FieldRenderer";
import type { ProfileConfig } from "../../profiles";
import { getFieldConfigsForFormAsArray } from "../../utils";

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
  const fields = useMemo(
    () => getFieldConfigsForFormAsArray(profiles, role, { tag, fieldPrefix, excludeHidden }),
    [role, profiles, tag, fieldPrefix, excludeHidden]
  );

  if (fields.length === 0) {
    return null;
  }

  const renderer = (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={fields}
    />
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{renderer}</div>;
  }

  return renderer;
}
