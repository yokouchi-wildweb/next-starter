// src/components/Form/Field/FieldItem.tsx

import { ReactNode } from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/_shadcn/form";
import { Para } from "@/components/TextBlocks/Para";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  type ControllerRenderProps,
} from "react-hook-form";
import type { FieldCommonProps } from "../types";

export type FieldItemProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = FieldCommonProps & {
  control: Control<TFieldValues, any, TFieldValues>;
  name: TName;
  /** ラベル（省略可能） */
  label?: ReactNode;
  renderInput: (field: ControllerRenderProps<TFieldValues, TName>) => ReactNode;
};

/** デフォルトの必須マーク（位置に応じてマージン方向を変える） */
const DefaultRequiredMarkAfter = (
  <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
);
const DefaultRequiredMarkBefore = (
  <span className="text-destructive mr-0.5" aria-hidden="true">*</span>
);

export function FieldItem<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  renderInput,
  description,
  className,
  hideLabel = false,
  hideError = false,
  required = false,
  requiredMark,
  requiredMarkPosition = "after",
}: FieldItemProps<TFieldValues, TName>) {

  const descPlacement = description?.placement ?? "after";
  const defaultMark = requiredMarkPosition === "before" ? DefaultRequiredMarkBefore : DefaultRequiredMarkAfter;
  const resolvedRequiredMark = required ? (requiredMark ?? defaultMark) : null;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel className={hideLabel ? "sr-only" : undefined}>
              {requiredMarkPosition === "before" && resolvedRequiredMark}
              {label}
              {requiredMarkPosition === "after" && resolvedRequiredMark}
            </FormLabel>
          )}

          { descPlacement === 'before' && description &&
              <Para tone={description.tone} size={description.size} className='mb-0'>
                {description.text}
              </Para>
          }

          <FormControl>{renderInput(field)}</FormControl>

          { descPlacement === 'after' && description &&
              <Para tone={description.tone} size={description.size} className='mt-0'>
                {description.text}
              </Para>
          }

          {!hideError && <FormMessage />}
        </FormItem>
      )}
    />
  );
}
