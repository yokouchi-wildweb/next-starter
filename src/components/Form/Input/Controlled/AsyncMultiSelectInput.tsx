// src/components/Form/Input/Controlled/AsyncMultiSelectInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  AsyncMultiSelectInput as ManualAsyncMultiSelectInput,
  type AsyncMultiSelectInputProps as ManualAsyncMultiSelectInputProps,
} from "../Manual/AsyncMultiSelectInput";

export type ControlledAsyncMultiSelectInputProps<
  T,
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualAsyncMultiSelectInputProps<T>, "value" | "name" | "onChange">;

export function AsyncMultiSelectInput<
  T,
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledAsyncMultiSelectInputProps<T, TFieldValues, TName>) {
  return (
    <ManualAsyncMultiSelectInput<T>
      value={field.value}
      name={field.name}
      onChange={field.onChange}
      onBlur={field.onBlur}
      {...rest}
    />
  );
}
