// src/components/Form/Field/Configured/ConfiguredField.tsx

"use client";

import type { ReactNode } from "react";
import type { Control, ControllerRenderProps, FieldPath, FieldValues } from "react-hook-form";

import { FieldItem } from "../Controlled";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/_shadcn/form";
import { useAutoSaveContext } from "@/components/Form/AutoSave";
import type { FieldConfig, FieldCommonProps } from "../types";
import {
  renderInputByFormType,
  shouldUseFieldItem,
  hasVisibleInput,
  getBlurMode,
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
  inputClassName,
  hideLabel = false,
  hideError = false,
  requiredMark,
  requiredMarkPosition,
  layout,
  labelClass,
}: ConfiguredFieldProps<TFieldValues, TName>) {
  const resolvedName = (name ?? fieldConfig.name) as TName;
  const resolvedLabel = label ?? fieldConfig.label;
  const resolvedRequired = required ?? fieldConfig.required ?? false;

  const { formInput } = fieldConfig;

  // 自動保存コンテキスト（FieldItemを使わないコンポーネント用）
  const autoSaveContext = useAutoSaveContext<TFieldValues>();

  /**
   * FieldItemを使わないコンポーネント用に、fieldをauto-save対応でラップする
   */
  const wrapFieldWithAutoSave = (
    field: ControllerRenderProps<TFieldValues, TName>
  ): ControllerRenderProps<TFieldValues, TName> => {
    if (!autoSaveContext?.enabled) return field;

    const blurMode = getBlurMode(fieldConfig);
    return {
      ...field,
      onBlur: () => {
        field.onBlur();
        autoSaveContext.onFieldBlur(resolvedName, { immediate: blurMode === "immediate" });
      },
    };
  };

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
        render={({ field }) => {
          // 自動保存対応でfieldをラップ
          const wrappedField = wrapFieldWithAutoSave(field);
          return (
            <FormItem className={className}>
              <FormControl>
                {renderInputByFormType(formInput, wrappedField, fieldConfig, inputClassName)}
              </FormControl>
              {!hideError && <FormMessage />}
            </FormItem>
          );
        }}
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
      inputClassName={inputClassName}
      hideLabel={hideLabel}
      hideError={hideError}
      layout={layout}
      labelClass={labelClass}
      blurMode={getBlurMode(fieldConfig)}
      renderInput={(field, inputClassName) => renderInputByFormType(formInput, field, fieldConfig, inputClassName)}
    />
  );
}
