// src/features/setting/components/common/SettingFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FieldItem } from "@/components/Form";
import { TextInput } from "@/components/Form/Input/Controlled";

export type SettingFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
};

export function SettingFields<TFieldValues extends FieldValues>({
  control,
}: SettingFieldsProps<TFieldValues>) {
  return (
    <>
      <FieldItem
        control={control}
        name={"adminListPerPage" as FieldPath<TFieldValues>}
        label="一覧表示件数"
        renderInput={(field) => <TextInput field={field} type="number" min={1} max={500} />}
      />
    </>
  );
}
