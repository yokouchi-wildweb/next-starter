// src/features/core/auth/components/Registration/common/RoleSelector.tsx

"use client";

import { useMemo } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { RadioGroupInput } from "@/components/Form/Manual";
import { APP_FEATURES } from "@/config/app/app-features.config";
import {
  getRoleOptionsByCategory,
  USER_ROLE_DESCRIPTIONS,
  type UserRoleType,
} from "@/features/core/user/constants/role";

export type RoleSelectorProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
};

/**
 * ロール選択コンポーネント
 * APP_FEATURES.registration.showRoleSelection が true の場合に表示
 */
export function RoleSelector<TFieldValues extends FieldValues>({
  control,
  name,
}: RoleSelectorProps<TFieldValues>) {
  const { showRoleSelection, selectableRoles } = APP_FEATURES.registration;

  const roleOptions = useMemo(() => {
    // selectableRoles が指定されている場合はそれを使用、なければ user カテゴリ全体
    const userRoles = getRoleOptionsByCategory("user");

    if (selectableRoles.length > 0) {
      return userRoles
        .filter((r) => selectableRoles.includes(r.id))
        .map((r) => ({
          value: r.id,
          label: r.name,
          description: USER_ROLE_DESCRIPTIONS[r.id as UserRoleType],
        }));
    }

    return userRoles.map((r) => ({
      value: r.id,
      label: r.name,
      description: USER_ROLE_DESCRIPTIONS[r.id as UserRoleType],
    }));
  }, [selectableRoles]);

  if (!showRoleSelection || roleOptions.length <= 1) {
    return null;
  }

  return (
    <FormFieldItem
      control={control}
      name={name}
      label={<span className="text-sm font-medium">アカウントタイプ</span>}
      renderInput={(field) => (
        <RadioGroupInput
          field={field}
          options={roleOptions}
          displayType="standard"
        />
      )}
    />
  );
}
