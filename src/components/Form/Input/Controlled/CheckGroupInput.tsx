// src/components/Form/Input/Controlled/CheckGroupInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  CheckGroupInput as ManualCheckGroupInput,
  type CheckGroupInputProps as ManualCheckGroupInputProps,
} from "../Manual/CheckGroupInput";

export type ControlledCheckGroupInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualCheckGroupInputProps, "value" | "onChange">;

export function CheckGroupInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledCheckGroupInputProps<TFieldValues, TName>) {
  return (
    <ManualCheckGroupInput
      value={field.value}
      onChange={field.onChange}
      {...rest}
    />
  );
}
