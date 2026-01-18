// src/components/Form/Input/Controlled/BooleanRadioGroupInput.tsx

import type { ComponentProps } from "react";
import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import {
  BooleanRadioGroupInput as ManualBooleanRadioGroupInput,
  type BooleanRadioGroupOption,
} from "../Manual/BooleanRadioGroupInput";
import { RadioGroup } from "@/components/_shadcn/radio-group";

type RadioItemSizeProps = {
  size?: "sm" | "md" | "lg";
};

export type ControlledBooleanRadioGroupInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  options?: BooleanRadioGroupOption[];
  size?: RadioItemSizeProps["size"];
} & Omit<ComponentProps<typeof RadioGroup>, "value" | "defaultValue" | "onValueChange">;

export function BooleanRadioGroupInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledBooleanRadioGroupInputProps<TFieldValues, TName>) {
  return (
    <ManualBooleanRadioGroupInput
      field={{
        value: field.value as boolean | null | undefined,
        name: field.name,
        onChange: field.onChange,
      }}
      {...rest}
    />
  );
}
