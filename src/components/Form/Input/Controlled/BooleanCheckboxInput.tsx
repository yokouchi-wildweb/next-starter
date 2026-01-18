// src/components/Form/Input/Controlled/BooleanCheckboxInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  BooleanCheckboxInput as ManualBooleanCheckboxInput,
  type BooleanCheckboxInputProps as ManualBooleanCheckboxInputProps,
} from "../Manual/BooleanCheckboxInput";

export type ControlledBooleanCheckboxInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualBooleanCheckboxInputProps, "value" | "name" | "onChange">;

export function BooleanCheckboxInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledBooleanCheckboxInputProps<TFieldValues, TName>) {
  return (
    <ManualBooleanCheckboxInput
      value={field.value}
      name={field.name}
      onChange={field.onChange}
      {...rest}
    />
  );
}
