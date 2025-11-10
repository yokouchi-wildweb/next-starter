// src/components/Form/Textarea.tsx

import { Textarea as ShadcnTextarea } from "@/components/Shadcn/textarea";
import { FieldPath, FieldValues } from "react-hook-form";
import { ControlledTextareaProps } from "@/types/form";

export const Textarea = <TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: ControlledTextareaProps<TFieldValues, TName>,
) => {
  const { field, ...rest } = props;
  return <ShadcnTextarea {...field} {...rest} />;
};
