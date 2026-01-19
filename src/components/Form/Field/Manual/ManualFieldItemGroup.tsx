// src/components/Form/Field/ManualFieldItemGroup.tsx

"use client";

import { ReactNode, useId } from "react";
import { Label } from "@/components/Form/Label";
import { Para } from "@/components/TextBlocks/Para";
import { cn } from "@/lib/cn";
import type { FieldItemDescription, RequiredMarkOptions } from "../types";

/** @deprecated FieldItemDescription を使用してください */
export type ManualFieldItemGroupDescription = FieldItemDescription;

/**
 * 各インプットの設定
 */
export type InputConfig = {
  /** インプットの前に表示する要素 */
  prefix?: ReactNode;
  /** インプットの後に表示する要素 */
  suffix?: ReactNode;
};

export type ManualFieldItemGroupProps = RequiredMarkOptions & {
  /** グループラベル */
  label?: ReactNode;
  /** 横並びで表示する入力要素 */
  children: ReactNode[];
  /** 各フィールドの幅（Tailwindクラス）、省略時は均等（flex-1） */
  fieldWidths?: string[];
  /** エラーメッセージの配列 */
  errors?: string[];
  /** 説明テキスト */
  description?: FieldItemDescription;
  /** グループ全体のクラス名 */
  className?: string;
  /** ラベルを視覚的に非表示にする */
  hideLabel?: boolean;
  /** エラーメッセージを非表示にする */
  hideError?: boolean;
  /** フィールド間のギャップ（Tailwindクラス、デフォルト: "gap-2"） */
  gap?: string;
  /** レイアウト方向（デフォルト: "vertical"） */
  layout?: "vertical" | "horizontal";
  /** ラベルに適用するクラス名（例: "w-[120px]", "text-lg font-bold"） */
  labelClass?: string;
  /** インプット同士の配置（未指定時: layout="vertical"→横並び, layout="horizontal"→縦並び） */
  inputLayout?: "vertical" | "horizontal";
  /** 各インプットの設定（prefix/suffix） */
  inputConfigs?: InputConfig[];
};

/** デフォルトの必須マーク（位置に応じてマージン方向を変える） */
const DefaultRequiredMarkAfter = (
  <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
);
const DefaultRequiredMarkBefore = (
  <span className="text-destructive mr-0.5" aria-hidden="true">*</span>
);

/**
 * フィールドアイテムグループ（低レベルコンポーネント）
 * 複数フィールドを横並びで表示し、1つのフィールドのように見せる
 * ManualFieldItem と同じ UI 構造を維持
 *
 * @example
 * ```tsx
 * <ManualFieldItemGroup
 *   label="生年月日"
 *   required
 *   errors={[errors.birth_year?.message, errors.birth_month?.message].filter(Boolean)}
 * >
 *   {[
 *     <Select key="year" value={year} onChange={setYear} options={yearOptions} />,
 *     <Select key="month" value={month} onChange={setMonth} options={monthOptions} />,
 *   ]}
 * </ManualFieldItemGroup>
 * ```
 */
export function ManualFieldItemGroup({
  label,
  children,
  fieldWidths,
  errors,
  description,
  className,
  hideLabel = false,
  hideError = false,
  required = false,
  requiredMark,
  requiredMarkPosition = "after",
  gap = "gap-2",
  layout = "vertical",
  labelClass,
  inputLayout,
  inputConfigs,
}: ManualFieldItemGroupProps) {
  const id = useId();
  const descPlacement = description?.placement ?? "after";
  const defaultMark = requiredMarkPosition === "before" ? DefaultRequiredMarkBefore : DefaultRequiredMarkAfter;
  const resolvedRequiredMark = required ? (requiredMark ?? defaultMark) : null;

  // エラーがあるかどうか
  const hasErrors = errors && errors.length > 0;
  // 重複を除いたエラーメッセージ
  const uniqueErrors = errors ? [...new Set(errors.filter(Boolean))] : [];

  const isHorizontal = layout === "horizontal";
  // inputLayout未指定時のデフォルト: layout="vertical"→横並び, layout="horizontal"→縦並び
  const resolvedInputLayout = inputLayout ?? (isHorizontal ? "vertical" : "horizontal");
  const isInputsHorizontal = resolvedInputLayout === "horizontal";

  // ラベル要素
  const labelElement = label && (
    <Label
      data-slot="form-label"
      data-error={hasErrors}
      className={cn(
        hideLabel && "sr-only",
        hasErrors && "text-destructive",
        isHorizontal && "pt-2 shrink-0", // 横並び時、入力フィールドと上端を揃える
        labelClass
      )}
      htmlFor={`${id}-field-group`}
    >
      {requiredMarkPosition === "before" && resolvedRequiredMark}
      {label}
      {requiredMarkPosition === "after" && resolvedRequiredMark}
    </Label>
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
  const errorElement = !hideError && uniqueErrors.length > 0 && (
    <div data-slot="form-message" className="text-destructive text-sm">
      {uniqueErrors.map((error, index) => (
        <p key={index}>{error}</p>
      ))}
    </div>
  );

  // インプット群の要素
  const inputsElement = (
    <div
      id={`${id}-field-group`}
      className={cn(
        "flex min-w-0",
        isInputsHorizontal ? "items-center" : "flex-col",
        gap
      )}
      role="group"
      aria-labelledby={`${id}-label`}
    >
      {children.map((child, index) => {
        // 横並び時は fieldWidths または flex-1、縦並び時は w-full
        const widthClass = isInputsHorizontal ? (fieldWidths?.[index] ?? "flex-1") : "w-full";
        const config = inputConfigs?.[index];
        const prefix = config?.prefix;
        const suffix = config?.suffix;
        const hasAdornments = prefix || suffix;

        return (
          <div key={index} className={cn(widthClass, "min-w-0", hasAdornments && "flex items-center gap-2")}>
            {prefix && (
              <span className="text-sm shrink-0">{prefix}</span>
            )}
            <div className={hasAdornments ? "flex-1 min-w-0" : undefined}>
              {child}
            </div>
            {suffix && (
              <span className="text-sm shrink-0">{suffix}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  // ラベル横並びレイアウト
  if (isHorizontal) {
    return (
      <div data-slot="form-item" className={cn("flex items-start gap-4", className)}>
        {labelElement}
        <div className="flex-1 grid gap-2">
          {descBefore}
          {inputsElement}
          {descAfter}
          {errorElement}
        </div>
      </div>
    );
  }

  // ラベル縦並びレイアウト（デフォルト）
  return (
    <div data-slot="form-item" className={cn("grid gap-2", className)}>
      {labelElement}
      {descBefore}
      {inputsElement}
      {descAfter}
      {errorElement}
    </div>
  );
}
