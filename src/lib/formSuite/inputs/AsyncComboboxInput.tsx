// src/lib/formSuite/inputs/AsyncComboboxInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  AsyncComboboxInput as ManualAsyncComboboxInput,
  type AsyncComboboxInputProps as ManualAsyncComboboxInputProps,
} from "@/components/Input/AsyncComboboxInput";

export type ControlledAsyncComboboxInputProps<
  T,
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualAsyncComboboxInputProps<T>, "value" | "onChange">;

export function ControlledAsyncComboboxInput<
  T,
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledAsyncComboboxInputProps<T, TFieldValues, TName>) {
  return (
    <ManualAsyncComboboxInput<T>
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      {...rest}
    />
  );
}
