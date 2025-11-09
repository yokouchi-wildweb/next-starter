// src/components/Form/FormFieldItem.tsx

import { ReactNode } from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/Shadcn/form";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  type ControllerRenderProps,
} from "react-hook-form";

export type FormFieldItemProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues, any, TFieldValues>;
  name: TName;
  label: ReactNode;
  renderInput: (field: ControllerRenderProps<TFieldValues, TName>) => ReactNode;
};

export function FormFieldItem<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({ control, name, label, renderInput }: FormFieldItemProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>{renderInput(field)}</FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
