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
import { ManualFieldItemGroup, type InputConfig } from "../Manual";
import type { FieldItemDescription, RequiredMarkOptions } from "../types";

export type FieldItemGroupProps<
  TFieldValues extends FieldValues,
  TNames extends readonly FieldPath<TFieldValues>[]
> = RequiredMarkOptions & {
  control: Control<TFieldValues, any, TFieldValues>;
  /** フィールド名の配列（順序通りに横並び表示） */
  names: TNames;
  /** グループラベル */
  label?: ReactNode;
  /** 入力コンポーネントをレンダリングする関数 */
  renderInputs: (
    fields: { [K in keyof TNames]: ControllerRenderProps<TFieldValues, TNames[K]> },
    inputClassName?: string
  ) => ReactNode[];
  /** 説明テキスト */
  description?: FieldItemDescription;
  /** 各フィールドの幅（Tailwindクラス）、省略時は均等 */
  fieldWidths?: string[];
  /** グループ全体のクラス名 */
  className?: string;
  /** 内部のInputコンポーネントに適用するクラス名（全Inputに同じクラスを適用） */
  inputClassName?: string;
  /** ラベルを視覚的に非表示にする */
  hideLabel?: boolean;
  /** エラーメッセージを非表示にする */
  hideError?: boolean;
  /** フィールド間のギャップ（Tailwindクラス、デフォルト: "gap-2"） */
  gap?: string;
  /** レイアウト方向（デフォルト: "vertical"） */
  layout?: "vertical" | "horizontal" | "responsive";
  /** ラベルに適用するクラス名（例: "w-[120px]", "text-lg font-bold"） */
  labelClass?: string;
  /** インプット同士の配置（未指定時: layout="vertical"→横並び, layout="horizontal"→縦並び） */
  inputLayout?: "vertical" | "horizontal" | "responsive";
  /** 各インプットの設定（prefix/suffix） */
  inputConfigs?: InputConfig[];
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
  inputClassName,
  hideLabel = false,
  hideError = false,
  required = false,
  requiredMark,
  requiredMarkPosition = "after",
  gap,
  layout,
  labelClass,
  inputLayout,
  inputConfigs,
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
  const inputElements = renderInputs(fields, inputClassName);

  return (
    <ManualFieldItemGroup
      label={label}
      fieldWidths={fieldWidths}
      errors={errorMessages}
      description={description}
      className={className}
      hideLabel={hideLabel}
      hideError={hideError}
      required={required}
      requiredMark={requiredMark}
      requiredMarkPosition={requiredMarkPosition}
      gap={gap}
      layout={layout}
      labelClass={labelClass}
      inputLayout={inputLayout}
      inputConfigs={inputConfigs}
    >
      {inputElements}
    </ManualFieldItemGroup>
  );
}
