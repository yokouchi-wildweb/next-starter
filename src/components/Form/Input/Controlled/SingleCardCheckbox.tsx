// src/components/Form/Input/Controlled/SingleCardCheckbox.tsx

import type { ReactNode } from "react";
import type { FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";
import { SingleCardCheckbox as ManualSingleCardCheckbox } from "../Manual/SingleCardCheckbox";

type ColorVariant = "success" | "primary" | "secondary" | "accent" | "destructive" | "muted" | "outline";
type SizeVariant = "sm" | "md" | "lg";

export type ControlledSingleCardCheckboxProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
  label: ReactNode;
  uncheckedVariant?: ColorVariant;
  checkedVariant?: ColorVariant;
  size?: SizeVariant;
  fullWidth?: boolean;
  centered?: boolean;
  disabled?: boolean;
  className?: string;
};

export function SingleCardCheckbox<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, ...rest }: ControlledSingleCardCheckboxProps<TFieldValues, TName>) {
  return (
    <ManualSingleCardCheckbox
      field={{
        value: field.value as boolean | null | undefined,
        name: field.name,
        onChange: field.onChange,
      }}
      {...rest}
    />
  );
}
