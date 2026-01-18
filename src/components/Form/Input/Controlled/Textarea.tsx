// src/components/Form/Controlled/Textarea.tsx

import { Textarea as ManualTextarea } from "@/components/Form/Input/Manual/Textarea";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledTextareaProps } from "@/components/Form/types";

export const Textarea = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: ControlledTextareaProps<TFieldValues, TName>,
) => {
  const { field, ...rest } = props;
  return <ManualTextarea {...field} {...rest} />;
};
