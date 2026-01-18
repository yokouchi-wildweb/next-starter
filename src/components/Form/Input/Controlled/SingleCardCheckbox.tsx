// src/components/Form/Input/Controlled/SingleCardCheckbox.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  SingleCardCheckbox as ManualSingleCardCheckbox,
  type SingleCardCheckboxProps as ManualSingleCardCheckboxProps,
} from "../Manual/SingleCardCheckbox";

export type ControlledSingleCardCheckboxProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<ManualSingleCardCheckboxProps, "value" | "name" | "onChange">;

export function SingleCardCheckbox<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledSingleCardCheckboxProps<TFieldValues, TName>) {
  return (
    <ManualSingleCardCheckbox
      value={field.value}
      name={field.name}
      onChange={field.onChange}
      {...rest}
    />
  );
}
