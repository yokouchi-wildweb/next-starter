// src/features/sampleTag/components/common/SampleTagFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/Controlled";
import { Textarea } from "@/components/Form/Controlled";

export type SampleTagFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
};

export function SampleTagFields<TFieldValues extends FieldValues>({
  control,
}: SampleTagFieldsProps<TFieldValues>) {
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