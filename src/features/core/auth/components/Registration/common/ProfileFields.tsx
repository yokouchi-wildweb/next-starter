// src/features/core/auth/components/Registration/common/ProfileFields.tsx

"use client";

import { useMemo } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { DomainFieldRenderer } from "@/components/Form/DomainFieldRenderer";
import type { DomainJsonField } from "@/components/Form/DomainFieldRenderer/fieldMapper";
import {
  getRegistrationFields,
  hasRoleProfile,
  type UserRoleType,
} from "@/features/core/user/constants/role";

export type ProfileFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  role: string;
  /** フィールド名のプレフィックス（例: "profileData"） */
  fieldPrefix?: string;
};

/**
 * ロール別プロフィールフィールドを動的に表示
 * getRegistrationFields で取得した showOnRegistration: true のフィールドのみ表示
 */
export function ProfileFields<TFieldValues extends FieldValues>({
  methods,
  role,
  fieldPrefix = "profileData",
}: ProfileFieldsProps<TFieldValues>) {
  const fields = useMemo(() => {
    if (!hasRoleProfile(role as UserRoleType)) {
      return [];
    }

    const profileFields = getRegistrationFields(role as UserRoleType);

    // ProfileFieldConfig を DomainJsonField に変換（互換性あり）
    // フィールド名にプレフィックスを追加
    return profileFields.map(
      (field) =>
        ({
          name: `${fieldPrefix}.${field.name}`,
          label: field.label,
          formInput: field.formInput,
          fieldType: field.fieldType,
          options: field.options,
          placeholder: field.placeholder,
          readonly: field.readonly,
        }) as DomainJsonField,
    );
  }, [role, fieldPrefix]);

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <DomainFieldRenderer
        control={methods.control}
        methods={methods}
        domainJsonFields={fields}
      />
    </div>
  );
}
