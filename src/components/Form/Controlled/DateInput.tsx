// src/components/Form/Controlled/DateInput.tsx

import { DateInput as ManualDateInput } from "@/components/Form/Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { type ReactNode } from "react";
import { ControlledInputProps } from "@/components/Form/types";

type DateInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = ControlledInputProps<TFieldValues, TName> & {
  /** 左側に表示するアイコン */
  leftIcon?: ReactNode;
};

export const DateInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  field,
  leftIcon,
  ...rest
}: DateInputProps<TFieldValues, TName>) => {
  const { ref: fieldRef, onChange, value, ...fieldRest } = field;
  const { defaultValue: _defaultValueIgnored, ...restProps } = rest;

  return (
    <ManualDateInput
      {...restProps}
      {...fieldRest}
      ref={fieldRef}
      value={value as any}
      onValueChange={(newValue) => onChange(newValue)}
      leftIcon={leftIcon}
    />
  );
};
