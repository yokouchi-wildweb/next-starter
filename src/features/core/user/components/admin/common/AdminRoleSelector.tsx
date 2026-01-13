// src/features/core/user/components/admin/common/AdminRoleSelector.tsx

"use client";

import { useMemo } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { SelectInput } from "@/components/Form/Manual";
import {
  getRoleOptionsByCategory,
  type RoleCategory,
} from "@/features/core/user/constants/role";

export type AdminRoleSelectorProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  /** ロールカテゴリ（"admin" | "user"） */
  category: RoleCategory;
  label?: string;
};

/**
 * 管理画面用ロール選択コンポーネント
 * 指定されたカテゴリのロールを選択可能
 */
export function AdminRoleSelector<TFieldValues extends FieldValues>({
  control,
  name,
  category,
  label = "ロール",
}: AdminRoleSelectorProps<TFieldValues>) {
  const roleOptions = useMemo(() => {
    const roles = getRoleOptionsByCategory(category);
    return roles.map((r) => ({
      value: r.id,
      label: r.name,
    }));
  }, [category]);

  return (
    <FormFieldItem
      control={control}
      name={name}
      label={label}
      renderInput={(field) => (
        <SelectInput field={field} options={roleOptions} />
      )}
    />
  );
}
