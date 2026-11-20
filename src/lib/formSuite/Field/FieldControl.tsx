// src/lib/formSuite/Field/FieldControl.tsx
// formSuite の Field 内部用。FormItem の中で使う(useFormField が FormItem の id を参照する)

"use client";

import type { ComponentProps } from "react";

import { Slot } from "@/components/Primitives/Slot";
import { useFormField } from "./fieldContext";
import { Para } from "@/components/TextBlocks/Para";

type FieldControlProps = ComponentProps<typeof Slot.Root> & {
  /** 説明文(FieldDescription)を描画しているか */
  hasDescription?: boolean;
  /** エラーメッセージ(FormMessage)を描画しているか。hideError のときは false */
  hasMessage?: boolean;
};

/**
 * 入力の部品に項目の id・aria-invalid と、実際に描画している説明文・エラーだけを指す aria-describedby を付ける。
 * 描いていない説明文の ID を指すと存在しない ID の参照(a11y 違反)になるので、hasDescription / hasMessage で絞る
 */
export function FieldControl({ hasDescription = false, hasMessage = true, ...props }: FieldControlProps) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  const hasErrorMessage = hasMessage && Boolean(error?.message);
  const describedBy =
    [hasDescription && formDescriptionId, hasErrorMessage && formMessageId].filter(Boolean).join(" ") || undefined;

  // aria-describedby は渡された値より上の絞った値が勝つ(id・aria-invalid は呼び手が上書きできる)
  return (
    <Slot.Root
      data-slot="form-control"
      id={formItemId}
      aria-invalid={!!error}
      {...props}
      {...{ "aria-describedby": describedBy }}
    />
  );
}

/** 入力と結び付く説明文(FieldControl の hasDescription と組で使う) */
export function FieldDescription(props: ComponentProps<typeof Para>) {
  const { formDescriptionId } = useFormField();
  return <Para {...props} id={formDescriptionId} />;
}
