// src/components/Form/types.ts

import {
  type FieldValues,
  type ControllerRenderProps,
  type Path,
  type FieldPath,
} from "react-hook-form";
import { type InputHTMLAttributes, type ReactNode } from "react";

/**
 * Select や Radio などの選択肢で共有する値の型。
 * メニュー／フォーム問わず共通で利用できるリテラル型を意図している。
 */
export type OptionValue = string | number | boolean;

/**
 * 選択肢の表示ラベルと値。複数の UI コンポーネントで共有する構造。
 */
export type Options = {
  label: ReactNode;
  value: OptionValue;
  /** タグ等で色付き表示する場合のカラーキー */
  color?: string;
};

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
} & InputHTMLAttributes<HTMLInputElement>;

/**
 * Controlled な textarea コンポーネント用の field 型。
 */
export type ControlledTextareaProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = {
  field: ControllerRenderProps<TFieldValues, TName>;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;
