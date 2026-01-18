// src/components/Form/Field/Configured/ConfiguredField.tsx

"use client";

import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FieldItem } from "../Controlled";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/_shadcn/form";
import type { FieldConfig, FieldCommonProps } from "../types";
import {
  renderInputByFormType,
  shouldUseFieldItem,
  hasVisibleInput,
} from "./inputResolver";

export type ConfiguredFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = FieldCommonProps & {
  /** react-hook-form の control */
  control: Control<TFieldValues, any, TFieldValues>;
  /** フィールド設定（FieldConfig） */
  fieldConfig: FieldConfig;
  /** フィールド名（省略時は fieldConfig.name） */
  name?: TName;
  /** ラベル（省略時は fieldConfig.label） */
  label?: ReactNode;
};

/**
 * 設定ベースのフィールドコンポーネント
 *
 * FieldConfig の設定を受け取り、適切な入力コンポーネントを自動選択して描画する。
 * label, required などは Props で上書き可能。
 *
 * @example
 * ```tsx
 * // 基本的な使い方
 * <ConfiguredField
 *   control={control}
 *   fieldConfig={fields.title}
 * />
 *
 * // 上書き
 * <ConfiguredField
 *   control={control}
 *   fieldConfig={fields.title}
 *   label="カスタムラベル"
 *   required={true}
 * />
 * ```
 */
export function ConfiguredField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  fieldConfig,
  name,
  label,
  required,
  description,
  className,
  hideLabel = false,
  hideError = false,
  requiredMark,
  requiredMarkPosition,
}: ConfiguredFieldProps<TFieldValues, TName>) {
  const resolvedName = (name ?? fieldConfig.name) as TName;
  const resolvedLabel = label ?? fieldConfig.label;
  const resolvedRequired = required ?? fieldConfig.required ?? false;

  const { formInput } = fieldConfig;

  // 非表示フィールド
  if (!hasVisibleInput(formInput)) {
    if (formInput === "hidden") {
      return (
        <FormField
          control={control}
          name={resolvedName}
          render={({ field }) => <input type="hidden" {...field} />}
        />
      );
    }
    // none の場合は何も描画しない
    return null;
  }

  // FieldItem を使用しない特殊なコンポーネント
  if (!shouldUseFieldItem(formInput)) {
    return (
      <FormField
        control={control}
        name={resolvedName}
        render={({ field }) => (
          <FormItem className={className}>
            <FormControl>
              {renderInputByFormType(formInput, field, fieldConfig)}
            </FormControl>
            {!hideError && <FormMessage />}
          </FormItem>
        )}
      />
    );
  }

  // 通常のフィールド（FieldItem を使用）
  return (
    <FieldItem
      control={control}
      name={resolvedName}
      label={resolvedLabel}
      required={resolvedRequired}
      requiredMark={requiredMark}
      requiredMarkPosition={requiredMarkPosition}
      description={description}
      className={className}
      hideLabel={hideLabel}
      hideError={hideError}
      renderInput={(field) => renderInputByFormType(formInput, field, fieldConfig)}
    />
  );
}
