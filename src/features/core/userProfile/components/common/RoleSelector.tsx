// src/features/core/userProfile/components/common/RoleSelector.tsx

"use client";

import { useMemo } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FieldItem } from "@/components/Form";
import { RadioGroupInput, SelectInput } from "@/components/Form/Input/Controlled";
import type { RadioGroupDisplayType } from "@/components/Form/Input/Manual/RadioGroupInput";
import {
  getRoleOptionsByCategory,
  getRoleDescription,
  type RoleCategory,
} from "@/features/core/user/constants";

/**
 * 入力タイプ
 * - select: セレクトボックス
 * - radio: ラジオボタン（displayType で見た目を変更可能）
 */
export type RoleSelectorInputType = "select" | "radio";

export type RoleSelectorProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  /** ロールカテゴリ（複数指定可、デフォルト: ["user"]） */
  categories?: RoleCategory[];
  /** 選択可能なロールIDを制限（指定しない場合は categories の全ロール） */
  selectableRoles?: string[];
  /** 入力タイプ（デフォルト: "radio"） */
  inputType?: RoleSelectorInputType;
  /** ラジオボタンの表示タイプ（inputType: "radio" の場合のみ有効） */
  radioDisplayType?: RadioGroupDisplayType;
  /** 説明文を表示するか（デフォルト: false） */
  showDescription?: boolean;
  /** ラベル（デフォルト: "ロール"） */
  label?: string;
};

/**
 * 汎用ロール選択コンポーネント
 *
 * @example
 * // 登録画面（ユーザーカテゴリ、ラジオボタン）
 * <RoleSelector
 *   control={control}
 *   name="role"
 *   categories={["user"]}
 *   radioDisplayType="standard"
 *   showDescription
 * />
 *
 * @example
 * // 管理画面（管理者カテゴリ、セレクトボックス）
 * <RoleSelector
 *   control={control}
 *   name="role"
 *   categories={["admin"]}
 *   inputType="select"
 * />
 *
 * @example
 * // 全ロール選択可能
 * <RoleSelector
 *   control={control}
 *   name="role"
 *   categories={["admin", "user"]}
 *   inputType="select"
 * />
 */
export function RoleSelector<TFieldValues extends FieldValues>({
  control,
  name,
  categories = ["user"],
  selectableRoles,
  inputType = "radio",
  radioDisplayType = "standard",
  showDescription = false,
  label = "ロール",
}: RoleSelectorProps<TFieldValues>) {
  const roleOptions = useMemo(() => {
    // 指定されたカテゴリのロールを取得
    const allRoles = categories.flatMap((category) =>
      getRoleOptionsByCategory(category)
    );

    // selectableRoles が指定されている場合はフィルタリング
    const filteredRoles = selectableRoles
      ? allRoles.filter((r) => selectableRoles.includes(r.id))
      : allRoles;

    // オプション形式に変換
    return filteredRoles.map((r) => ({
      value: r.id,
      label: r.name,
      ...(showDescription && {
        description: getRoleDescription(r.id),
      }),
    }));
  }, [categories, selectableRoles, showDescription]);

  // セレクトボックス
  if (inputType === "select") {
    return (
      <FieldItem
        control={control}
        name={name}
        label={label}
        renderInput={(field) => (
          <SelectInput field={field} options={roleOptions} />
        )}
      />
    );
  }

  // ラジオボタン
  return (
    <FieldItem
      control={control}
      name={name}
      label={label}
      renderInput={(field) => (
        <RadioGroupInput
          field={field}
          options={roleOptions}
          displayType={radioDisplayType}
        />
      )}
    />
  );
}
