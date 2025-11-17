// src/types/form.ts

import { FieldValues, ControllerRenderProps, Path, FieldPath } from "react-hook-form";
import { ComponentProps, InputHTMLAttributes } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/Shadcn/radio-group";

export type Options = {
  label: string;
  value: string;
};

export type FieldType =
  | "text"
  | "date"
  | "time"
  | "textarea"
  | "radio"
  | "checkbox"
  | "select"
  | "switch";

export type FormFieldProps<T extends FieldValues> = React.HTMLProps<HTMLElement> & {
  type: FieldType;
  name: Path<T>;
  label: string;
  options?: Options[];
};

export type ControlledInputProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & InputHTMLAttributes<HTMLInputElement>;

export type ControlledTextareaProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;
