import { PasswordInput as ManualPasswordInput } from "../Manual";
import type { PasswordAutoComplete } from "../Manual/PasswordInput";
import { FieldPath, FieldValues } from "react-hook-form";
import { type ReactNode } from "react";
import { ControlledInputProps } from "@/components/Form/types";

type PasswordInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = Omit<ControlledInputProps<TFieldValues, TName>, "autoComplete"> & {
  /** 左側に表示するアイコン */
  leftIcon?: ReactNode;
  /** 欄の役割(必須)。Manual/PasswordInput の PasswordAutoComplete を参照 */
  autoComplete: PasswordAutoComplete;
};

export const PasswordInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: PasswordInputProps<TFieldValues, TName>,
) => {
  const { field, leftIcon, ...rest } = props;
  const { value, ...fieldRest } = field;
  return <ManualPasswordInput {...fieldRest} {...rest} value={value ?? ""} leftIcon={leftIcon} />;
};
