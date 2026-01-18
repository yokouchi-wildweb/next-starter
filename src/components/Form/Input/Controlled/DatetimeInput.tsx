// src/components/Form/Controlled/DatetimeInput.tsx

import { DatetimeInput as ManualDatetimeInput } from "../Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { type ReactNode } from "react";
import { ControlledInputProps } from "@/components/Form/types";
import dayjs from "dayjs";

type DatetimeInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = ControlledInputProps<TFieldValues, TName> & {
  /** 左側に表示するアイコン */
  leftIcon?: ReactNode;
};

export const DatetimeInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  leftIcon,
  ...rest
}: DatetimeInputProps<TFieldValues, TName>) => {
  const { ref: fieldRef, onChange, value, ...fieldRest } = field;
  const { defaultValue: _defaultValueIgnored, ...restProps } = rest;

  const handleValueChange = (rawValue: string) => {
    if (!rawValue) {
      onChange(null);
      return;
    }

    const parsed = dayjs(rawValue);
    if (parsed.isValid()) {
      onChange(parsed.toDate());
      return;
    }

    onChange(null);
  };

  return (
    <ManualDatetimeInput
      {...restProps}
      {...fieldRest}
      ref={fieldRef}
      value={value as any}
      onValueChange={handleValueChange}
      leftIcon={leftIcon}
    />
  );
};
