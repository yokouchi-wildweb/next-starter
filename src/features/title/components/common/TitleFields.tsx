// src/features/title/components/common/TitleFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/controlled";

export type TitleFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
};

export function TitleFields<TFieldValues extends FieldValues>({ control }: TitleFieldsProps<TFieldValues>) {
  return (
    <FormFieldItem
      control={control}
      name={"name" as FieldPath<TFieldValues>}
      label="タイトル名"
      renderInput={(field) => <TextInput field={field} />}
    />
  );
}
