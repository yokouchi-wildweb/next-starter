// src/components/Form/Input/Controlled/RadioGroupInput.tsx

import type { ComponentProps } from "react";
import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  RadioGroupInput as ManualRadioGroupInput,
  type RadioGroupDisplayType,
  type RadioGroupOrientation,
} from "../Manual/RadioGroupInput";
import type { Options } from "@/components/Form/types";
import type { ButtonStyleProps } from "@/components/Form/Button/Button";
import { RadioGroup } from "@/components/_shadcn/radio-group";

type OptionPrimitive = Options["value"];

export type ControlledRadioGroupInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  options?: Options[];
  displayType?: RadioGroupDisplayType;
  orientation?: RadioGroupOrientation;
  buttonVariant?: ButtonStyleProps["variant"];
  buttonSize?: ButtonStyleProps["size"];
  selectedButtonVariant?: ButtonStyleProps["variant"];
  unselectedButtonVariant?: ButtonStyleProps["variant"];
} & Omit<ComponentProps<typeof RadioGroup>, "value" | "defaultValue" | "onValueChange" | "orientation">;

export function RadioGroupInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledRadioGroupInputProps<TFieldValues, TName>) {
  return (
    <ManualRadioGroupInput
      field={{
        value: field.value as OptionPrimitive | null | undefined,
        onChange: field.onChange,
      }}
      {...rest}
    />
  );
}
