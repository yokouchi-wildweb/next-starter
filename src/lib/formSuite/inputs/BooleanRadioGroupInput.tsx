// src/lib/formSuite/inputs/BooleanRadioGroupInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  BooleanRadioGroupInput as ManualBooleanRadioGroupInput,
  type BooleanRadioGroupInputProps as ManualBooleanRadioGroupInputProps,
} from "@/components/Input/BooleanRadioGroupInput";

export type ControlledBooleanRadioGroupInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualBooleanRadioGroupInputProps, "value" | "name" | "onChange">;

export function ControlledBooleanRadioGroupInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledBooleanRadioGroupInputProps<TFieldValues, TName>) {
  return (
    <ManualBooleanRadioGroupInput
      value={field.value}
      name={field.name}
      onChange={field.onChange}
      {...rest}
    />
  );
}
