// src/components/Form/Controlled/MultiSelectInput.tsx

import { type FieldPath, type FieldValues } from "react-hook-form";

import {
  MultiSelectInput as ManualMultiSelectInput,
  type MultiSelectInputProps as ManualMultiSelectInputProps,
} from "@/components/Form/Input/Manual/MultiSelectInput";
import { type ControlledInputProps } from "@/components/Form/types";

export type ControlledMultiSelectInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<ManualMultiSelectInputProps, "field"> &
  ControlledInputProps<TFieldValues, TName>;

export const MultiSelectInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  ...rest
}: ControlledMultiSelectInputProps<TFieldValues, TName>) => {
  return <ManualMultiSelectInput field={field} {...rest} />;
};
