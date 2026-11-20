// src/lib/formSuite/types.ts

import type { InputSize } from "@/lib/variantOverrides";
import {
  type FieldValues,
  type ControllerRenderProps,
  type FieldPath,
} from "react-hook-form";
import { type InputHTMLAttributes } from "react";

/**
 * Controlled な input コンポーネントで React Hook Form の field を渡す際の型。
 */
export type ControlledInputProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  /** 高さの段(ボタンの size と同じ名前・同じ高さ、Manual の Input へ渡す)@default "md" */
  size?: InputSize;
  /** HTML の size 属性(表示する文字数の目安) */
  htmlSize?: number;
};

/**
 * Controlled な textarea コンポーネント用の field 型。
 */
export type ControlledTextareaProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;
