// src/features/cardRarity/components/common/CardRarityFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/controlled";
import { SelectInput } from "@/components/Form/manual";
import type { Options } from "@/types/form";

export type CardRarityFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
  titleOptions: Options[];
};

export function CardRarityFields<TFieldValues extends FieldValues>({
  control,
  titleOptions,
}: CardRarityFieldsProps<TFieldValues>) {
  return (
    <>
      <FormFieldItem
        control={control}
        name={"titleId" as FieldPath<TFieldValues>}
        label="タイトル"
        renderInput={(field) => (
          <SelectInput field={field} options={titleOptions} />
        )}
      />
      <FormFieldItem
        control={control}
        name={"name" as FieldPath<TFieldValues>}
        label="レアリティ名"
        renderInput={(field) => <TextInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"sortOrder" as FieldPath<TFieldValues>}
        label="並び順"
        renderInput={(field) => (
          <TextInput field={field} value={field.value ?? ""} type="number" />
        )}
      />
      <FormFieldItem
        control={control}
        name={"description" as FieldPath<TFieldValues>}
        label="説明"
        renderInput={(field) => <TextInput field={field} />}
      />
    </>
  );
}
