// src/components/Form/NumberInput.tsx

import type { ChangeEventHandler, ReactNode } from "react";
import { Input } from "../Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/components/Form/types";

type NumberInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = ControlledInputProps<TFieldValues, TName> & {
  /** 左側に表示するアイコン */
  leftIcon?: ReactNode;
};

export const NumberInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>(props: NumberInputProps<TFieldValues, TName>) => {
  const { field, value: propValue, onChange, leftIcon, ...rest } = props;
  const { value: fieldValue, onChange: fieldOnChange, ...fieldRest } = field;

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const nextValue = event.target.value;
    const parsedValue = nextValue === "" ? null : Number(nextValue);
    fieldOnChange(parsedValue);
    onChange?.(event);
  };

  const inputValue = (propValue ?? fieldValue ?? "") as string | number | undefined;

  return (
    <Input
      type="number"
      inputMode="decimal"
      {...fieldRest}
      {...rest}
      value={inputValue}
      onChange={handleChange}
      leftIcon={leftIcon}
    />
  );
};
