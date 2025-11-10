// src/components/Form/FormFieldItem.tsx

import { ReactNode } from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/Shadcn/form";
import { Para, type ParaProps } from "@/components/TextBlocks/Para";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  type ControllerRenderProps,
} from "react-hook-form";

export type FormFieldItemDescription = {
  text: ReactNode;
  tone?: ParaProps["tone"];
  size?: ParaProps["size"];
  placement?: "before" | "after";
};

export type FormFieldItemProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues, any, TFieldValues>;
  name: TName;
  label: ReactNode;
  renderInput: (field: ControllerRenderProps<TFieldValues, TName>) => ReactNode;
  description?: FormFieldItemDescription;
};

export function FormFieldItem<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  renderInput,
  description,
}: FormFieldItemProps<TFieldValues, TName>) {
  const descriptionPlacement = description?.placement ?? "after";
  const shouldRenderDescriptionBeforeControl = descriptionPlacement === "before";

  const descriptionContent = description ? (
    <Para tone={description.tone} size={description.size}>
      {description.text}
    </Para>
  ) : null;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {shouldRenderDescriptionBeforeControl && descriptionContent}
          <FormControl>{renderInput(field)}</FormControl>
          {!shouldRenderDescriptionBeforeControl && descriptionContent}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
