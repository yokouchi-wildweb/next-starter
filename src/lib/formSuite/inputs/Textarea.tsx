// src/lib/formSuite/inputs/Textarea.tsx

import { Textarea as ManualTextarea } from "@/components/Input/Textarea";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledTextareaProps } from "../types";

export const ControlledTextarea = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: ControlledTextareaProps<TFieldValues, TName>,
) => {
  const { field, ...rest } = props;
  const { value, ...fieldRest } = field;
  return <ManualTextarea {...fieldRest} {...rest} value={value ?? ""} />;
};
