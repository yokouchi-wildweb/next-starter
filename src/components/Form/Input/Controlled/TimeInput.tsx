// @/components/Form/Input/Controlled/TimeInput.tsx

import { TimeInput as ManualTimeInput } from "../Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { type ReactNode } from "react";
import { ControlledInputProps } from "@/components/Form/types";

type TimeInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = ControlledInputProps<TFieldValues, TName> & {
  /** 左側に表示するアイコン */
  leftIcon?: ReactNode;
};

export const TimeInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  field,
  leftIcon,
  ...rest
}: TimeInputProps<TFieldValues, TName>) => {
  const { ref: fieldRef, onChange, value, ...fieldRest } = field;
  const { defaultValue: _defaultValueIgnored, ...restProps } = rest;

  return (
    <ManualTimeInput
      {...restProps}
      {...fieldRest}
      ref={fieldRef}
      value={value as any}
      onValueChange={(newValue) => onChange(newValue)}
      leftIcon={leftIcon}
    />
  );
};
