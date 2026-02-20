// src/components/Form/Input/Controlled/ColorInput.tsx

import { ColorInput as ManualColorInput } from "../Manual/ColorInput";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/components/Form/types";

type ColorInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<ControlledInputProps<TFieldValues, TName>, "onChange" | "value" | "type">;

export const ColorInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: ColorInputProps<TFieldValues, TName>,
) => {
  const { field, ...rest } = props;
  const { value, onChange, onBlur, ...fieldRest } = field;

  return (
    <ManualColorInput
      {...fieldRest}
      value={(value as string) ?? "#000000"}
      onChange={onChange}
      onBlur={onBlur}
      readOnly={rest.readOnly}
      disabled={rest.disabled}
      className={rest.className}
    />
  );
};
