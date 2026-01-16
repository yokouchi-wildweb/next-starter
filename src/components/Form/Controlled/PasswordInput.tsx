import { PasswordInput as ManualPasswordInput } from "@/components/Form/Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { type ReactNode } from "react";
import { ControlledInputProps } from "@/components/Form/types";

type PasswordInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = ControlledInputProps<TFieldValues, TName> & {
  /** 左側に表示するアイコン */
  leftIcon?: ReactNode;
};

export const PasswordInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: PasswordInputProps<TFieldValues, TName>,
) => {
  const { field, leftIcon, ...rest } = props;
  return <ManualPasswordInput {...field} {...rest} leftIcon={leftIcon} />;
};
