// src/components/Form/Field/ManualFieldItem.tsx

"use client";

import { ReactNode, useId } from "react";
import { Label } from "@/components/Form/Label";
import { Para, type ParaProps } from "@/components/TextBlocks/Para";
import { cn } from "@/lib/cn";

export type ManualFieldItemDescription = {
  text: ReactNode;
  tone?: ParaProps["tone"];
  size?: ParaProps["size"];
  placement?: "before" | "after";
};

export type ManualFieldItemProps = {
  /** フィールドラベル */
  label?: ReactNode;
  /** 入力コンポーネント */
  children: ReactNode;
  /** エラーメッセージ */
  error?: string;
  /** 説明テキスト */
  description?: ManualFieldItemDescription;
  /** フィールド全体のクラス名 */
  className?: string;
  /** ラベルを視覚的に非表示にする（スクリーンリーダー用に残す） */
  hideLabel?: boolean;
  /** エラーメッセージを非表示にする */
  hideError?: boolean;
  /** フィールドが必須かどうか */
  required?: boolean;
  /** カスタム必須マーク（省略時はデフォルトの赤い * を表示） */
  requiredMark?: ReactNode;
  /** 必須マークの位置（デフォルト: "after"） */
  requiredMarkPosition?: "before" | "after";
  /** レイアウト方向（デフォルト: "vertical"） */
  layout?: "vertical" | "horizontal";
  /** ラベルに適用するクラス名（例: "w-[120px]", "text-lg font-bold"） */
  labelClass?: string;
};

/** デフォルトの必須マーク（位置に応じてマージン方向を変える） */
const DefaultRequiredMarkAfter = (
  <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
);
const DefaultRequiredMarkBefore = (
  <span className="text-destructive mr-0.5" aria-hidden="true">*</span>
);

/**
 * フィールドアイテム（低レベルコンポーネント）
 * 単一フィールドのラベル・入力・エラー表示を提供
 * FieldItem の低レベル版（手動でエラーを渡す）
 *
 * @example
 * ```tsx
 * <ManualFieldItem
 *   label="メールアドレス"
 *   error={errors.email?.message}
 *   required
 * >
 *   <Input value={email} onChange={(e) => setEmail(e.target.value)} />
 * </ManualFieldItem>
 * ```
 */
export function ManualFieldItem({
  label,
  children,
  error,
  description,
  className,
  hideLabel = false,
  hideError = false,
  required = false,
  requiredMark,
  requiredMarkPosition = "after",
  layout = "vertical",
  labelClass,
}: ManualFieldItemProps) {
  const id = useId();
  const descPlacement = description?.placement ?? "after";
  const defaultMark = requiredMarkPosition === "before" ? DefaultRequiredMarkBefore : DefaultRequiredMarkAfter;
  const resolvedRequiredMark = required ? (requiredMark ?? defaultMark) : null;

  // エラーがあるかどうか
  const hasError = Boolean(error);

  const isHorizontal = layout === "horizontal";

  // ラベル要素
  const labelElement = label && (
    <Label
      data-slot="form-label"
      data-error={hasError}
      className={cn(
        hideLabel && "sr-only",
        hasError && "text-destructive",
        isHorizontal && "pt-2 shrink-0", // 横並び時、入力フィールドと上端を揃える
        labelClass
      )}
      htmlFor={`${id}-field`}
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
  const errorElement = !hideError && hasError && (
    <p data-slot="form-message" className="text-destructive text-sm">
      {error}
    </p>
  );

  // 入力コンポーネント
  const inputElement = (
    <div id={`${id}-field`}>
      {children}
    </div>
  );

  // 横並びレイアウト
  if (isHorizontal) {
    return (
      <div data-slot="form-item" className={cn("flex items-start gap-4", className)}>
        {labelElement}
        <div className="flex-1 grid gap-2">
          {descBefore}
          {inputElement}
          {descAfter}
          {errorElement}
        </div>
      </div>
    );
  }

  // 縦並びレイアウト（デフォルト）
  return (
    <div data-slot="form-item" className={cn("grid gap-2", className)}>
      {labelElement}
      {descBefore}
      {inputElement}
      {descAfter}
      {errorElement}
    </div>
  );
}
