// src/components/Form/Controlled/DatetimeInput.tsx

import { DatetimeInput as ManualDatetimeInput } from "@/components/Form/Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/components/Form/types";
import dayjs from "dayjs";

export const DatetimeInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  field,
  ...rest
}: ControlledInputProps<TFieldValues, TName>) => {
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
    />
  );
};
