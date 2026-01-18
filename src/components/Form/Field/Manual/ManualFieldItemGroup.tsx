// src/components/Form/Field/ManualFieldItemGroup.tsx

"use client";

import { ReactNode, useId } from "react";
import { Label } from "@/components/Form/Label";
import { Para } from "@/components/TextBlocks/Para";
import { cn } from "@/lib/cn";
import type { FieldItemDescription, RequiredMarkOptions } from "../types";

/** @deprecated FieldItemDescription を使用してください */
export type ManualFieldItemGroupDescription = FieldItemDescription;

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
  /** フィールド間のギャップ（Tailwindクラス、デフォルト: "gap-2"） */
  gap?: string;
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
  required = false,
  requiredMark,
  requiredMarkPosition = "after",
  gap = "gap-2",
}: ManualFieldItemGroupProps) {
  const id = useId();
  const descPlacement = description?.placement ?? "after";
  const defaultMark = requiredMarkPosition === "before" ? DefaultRequiredMarkBefore : DefaultRequiredMarkAfter;
  const resolvedRequiredMark = required ? (requiredMark ?? defaultMark) : null;

  // エラーがあるかどうか
  const hasErrors = errors && errors.length > 0;
  // 重複を除いたエラーメッセージ
  const uniqueErrors = errors ? [...new Set(errors.filter(Boolean))] : [];

  return (
    <div data-slot="form-item" className={cn("grid gap-2", className)}>
      {/* ラベル - FormLabel と同じスタイル */}
      {label && (
        <Label
          data-slot="form-label"
          data-error={hasErrors}
          className={cn(hasErrors && "text-destructive")}
          htmlFor={`${id}-field-group`}
        >
          {requiredMarkPosition === "before" && resolvedRequiredMark}
          {label}
          {requiredMarkPosition === "after" && resolvedRequiredMark}
        </Label>
      )}

      {/* 説明（before） */}
      {descPlacement === "before" && description && (
        <Para tone={description.tone} size={description.size} className="mb-0">
          {description.text}
        </Para>
      )}

      {/* 横並びの入力フィールド群 */}
      <div
        id={`${id}-field-group`}
        className={cn("flex", gap)}
        role="group"
        aria-labelledby={`${id}-label`}
      >
        {children.map((child, index) => {
          const widthClass = fieldWidths?.[index] ?? "flex-1";
          return (
            <div key={index} className={cn(widthClass, "min-w-0")}>
              {child}
            </div>
          );
        })}
      </div>

      {/* 説明（after） */}
      {descPlacement === "after" && description && (
        <Para tone={description.tone} size={description.size} className="mt-0">
          {description.text}
        </Para>
      )}

      {/* エラーメッセージ - FormMessage と同じスタイル */}
      {uniqueErrors.length > 0 && (
        <div data-slot="form-message" className="text-destructive text-sm">
          {uniqueErrors.map((error, index) => (
            <p key={index}>{error}</p>
          ))}
        </div>
      )}
    </div>
  );
}
