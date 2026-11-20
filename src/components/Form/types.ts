// src/components/Form/types.ts

import type { InputSize } from "@/lib/variantOverrides";
import {
  type FieldValues,
  type ControllerRenderProps,
  type Path,
  type FieldPath,
} from "react-hook-form";
import { type InputHTMLAttributes } from "react";

import { type Options } from "@/components/Input/options";

/**
 * FormField コンポーネントで扱う基本的なフィールドタイプの集合。
 */
export type FieldType =
  | "text"
  | "date"
  | "time"
  | "textarea"
  | "radio"
  | "checkbox"
  | "select"
  | "multi-select"
  | "switch";

/**
 * FormField を利用する際の共通 Props。
 * 各フィールドが受け取る `options` は Options の配列を期待する。
 */
export type FormFieldProps<T extends FieldValues> = React.HTMLProps<HTMLElement> & {
  type: FieldType;
  name: Path<T>;
  label: string;
  options?: Options[];
};

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
