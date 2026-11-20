// src/lib/formSuite/inputs/EmailInput.tsx

import { FieldPath, FieldValues } from "react-hook-form";
import { type ReactNode } from "react";

import { Input } from "@/components/Input/Input";

import type { ControlledInputProps } from "../types";

type EmailInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = ControlledInputProps<TFieldValues, TName> & {
  /** 左側に表示するアイコン */
  leftIcon?: ReactNode;
};

export const ControlledEmailInput = <
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>(props: EmailInputProps<TFieldValues, TName>) => {
  const {
    field,
    type = "email",
    inputMode = "email",
    autoComplete,
    leftIcon,
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
      leftIcon={leftIcon}
    />
  );
};
