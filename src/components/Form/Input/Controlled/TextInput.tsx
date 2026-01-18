// src/components/Form/TextInput.tsx

import { Input } from "@/components/Form/Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { type ReactNode } from "react";
import { ControlledInputProps } from "@/components/Form/types";

type TextInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = ControlledInputProps<TFieldValues, TName> & {
  /** 左側に表示するアイコン */
  leftIcon?: ReactNode;
};

export const TextInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: TextInputProps<TFieldValues, TName>,
) => {
  const { field, leftIcon, ...rest } = props;
  const { value, ...fieldRest } = field;
  const inputValue =
    "value" in rest && rest.value !== undefined ? (rest as any).value : value ?? "";
  return <Input {...fieldRest} {...rest} value={inputValue} leftIcon={leftIcon} />;
};
