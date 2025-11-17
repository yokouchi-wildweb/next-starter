// src/features/__domain__/components/common/__Domain__Fields.tsx

import { FieldValues, type Control } from "react-hook-form";

export type __Domain__FieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
};

export function __Domain__Fields<TFieldValues extends FieldValues>({ control }: __Domain__FieldsProps<TFieldValues>) {
  return <div>{/* TODO: フォーム項目を実装してください */}</div>;
}
