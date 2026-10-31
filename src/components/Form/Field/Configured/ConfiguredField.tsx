// src/components/Form/Field/Configured/ConfiguredField.tsx

"use client";

import type { ReactNode } from "react";
import type { Control, ControllerRenderProps, FieldPath, FieldValues } from "react-hook-form";

import { ControlledField } from "../Controlled";
import { FormField, FormItem, FormMessage } from "@/components/_shadcn/form";
import { FieldControl } from "../FieldControl";
import { useAutoSaveContext } from "@/components/Form/AutoSave";
import type { FieldConfig, FieldCommonProps } from "../types";
import {
  renderInputByFormType,
  shouldUseFieldItem,
  hasVisibleInput,
  getBlurMode,
  isBuiltinFormInput,
} from "./inputResolver";
import { CustomFormInput, useCustomFormInput } from "./customInputs";

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
  const customInput = useCustomFormInput(formInput);

  // 自動保存コンテキスト（ControlledFieldを使わないコンポーネント用）
  const autoSaveContext = useAutoSaveContext<TFieldValues>();

  /**
   * ControlledFieldを使わないコンポーネント用に、fieldをauto-save対応でラップする
   */
  const wrapFieldWithAutoSave = (
    field: ControllerRenderProps<TFieldValues, TName>
  ): ControllerRenderProps<TFieldValues, TName> => {
    if (!autoSaveContext?.enabled) {
      return field;
    }

    const blurMode = customInput ? (customInput.blurMode ?? "none") : getBlurMode(fieldConfig);

    // blurMode="none"の場合は独自のオートセーブ処理を持つためスキップ
    if (blurMode === "none") {
      return field;
    }

    return {
      ...field,
      onBlur: () => {
        field.onBlur();
        autoSaveContext.onFieldBlur(resolvedName, { immediate: blurMode === "immediate" });
      },
    };
  };

  // 登録された入力部品: 枠は共通（frame: false で外す。エラーの表示は残る）
  if (customInput) {
    if (customInput.frame === false) {
      return (
        <FormField
          control={control}
          name={resolvedName}
          render={({ field }) => (
            <FormItem className={className}>
              <FieldControl hasMessage={!hideError}>
                <CustomFormInput item={customInput} field={wrapFieldWithAutoSave(field)} fieldConfig={fieldConfig} inputClassName={inputClassName} />
              </FieldControl>
              {!hideError && <FormMessage />}
            </FormItem>
          )}
        />
      );
    }
    return (
      <ControlledField
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
        blurMode={customInput.blurMode ?? "none"}
        renderInput={(field, inputClassName) => <CustomFormInput item={customInput} field={field} fieldConfig={fieldConfig} inputClassName={inputClassName} />}
      />
    );
  }

  // 組み込みに無く登録も無い名前
  if (!isBuiltinFormInput(formInput)) {
    console.warn(`Unknown form input type: ${formInput}`);
    return null;
  }

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
              <FieldControl hasMessage={!hideError}>
                {renderInputByFormType(formInput, wrappedField, fieldConfig, inputClassName)}
              </FieldControl>
              {!hideError && <FormMessage />}
            </FormItem>
          );
        }}
      />
    );
  }

  // 通常のフィールド（ControlledField を使用）
  return (
    <ControlledField
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
