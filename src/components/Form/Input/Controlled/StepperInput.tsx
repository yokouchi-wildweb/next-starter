// src/components/Form/Input/Controlled/StepperInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import ManualStepperInput, { type StepperInputProps as ManualStepperInputProps } from "../Manual/StepperInput";

export type ControlledStepperInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualStepperInputProps, "value" | "onValueChange" | "initialValue">;

export function StepperInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledStepperInputProps<TFieldValues, TName>) {
  return (
    <ManualStepperInput
      value={typeof field.value === "number" ? field.value : 0}
      onValueChange={field.onChange}
      onBlur={field.onBlur}
      {...rest}
    />
  );
}
