// src/features/core/userGroup/components/common/UserGroupCriterionFields/index.tsx
// 部品(props だけ): 条件 1 つの引数の欄。部品の欄のメタ(FieldConfig)から FieldRenderer で描く(選択肢は条件の部品の一覧の API が入れた label)。
// 欄と値の行き来は hook useUserGroupCriterionArgs(日時は ISO の文字、空の欄は落とす)

"use client";

import { FieldRenderer } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field/types";
import { Stack } from "@/components/Layout/Stack";

import { useUserGroupCriterionArgs } from "@/features/core/userGroup/hooks/useUserGroupCriterionArgs";

export type UserGroupCriterionFieldsProps = {
  fields: readonly FieldConfig[];
  args: Record<string, unknown>;
  onChange: (args: Record<string, unknown>) => void;
  disabled?: boolean;
};

export function UserGroupCriterionFields({ fields, args, onChange, disabled = false }: UserGroupCriterionFieldsProps) {
  const { methods, fields: base } = useUserGroupCriterionArgs({ fields, args, onChange });
  const shown = disabled ? base.map((field) => ({ ...field, disabled: true })) : base;
  return (
    <Stack space={3} data-slot="user-group-criterion-fields">
      <FieldRenderer control={methods.control} methods={methods} baseFields={shown} />
    </Stack>
  );
}
