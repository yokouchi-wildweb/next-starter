import { PasswordInput as ManualPasswordInput } from "@/components/Form/Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/components/Form/types";

export const PasswordInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: ControlledInputProps<TFieldValues, TName>,
) => {
  const { field, ...rest } = props;
  return <ManualPasswordInput {...field} {...rest} />;
};
