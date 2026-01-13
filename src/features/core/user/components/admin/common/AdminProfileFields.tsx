// src/features/core/user/components/admin/common/AdminProfileFields.tsx

"use client";

import { useMemo } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

import { DomainFieldRenderer } from "@/components/Form/DomainFieldRenderer";
import type { DomainJsonField } from "@/components/Form/DomainFieldRenderer/fieldMapper";
import {
  getAdminFields,
  hasRoleProfile,
  type UserRoleType,
} from "@/features/core/user/constants/role";

/**
 * snake_case を camelCase に変換
 * domain.json では snake_case、TypeScript では camelCase を使用するため
 */
const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export type AdminProfileFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  role: string;
  /** フィールド名のプレフィックス（例: "profileData"） */
  fieldPrefix?: string;
};

/**
 * 管理画面用ロール別プロフィールフィールド
 * 管理者操作では hidden 以外のすべてのフィールドを表示
 */
export function AdminProfileFields<TFieldValues extends FieldValues>({
  methods,
  role,
  fieldPrefix = "profileData",
}: AdminProfileFieldsProps<TFieldValues>) {
  const fields = useMemo(() => {
    if (!hasRoleProfile(role as UserRoleType)) {
      return [];
    }

    // hidden 以外のすべてのフィールドを取得
    const visibleFields = getAdminFields(role as UserRoleType);

    // ProfileFieldConfig を DomainJsonField に変換（snake_case → camelCase）
    return visibleFields.map(
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
  }, [role, fieldPrefix]);

  if (fields.length === 0) {
    return null;
  }

  return (
    <DomainFieldRenderer
      control={methods.control}
      methods={methods}
      domainJsonFields={fields}
    />
  );
}
