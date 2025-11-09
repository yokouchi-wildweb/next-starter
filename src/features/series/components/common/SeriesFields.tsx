// src/features/series/components/common/SeriesFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { DateInput, TextInput } from "@/components/Form/controlled";
import { SelectInput } from "@/components/Form/manual";
import type { Options } from "@/types/form";

export type SeriesFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
  titleOptions: Options[];
};

export function SeriesFields<TFieldValues extends FieldValues>({
  control,
  titleOptions,
}: SeriesFieldsProps<TFieldValues>) {
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
        label="シリーズ名"
        renderInput={(field) => <TextInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"description" as FieldPath<TFieldValues>}
        label="説明"
        renderInput={(field) => <TextInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"releaseDate" as FieldPath<TFieldValues>}
        label="発売日"
        renderInput={(field) => <DateInput field={field} />}
      />
    </>
  );
}
