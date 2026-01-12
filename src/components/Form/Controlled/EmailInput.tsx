// src/components/Form/Controlled/EmailInput.tsx

import { FieldPath, FieldValues } from "react-hook-form";

import { Input } from "src/components/Form/Manual";

import type { ControlledInputProps } from "@/components/Form/types";

export const EmailInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>(props: ControlledInputProps<TFieldValues, TName>) => {
  const {
    field,
    type = "email",
    inputMode = "email",
    autoComplete,
    ...rest
  } = props;
  const { value, ...fieldRest } = field;

  const inputValue =
    "value" in rest && rest.value !== undefined ? rest.value : value ?? "";

  return (
    <Input
      {...fieldRest}
      {...rest}
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete ?? "email"}
      value={inputValue as string}
    />
  );
};
