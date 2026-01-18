// src/components/Form/Controlled/MultiSelectInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";

import {
  MultiSelectInput as ManualMultiSelectInput,
  type MultiSelectInputProps as ManualMultiSelectInputProps,
} from "@/components/Form/Input/Manual/MultiSelectInput";

export type ControlledMultiSelectInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualMultiSelectInputProps, "value" | "name" | "onChange">;

export function MultiSelectInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledMultiSelectInputProps<TFieldValues, TName>) {
  return (
    <ManualMultiSelectInput
      value={field.value}
      name={field.name}
      onChange={field.onChange}
      {...rest}
    />
  );
}
