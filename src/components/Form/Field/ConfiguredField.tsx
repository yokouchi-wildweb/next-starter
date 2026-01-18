// src/components/Form/Field/ConfiguredField.tsx

"use client";

import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FieldItem, type FieldItemDescription } from "./FieldItem";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/_shadcn/form";
import type { DomainJsonField } from "@/components/Form/DomainFieldRenderer/types";
import {
  renderInputByFormType,
  shouldUseFieldItem,
  hasVisibleInput,
} from "./_inputRenderer";

export type ConfiguredFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = {
  /** react-hook-form の control */
  control: Control<TFieldValues, any, TFieldValues>;
  /** フィールド設定（DomainJsonField） */
  fieldConfig: DomainJsonField;
  /** フィールド名（省略時は fieldConfig.name） */
  name?: TName;
  /** ラベル（省略時は fieldConfig.label） */
  label?: ReactNode;
  /** 必須かどうか（省略時は fieldConfig.required） */
  required?: boolean;
  /** 説明テキスト */
  description?: FieldItemDescription;
  /** FormItem 全体に適用するクラス名 */
  className?: string;
  /** ラベルを視覚的に非表示にする */
  hideLabel?: boolean;
  /** エラーメッセージを非表示にする */
  hideError?: boolean;
};

/**
 * 設定ベースのフィールドコンポーネント
 *
 * DomainJsonField の設定を受け取り、適切な入力コンポーネントを自動選択して描画する。
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
      description={description}
      className={className}
      hideLabel={hideLabel}
      hideError={hideError}
      renderInput={(field) => renderInputByFormType(formInput, field, fieldConfig)}
    />
  );
}
