// src/components/Form/Field/FieldItem.tsx

import { ReactNode, useCallback } from "react";
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
import { useAutoSaveContext } from "@/components/Form/AutoSave";

/**
 * 自動保存時のblurモード
 * - immediate: blur時に即座に保存
 * - debounce: blur時にデバウンスして保存
 * - none: blurでは保存しない（独自のオートセーブ処理を持つフィールド用）
 */
export type BlurMode = "immediate" | "debounce" | "none";

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
  /** 自動保存時のblurモード（immediate: 即時保存、debounce: デバウンスして保存）。デフォルト: debounce */
  blurMode?: BlurMode;
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
  blurMode = "debounce",
}: FieldItemProps<TFieldValues, TName>) {
  // 自動保存コンテキスト（nullの場合は従来型モード）
  const autoSaveContext = useAutoSaveContext<TFieldValues>();

  const descPlacement = description?.placement ?? "after";
  const defaultMark = requiredMarkPosition === "before" ? DefaultRequiredMarkBefore : DefaultRequiredMarkAfter;
  const resolvedRequiredMark = required ? (requiredMark ?? defaultMark) : null;

  const isHorizontal = layout === "horizontal";
  const isResponsiveLayout = layout === "responsive";

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        // 自動保存が有効な場合、onBlurをラップしてAutoSaveの処理を追加
        // blurMode="none"の場合は独自のオートセーブ処理を持つためスキップ
        console.log(`[FieldItem:render] name=${String(name)}, autoSaveEnabled=${autoSaveContext?.enabled}, blurMode=${blurMode}`);

        const wrappedField = autoSaveContext?.enabled && blurMode !== "none"
          ? {
              ...field,
              onBlur: () => {
                console.log(`[FieldItem:wrappedOnBlur] name=${String(name)} 呼び出し開始`);
                field.onBlur();
                console.log(`[FieldItem:wrappedOnBlur] field.onBlur() 完了、autoSaveContext.onFieldBlur を呼び出し...`);
                autoSaveContext.onFieldBlur(name, { immediate: blurMode === "immediate" });
                console.log(`[FieldItem:wrappedOnBlur] autoSaveContext.onFieldBlur 呼び出し完了`);
              },
            }
          : field;

        // ラベル要素
        const labelElement = label && (
          <FormLabel
            className={cn(
              hideLabel && "sr-only",
              isHorizontal && "pt-2 shrink-0", // 横並び時、入力フィールドと上端を揃える
              isResponsiveLayout && "md:pt-2 md:shrink-0", // レスポンシブ時、PC のみ横並びスタイル
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
        const inputElement = <FormControl>{renderInput(wrappedField, inputClassName)}</FormControl>;

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

        // レスポンシブレイアウト（スマホ: 縦、PC: 横）
        if (isResponsiveLayout) {
          return (
            <FormItem className={cn("flex flex-col gap-2 md:flex-row md:items-start md:gap-4 [&>*]:!mt-0", className)}>
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
