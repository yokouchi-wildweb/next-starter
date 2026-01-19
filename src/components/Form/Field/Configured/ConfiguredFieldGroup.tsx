// src/components/Form/Field/Configured/ConfiguredFieldGroup.tsx

"use client";

import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues, ControllerRenderProps } from "react-hook-form";

import { FieldItemGroup } from "../Controlled";
import type { FieldConfig, FieldItemDescription, RequiredMarkOptions } from "../types";
import { renderInputByFormType } from "./inputResolver";

export type ConfiguredFieldGroupProps<
  TFieldValues extends FieldValues,
  TNames extends readonly FieldPath<TFieldValues>[]
> = RequiredMarkOptions & {
  /** react-hook-form の control */
  control: Control<TFieldValues, any, TFieldValues>;
  /** フィールド設定の配列（FieldConfig[]）- 順序通りに横並び表示 */
  fieldConfigs: FieldConfig[];
  /** グループラベル（省略時は最初のフィールドの label を使用） */
  label?: ReactNode;
  /** 説明テキスト */
  description?: FieldItemDescription;
  /** 各フィールドの幅（Tailwindクラス）、省略時は均等 */
  fieldWidths?: string[];
  /** フィールド間のギャップ（Tailwindクラス、デフォルト: "gap-2"） */
  gap?: string;
  /** グループ全体のクラス名 */
  className?: string;
  /** 内部のInputコンポーネントに適用するクラス名（全Inputに同じクラスを適用） */
  inputClassName?: string;
};

/**
 * 設定ベースのインラインフィールドグループコンポーネント
 *
 * 複数の FieldConfig を受け取り、横並びで描画する。
 * 内部で FieldItemGroup を使用し、各フィールドの入力コンポーネントは
 * fieldConfig.formInput に基づいて自動選択される。
 *
 * @example
 * ```tsx
 * // 生年月日の例
 * <ConfiguredFieldGroup
 *   control={control}
 *   fieldConfigs={[fields.birth_year, fields.birth_month, fields.birth_day]}
 *   label="生年月日"
 *   required
 * />
 *
 * // 幅を指定
 * <ConfiguredFieldGroup
 *   control={control}
 *   fieldConfigs={[fields.postal_code, fields.city]}
 *   label="住所"
 *   fieldWidths={["w-32", "flex-1"]}
 * />
 * ```
 */
export function ConfiguredFieldGroup<
  TFieldValues extends FieldValues,
  TNames extends readonly FieldPath<TFieldValues>[]
>({
  control,
  fieldConfigs,
  label,
  required = false,
  description,
  fieldWidths,
  gap,
  className,
  inputClassName,
  requiredMark,
  requiredMarkPosition = "after",
}: ConfiguredFieldGroupProps<TFieldValues, TNames>) {
  if (fieldConfigs.length === 0) {
    return null;
  }

  // フィールド名の配列を作成
  const names = fieldConfigs.map(
    (config) => config.name as FieldPath<TFieldValues>
  ) as unknown as TNames;

  // ラベルは Props で指定されていなければ最初のフィールドの label を使用
  const resolvedLabel = label ?? fieldConfigs[0].label;

  return (
    <FieldItemGroup
      control={control}
      names={names}
      label={resolvedLabel}
      required={required}
      description={description}
      fieldWidths={fieldWidths}
      gap={gap}
      className={className}
      inputClassName={inputClassName}
      requiredMark={requiredMark}
      requiredMarkPosition={requiredMarkPosition}
      renderInputs={(fields, inputClassName) =>
        fields.map((field, index) => {
          const fieldConfig = fieldConfigs[index];
          if (!fieldConfig) return null;
          return renderInputByFormType(
            fieldConfig.formInput,
            field as ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>,
            fieldConfig,
            inputClassName
          );
        }).filter((el): el is ReactNode => el !== null)
      }
    />
  );
}
