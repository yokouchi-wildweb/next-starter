// src/features/sampleCategory/components/common/SampleCategoryFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/controlled";
import { Textarea } from "@/components/Form/controlled";

export type SampleCategoryFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
};

export function SampleCategoryFields<TFieldValues extends FieldValues>({
  control,
}: SampleCategoryFieldsProps<TFieldValues>) {
  return (
    <>
      <FormFieldItem
        control={control}
        name={"name" as FieldPath<TFieldValues>}
        label="カテゴリ名"
        renderInput={(field) => <TextInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"description" as FieldPath<TFieldValues>}
        label="説明文"
        renderInput={(field) => <Textarea field={field} />}
      />
    </>
  );
}