// src/components/Form/Field/FieldItemGroup.tsx

"use client";

import { ReactNode } from "react";
import {
  type Control,
  type FieldPath,
  type FieldValues,
  type ControllerRenderProps,
  useController,
  useFormState,
} from "react-hook-form";
import { ManualFieldItemGroup, type ManualFieldItemGroupDescription } from "../Manual";

export type FieldItemGroupProps<
  TFieldValues extends FieldValues,
  TNames extends readonly FieldPath<TFieldValues>[]
> = {
  control: Control<TFieldValues, any, TFieldValues>;
  /** フィールド名の配列（順序通りに横並び表示） */
  names: TNames;
  /** グループラベル */
  label?: ReactNode;
  /** 入力コンポーネントをレンダリングする関数 */
  renderInputs: (
    fields: { [K in keyof TNames]: ControllerRenderProps<TFieldValues, TNames[K]> }
  ) => ReactNode[];
  /** 説明テキスト */
  description?: ManualFieldItemGroupDescription;
  /** 各フィールドの幅（Tailwindクラス）、省略時は均等 */
  fieldWidths?: string[];
  /** グループ全体のクラス名 */
  className?: string;
  /** フィールドが必須かどうか */
  required?: boolean;
  /** カスタム必須マーク */
  requiredMark?: ReactNode;
  /** 必須マークの位置（デフォルト: "after"） */
  requiredMarkPosition?: "before" | "after";
  /** フィールド間のギャップ（Tailwindクラス、デフォルト: "gap-2"） */
  gap?: string;
};

/**
 * FieldItem のグループ版（高レベルコンポーネント）
 * 複数フィールドを横並びで表示し、エラーメッセージを自動収集する
 *
 * @example
 * ```tsx
 * <FieldItemGroup
 *   control={form.control}
 *   names={["birth_year", "birth_month", "birth_day"] as const}
 *   label="生年月日"
 *   required
 *   renderInputs={(fields) => [
 *     <SelectInput key="year" field={fields[0]} options={yearOptions} />,
 *     <SelectInput key="month" field={fields[1]} options={monthOptions} />,
 *     <SelectInput key="day" field={fields[2]} options={dayOptions} />,
 *   ]}
 * />
 * ```
 */
export function FieldItemGroup<
  TFieldValues extends FieldValues,
  TNames extends readonly FieldPath<TFieldValues>[]
>({
  control,
  names,
  label,
  renderInputs,
  description,
  fieldWidths,
  className,
  required = false,
  requiredMark,
  requiredMarkPosition = "after",
  gap,
}: FieldItemGroupProps<TFieldValues, TNames>) {
  // 各フィールドの controller を取得
  const controllers = names.map((name) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useController({ control, name })
  );

  // フォームの状態を監視（エラー更新のため）
  const { errors } = useFormState({ control, name: names as unknown as FieldPath<TFieldValues>[] });

  // 各フィールドの field を配列として取得
  const fields = controllers.map((c) => c.field) as {
    [K in keyof TNames]: ControllerRenderProps<TFieldValues, TNames[K]>;
  };

  // 各フィールドのエラーメッセージを収集
  const errorMessages: string[] = [];
  names.forEach((name) => {
    const error = errors[name as keyof typeof errors];
    if (error && typeof error === "object" && "message" in error && error.message) {
      errorMessages.push(String(error.message));
    }
  });

  // 入力コンポーネントをレンダリング
  const inputElements = renderInputs(fields);

  return (
    <ManualFieldItemGroup
      label={label}
      fieldWidths={fieldWidths}
      errors={errorMessages}
      description={description}
      className={className}
      required={required}
      requiredMark={requiredMark}
      requiredMarkPosition={requiredMarkPosition}
      gap={gap}
    >
      {inputElements}
    </ManualFieldItemGroup>
  );
}
