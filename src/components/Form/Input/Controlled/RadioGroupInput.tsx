// src/components/Form/Input/Controlled/RadioGroupInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  RadioGroupInput as ManualRadioGroupInput,
  type RadioGroupInputProps as ManualRadioGroupInputProps,
} from "../Manual/RadioGroupInput";

export type ControlledRadioGroupInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualRadioGroupInputProps, "value" | "onChange">;

export function RadioGroupInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledRadioGroupInputProps<TFieldValues, TName>) {
  return (
    <ManualRadioGroupInput
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      {...rest}
    />
  );
}
