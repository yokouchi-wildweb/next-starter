// src/components/Form/Field/Manual/ManualFieldController.tsx

"use client";

import { ReactNode } from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  type ControllerRenderProps,
  useController,
} from "react-hook-form";

export type ManualFieldControllerProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues, any, TFieldValues>;
  name: TName;
  /** field を受け取って入力コンポーネントをレンダリングする関数 */
  children: (field: ControllerRenderProps<TFieldValues, TName>) => ReactNode;
};

/**
 * react-hook-form の field を取得して渡すだけの薄いラッパー
 * ラベルやエラー表示が不要で、自由なレイアウトを組みたい場合に使用
 *
 * @example
 * ```tsx
 * <ManualFieldController control={control} name="notify">
 *   {(field) => (
 *     <div className="自由なレイアウト">
 *       <SwitchInput field={field} label="通知設定" />
 *       <span>補足テキスト</span>
 *     </div>
 *   )}
 * </ManualFieldController>
 * ```
 */
export function ManualFieldController<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  name,
  children,
}: ManualFieldControllerProps<TFieldValues, TName>) {
  const { field } = useController({ control, name });

  return <>{children(field)}</>;
}
