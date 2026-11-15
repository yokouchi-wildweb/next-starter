// src/features/core/userGroup/components/common/UserGroupCriterionFields/index.tsx
// 部品(props だけ): 条件 1 つの引数の欄。部品の欄のメタ(FieldConfig)から FieldRenderer で描く(選択肢は条件の部品の一覧の API が入れた label)。
// 欄と値の行き来は hook useUserGroupCriterionArgs(日時は ISO の文字、空の欄は落とす)。
// FieldRenderer の欄(FormLabel など)は react-hook-form の文脈を読むので FormProvider で包む。AppForm は使わない
// (<form>・送信の錠・離れる前の確かめを持つが、条件 1 つの欄には要らない。書きかけの確かめはモーダルの form の hook が持つ)

"use client";

import { FormProvider } from "react-hook-form";

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
    <FormProvider {...methods}>
      <Stack space={3} data-slot="user-group-criterion-fields">
        <FieldRenderer control={methods.control} methods={methods} baseFields={shown} />
      </Stack>
    </FormProvider>
  );
}
