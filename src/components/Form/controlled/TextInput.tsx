// src/components/Form/TextInput.tsx

import { Input } from "src/components/Form/Manual";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledInputProps } from "@/types/form";

export const TextInput = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: ControlledInputProps<TFieldValues, TName>,
) => {
  const { field, ...rest } = props;
  const { value, ...fieldRest } = field;
  const inputValue =
    "value" in rest && rest.value !== undefined ? (rest as any).value : value ?? "";
  return <Input {...fieldRest} {...rest} value={inputValue} />;
};
