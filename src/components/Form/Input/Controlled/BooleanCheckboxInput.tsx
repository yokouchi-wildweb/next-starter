// src/components/Form/Input/Controlled/BooleanCheckboxInput.tsx

import type { ComponentProps, ReactNode } from "react";
import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import { BooleanCheckboxInput as ManualBooleanCheckboxInput } from "../Manual/BooleanCheckboxInput";
import { Checkbox } from "@/components/_shadcn/checkbox";
import type { VariantProps } from "class-variance-authority";

type CheckboxSizeProps = {
  size?: "sm" | "md" | "lg";
};

export type ControlledBooleanCheckboxInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  label?: ReactNode;
  size?: CheckboxSizeProps["size"];
} & Omit<ComponentProps<typeof Checkbox>, "checked" | "defaultChecked" | "onCheckedChange" | "value">;

export function BooleanCheckboxInput<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledBooleanCheckboxInputProps<TFieldValues, TName>) {
  return (
    <ManualBooleanCheckboxInput
      field={{
        value: field.value as boolean | null | undefined,
        name: field.name,
        onChange: field.onChange,
      }}
      {...rest}
    />
  );
}
