// src/features/core/userProfile/components/common/RoleProfileFields.tsx

"use client";

import { useMemo } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import type { InsertFieldsMap } from "@/components/Form/FieldRenderer";
import { FieldRenderer, type FieldRendererProps } from "@/components/Form/FieldRenderer";
import { FormSkeleton } from "@/components/Skeleton/FormSkeleton";
import { useRelationOptions } from "@/lib/domain/hooks/useRelationOptions";
import { toCamelCase } from "@/utils/stringCase.mjs";
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
  /** 特定フィールドの前に挿入するUI（formInput: "custom" 用） */
  beforeField?: FieldRendererProps<TFieldValues>["beforeField"];
  /** 特定フィールドの後に挿入するUI（formInput: "custom" 用） */
  afterField?: FieldRendererProps<TFieldValues>["afterField"];
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
  beforeField,
  afterField,
}: RoleProfileFieldsProps<TFieldValues>) {
  const profileConfig = profiles[role];

  const fields = useMemo(
    () => getFieldConfigsForFormAsArray(profiles, role, { tag, fieldPrefix, excludeHidden }),
    [role, profiles, tag, fieldPrefix, excludeHidden]
  );

  // リレーションフィールドをビジネスドメインと同じ useRelationOptions で処理
  const { insertBefore: rawInsertBefore, isLoading: isRelationLoading } = useRelationOptions({
    relations: profileConfig?.relations,
  });

  // useRelationOptions の FieldConfig.name は snake_case（例: event_genre_id）
  // プロフィールフォームでは ${fieldPrefix}.${camelCase} 形式が必要なので変換
  const relationInsertBefore = useMemo<InsertFieldsMap>(() => {
    const result: InsertFieldsMap = {};
    for (const [key, fieldConfigs] of Object.entries(rawInsertBefore)) {
      if (!fieldConfigs) continue;
      result[key] = fieldConfigs.map((fc) => ({
        ...fc,
        name: `${fieldPrefix}.${toCamelCase(fc.name)}`,
      }));
    }
    return result;
  }, [rawInsertBefore, fieldPrefix]);

  if (fields.length === 0 && !profileConfig?.relations?.length) {
    return null;
  }

  if (isRelationLoading) {
    return <FormSkeleton />;
  }

  const renderer = (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={fields}
      insertBefore={relationInsertBefore}
      beforeField={beforeField}
      afterField={afterField}
    />
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{renderer}</div>;
  }

  return renderer;
}
