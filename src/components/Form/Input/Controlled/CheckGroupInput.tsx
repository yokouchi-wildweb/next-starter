// src/components/Form/Input/Controlled/CheckGroupInput.tsx

import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  CheckGroupInput as ManualCheckGroupInput,
  type CheckGroupDisplayType,
  type CheckGroupOrientation,
} from "../Manual/CheckGroupInput";
import type { Options } from "@/components/Form/types";
import type { ButtonStyleProps } from "@/components/Form/Button/Button";
import type { HTMLAttributes } from "react";

type OptionPrimitive = Options["value"];

export type ControlledCheckGroupInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  options?: Options[];
  displayType?: CheckGroupDisplayType;
  orientation?: CheckGroupOrientation;
  buttonVariant?: ButtonStyleProps["variant"];
  buttonSize?: ButtonStyleProps["size"];
  selectedButtonVariant?: ButtonStyleProps["variant"];
  unselectedButtonVariant?: ButtonStyleProps["variant"];
} & HTMLAttributes<HTMLDivElement>;

export function CheckGroupInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledCheckGroupInputProps<TFieldValues, TName>) {
  return (
    <ManualCheckGroupInput
      field={{
        value: field.value as OptionPrimitive[] | undefined,
        onChange: field.onChange,
      }}
      {...rest}
    />
  );
}
