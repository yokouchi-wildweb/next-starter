// src/components/Form/Input/Controlled/ColorValueInput.tsx

import { FieldPath, FieldValues } from "react-hook-form";

import { ControlledInputProps } from "@/components/Form/types";
import type { ColorValue } from "@/lib/gradient";

import {
  ColorValueInput as ManualColorValueInput,
  type ColorValueInputProps as ManualProps,
} from "../Manual/ColorValueInput";

type ColorValueInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<ControlledInputProps<TFieldValues, TName>, "onChange" | "value" | "type"> &
  Pick<ManualProps, "modes" | "defaultPreview" | "defaultLabel" | "gradients">;

export const ColorValueInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>(
  props: ColorValueInputProps<TFieldValues, TName>,
) => {
  const { field, modes, defaultPreview, defaultLabel, gradients, ...rest } = props;
  const { value, onChange, onBlur } = field;

  return (
    <ManualColorValueInput
      value={(value as ColorValue | null) ?? null}
      onChange={onChange}
      onBlur={onBlur}
      readOnly={rest.readOnly}
      disabled={rest.disabled}
      className={rest.className}
      modes={modes}
      defaultPreview={defaultPreview}
      defaultLabel={defaultLabel}
      gradients={gradients}
    />
  );
};
