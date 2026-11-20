// src/lib/formSuite/inputs/ComboboxInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  ComboboxInput as ManualComboboxInput,
  type ComboboxInputProps as ManualComboboxInputProps,
} from "@/components/Input/ComboboxInput";

export type ControlledComboboxInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualComboboxInputProps, "value" | "onChange">;

export function ControlledComboboxInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledComboboxInputProps<TFieldValues, TName>) {
  return (
    <ManualComboboxInput
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      {...rest}
    />
  );
}
