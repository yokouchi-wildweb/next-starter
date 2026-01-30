// src/components/Form/Input/Controlled/SelectInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import { SelectInput as ManualSelectInput, type SelectInputProps as ManualSelectInputProps } from "../Manual/Select";

export type ControlledSelectInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualSelectInputProps, "value" | "onChange">;

export function SelectInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledSelectInputProps<TFieldValues, TName>) {
  return (
    <ManualSelectInput
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      {...rest}
    />
  );
}
