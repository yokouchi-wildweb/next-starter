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
import { cn } from "@/lib/cn";
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
  /** 入力コンポーネントをレンダリングする関数 */
  renderInput: (field: ControllerRenderProps<TFieldValues, TName>, inputClassName?: string) => ReactNode;
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
  inputClassName,
  hideLabel = false,
  hideError = false,
  required = false,
  requiredMark,
  requiredMarkPosition = "after",
  layout = "vertical",
  labelClass,
}: FieldItemProps<TFieldValues, TName>) {

  const descPlacement = description?.placement ?? "after";
  const defaultMark = requiredMarkPosition === "before" ? DefaultRequiredMarkBefore : DefaultRequiredMarkAfter;
  const resolvedRequiredMark = required ? (requiredMark ?? defaultMark) : null;

  const isHorizontal = layout === "horizontal";

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        // ラベル要素
        const labelElement = label && (
          <FormLabel
            className={cn(
              hideLabel && "sr-only",
              isHorizontal && "pt-2 shrink-0", // 横並び時、入力フィールドと上端を揃える
              labelClass
            )}
          >
            {requiredMarkPosition === "before" && resolvedRequiredMark}
            {label}
            {requiredMarkPosition === "after" && resolvedRequiredMark}
          </FormLabel>
        );

        // 説明テキスト（before）
        const descBefore = descPlacement === "before" && description && (
          <Para tone={description.tone} size={description.size} className="mb-0">
            {description.text}
          </Para>
        );

        // 説明テキスト（after）
        const descAfter = descPlacement === "after" && description && (
          <Para tone={description.tone} size={description.size} className="mt-0">
            {description.text}
          </Para>
        );

        // エラーメッセージ
        const errorElement = !hideError && <FormMessage />;

        // 入力コンポーネント
        const inputElement = <FormControl>{renderInput(field, inputClassName)}</FormControl>;

        // 横並びレイアウト
        if (isHorizontal) {
          return (
            <FormItem className={cn("flex items-start gap-4 [&>*]:!mt-0", className)}>
              {labelElement}
              <div className="flex-1 grid gap-2">
                {descBefore}
                {inputElement}
                {descAfter}
                {errorElement}
              </div>
            </FormItem>
          );
        }

        // 縦並びレイアウト（デフォルト）
        return (
          <FormItem className={className}>
            {labelElement}
            {descBefore}
            {inputElement}
            {descAfter}
            {errorElement}
          </FormItem>
        );
      }}
    />
  );
}
