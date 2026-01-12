// src/components/Form/Controlled/DateInput.tsx

import { DateInput as ManualDateInput } from "@/components/Form/Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/components/Form/types";

export const DateInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  field,
  ...rest
}: ControlledInputProps<TFieldValues, TName>) => {
  const { ref: fieldRef, onChange, value, ...fieldRest } = field;
  const { defaultValue: _defaultValueIgnored, ...restProps } = rest;

  return (
    <ManualDateInput
      {...restProps}
      {...fieldRest}
      ref={fieldRef}
      value={value as any}
      onValueChange={(newValue) => onChange(newValue)}
    />
  );
};
