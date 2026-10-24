// src/components/Form/Field/FieldControl.tsx
// Form/Field 内部用。FormItem の中で使う(useFormField が FormItem の id を参照する)

import type { ComponentProps } from "react";

import { FormControl, useFormField } from "@/components/_shadcn/form";
import { Para } from "@/components/TextBlocks/Para";

type FieldControlProps = ComponentProps<typeof FormControl> & {
  /** 説明文(FieldDescription)を描画しているか */
  hasDescription?: boolean;
  /** エラーメッセージ(FormMessage)を描画しているか。hideError のときは false */
  hasMessage?: boolean;
};

/**
 * FormControl の aria-describedby を、実際に描画している説明文・エラーだけに絞って付ける。
 * _shadcn の FormControl は説明文の有無に関わらず説明文の ID を指すため、
 * 存在しない ID の参照(a11y 違反)になっていた
 */
export function FieldControl({ hasDescription = false, hasMessage = true, ...props }: FieldControlProps) {
  const { error, formDescriptionId, formMessageId } = useFormField();
  const hasErrorMessage = hasMessage && Boolean(error?.message);
  const describedBy =
    [hasDescription && formDescriptionId, hasErrorMessage && formMessageId].filter(Boolean).join(" ") || undefined;

  return <FormControl {...props} aria-describedby={describedBy} />;
}

/** 入力と結び付く説明文(FieldControl の hasDescription と組で使う) */
export function FieldDescription(props: ComponentProps<typeof Para>) {
  const { formDescriptionId } = useFormField();
  return <Para {...props} id={formDescriptionId} />;
}
