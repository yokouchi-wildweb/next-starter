// src/components/Form/Input/Controlled/SwitchInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  SwitchInput as ManualSwitchInput,
  type SwitchInputProps as ManualSwitchInputProps,
} from "../Manual/SwitchInput";

export type ControlledSwitchInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualSwitchInputProps, "value" | "name" | "onChange">;

export function SwitchInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledSwitchInputProps<TFieldValues, TName>) {
  return (
    <ManualSwitchInput
      value={field.value}
      name={field.name}
      onChange={field.onChange}
      {...rest}
    />
  );
}
