// src/components/Form/FormFieldItem.tsx

import { ReactNode } from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/_shadcn/form";
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
  /** ラベル（省略可能） */
  label?: ReactNode;
  renderInput: (field: ControllerRenderProps<TFieldValues, TName>) => ReactNode;
  description?: FormFieldItemDescription;
  /** FormItem全体に適用するクラス名 */
  className?: string;
  /** ラベルを視覚的に非表示にする（スクリーンリーダー用に残す） */
  hideLabel?: boolean;
  /** エラーメッセージを非表示にする */
  hideError?: boolean;
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
  className,
  hideLabel = false,
  hideError = false,
}: FormFieldItemProps<TFieldValues, TName>) {

  const descPlacement = description?.placement ?? "after";

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel className={hideLabel ? "sr-only" : undefined}>
              {label}
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
