// src/components/Form/Input/Controlled/SwitchInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  SwitchInput as ManualSwitchInput,
  type SwitchInputProps as ManualSwitchInputProps,
} from "../Manual/SwitchInput";

export type ControlledSwitchInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
  T = boolean,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualSwitchInputProps<T>, "value" | "name" | "onChange">;

export function SwitchInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
  T = boolean,
>({ field, ...rest }: ControlledSwitchInputProps<TFieldValues, TName, T>) {
  return (
    <ManualSwitchInput<T>
      value={field.value as T | null | undefined}
      name={field.name}
      onChange={field.onChange}
      onBlur={field.onBlur}
      {...rest}
    />
  );
}
