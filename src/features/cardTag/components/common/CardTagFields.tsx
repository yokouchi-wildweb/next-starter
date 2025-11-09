// src/features/cardTag/components/common/CardTagFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput, Textarea } from "@/components/Form/controlled";

export type CardTagFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
};

export function CardTagFields<TFieldValues extends FieldValues>({ control }: CardTagFieldsProps<TFieldValues>) {
  return (
    <>
      <FormFieldItem
        control={control}
        name={"name" as FieldPath<TFieldValues>}
        label="タグ名"
        renderInput={(field) => <TextInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"description" as FieldPath<TFieldValues>}
        label="説明"
        renderInput={(field) => <Textarea field={field} />}
      />
    </>
  );
}
