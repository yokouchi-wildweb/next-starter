// src/components/Form/NumberInput.tsx

import type { ChangeEventHandler } from "react";
import { Input } from "src/components/Form/Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/types/form";

export const NumberInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>(props: ControlledInputProps<TFieldValues, TName>) => {
  const { field, value: propValue, onChange, ...rest } = props;
  const { value: fieldValue, onChange: fieldOnChange, ...fieldRest } = field;

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const nextValue = event.target.value;
    const parsedValue = nextValue === "" ? "" : Number(nextValue);
    fieldOnChange(parsedValue);
    onChange?.(event);
  };

  const inputValue = (propValue ?? fieldValue ?? "") as string | number;

  return (
    <Input
      type="number"
      inputMode="decimal"
      {...fieldRest}
      {...rest}
      value={inputValue}
      onChange={handleChange}
    />
  );
};
