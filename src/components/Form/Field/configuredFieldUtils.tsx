// src/components/Form/Field/configuredFieldUtils.ts

import type { ReactNode } from "react";
import type { ControllerRenderProps, FieldPath, FieldValues } from "react-hook-form";

import {
  BooleanCheckboxInput,
  CheckGroupInput,
  DateInput,
  DatetimeInput,
  EmailInput,
  MultiSelectInput,
  NumberInput,
  PasswordInput,
  RadioGroupInput,
  SelectInput,
  StepperInput,
  SwitchInput,
  TextInput,
  Textarea,
  TimeInput,
} from "@/components/Form/Input/Controlled";
import type { DomainJsonField, DomainFormInput } from "@/components/Form/DomainFieldRenderer/types";
import type { RadioGroupDisplayType } from "@/components/Form/Input/Manual/RadioGroupInput";
import type { CheckGroupDisplayType } from "@/components/Form/Input/Manual/CheckGroupInput";

/**
 * formInput タイプに応じた入力コンポーネントをレンダリングする
 *
 * @param formInput - フォーム入力種別
 * @param field - react-hook-form の ControllerRenderProps
 * @param fieldConfig - フィールド設定（DomainJsonField）
 * @returns ReactNode（入力コンポーネント）
 *
 * @example
 * ```tsx
 * <FieldItem
 *   control={control}
 *   name={fieldConfig.name}
 *   label={fieldConfig.label}
 *   renderInput={(field) => renderInputByFormType(fieldConfig.formInput, field, fieldConfig)}
 * />
 * ```
 */
export function renderInputByFormType<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>(
  formInput: DomainFormInput,
  field: ControllerRenderProps<TFieldValues, TName>,
  fieldConfig: DomainJsonField
): ReactNode {
  const readOnly = fieldConfig.readonly ?? false;

  switch (formInput) {
    case "textInput":
      return <TextInput field={field} readOnly={readOnly} />;

    case "numberInput":
      return <NumberInput field={field} readOnly={readOnly} />;

    case "textarea":
      return (
        <Textarea
          field={field}
          placeholder={fieldConfig.placeholder}
          readOnly={readOnly}
        />
      );

    case "select":
      return (
        <SelectInput
          field={field}
          options={normalizeOptions(fieldConfig.options)}
        />
      );

    case "multiSelect":
      return (
        <MultiSelectInput
          field={field as ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>}
          options={normalizeOptions(fieldConfig.options)}
          placeholder={fieldConfig.placeholder}
        />
      );

    case "radio": {
      const options = normalizeRadioOptions(fieldConfig.options);
      return (
        <RadioGroupInput
          field={field as ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>}
          options={options}
          displayType={(fieldConfig.displayType as RadioGroupDisplayType | undefined) ?? "standard"}
        />
      );
    }

    case "checkbox": {
      // fieldType が array の場合は CheckGroupInput、それ以外は BooleanCheckboxInput
      if (fieldConfig.fieldType === "array") {
        return (
          <CheckGroupInput
            field={field as ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>}
            options={normalizeOptions(fieldConfig.options)}
            displayType={(fieldConfig.displayType as CheckGroupDisplayType | undefined) ?? "standard"}
          />
        );
      }
      return (
        <BooleanCheckboxInput
          field={field as ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>}
          label={fieldConfig.label}
        />
      );
    }

    case "stepperInput":
      return (
        <StepperInput
          field={field}
        />
      );

    case "switchInput":
      return (
        <SwitchInput
          field={field}
          label={fieldConfig.label}
        />
      );

    case "dateInput":
      return <DateInput field={field} readOnly={readOnly} />;

    case "timeInput":
      return <TimeInput field={field} readOnly={readOnly} />;

    case "datetimeInput":
      return <DatetimeInput field={field} readOnly={readOnly} />;

    case "emailInput":
      return <EmailInput field={field} readOnly={readOnly} />;

    case "passwordInput":
      return <PasswordInput field={field} readOnly={readOnly} />;

    case "hidden":
      return <input type="hidden" {...field} />;

    case "none":
      return null;

    case "mediaUploader":
      // mediaUploader は特殊な処理が必要なため、ConfiguredField では未サポート
      // DomainFieldRenderer を使用してください
      console.warn(
        `[ConfiguredField] formInput="mediaUploader" is not supported. Use DomainFieldRenderer instead. Field: ${fieldConfig.name}`
      );
      return null;

    default: {
      // 未知の formInput タイプ
      const _exhaustiveCheck: never = formInput;
      console.warn(`[ConfiguredField] Unknown formInput type: ${formInput}`);
      return null;
    }
  }
}

/**
 * オプション配列を正規化する
 * readonly 配列も受け入れる
 */
function normalizeOptions(
  options?: readonly { value: string | number | boolean; label: string }[] | { value: string | number | boolean; label: string }[]
): { value: string | number | boolean; label: string }[] {
  if (!options) return [];
  return [...options];
}

/**
 * radio 用のオプションを正規化する
 * boolean 値の文字列表現も適切に変換
 */
function normalizeRadioOptions(
  options?: readonly { value: string | number | boolean; label: string }[] | { value: string | number | boolean; label: string }[]
): { value: string | number | boolean; label: string }[] {
  if (!options) return [];
  return options.map((option) => {
    let normalizedValue: string | number | boolean = option.value;
    if (option.value === true || option.value === "true") {
      normalizedValue = true;
    } else if (option.value === false || option.value === "false") {
      normalizedValue = false;
    }
    return {
      value: normalizedValue,
      label: option.label,
    };
  });
}

/**
 * formInput が入力コンポーネントを持つかどうかを判定
 * hidden と none は入力コンポーネントを持たない（または非表示）
 */
export function hasVisibleInput(formInput: DomainFormInput): boolean {
  return formInput !== "hidden" && formInput !== "none";
}

/**
 * formInput が FieldItem でラップすべきかどうかを判定
 * 一部のコンポーネント（switch, stepper, booleanCheckbox）は独自のレイアウトを持つ
 */
export function shouldUseFieldItem(formInput: DomainFormInput): boolean {
  // 以下は FieldItem ではなく独自レイアウトを使用
  const noFieldItemTypes: DomainFormInput[] = [
    "switchInput",
    "stepperInput",
    "hidden",
    "none",
    "mediaUploader",
  ];
  return !noFieldItemTypes.includes(formInput);
}

/**
 * checkbox の formInput が配列型かどうかを判定
 */
export function isCheckboxArray(fieldConfig: DomainJsonField): boolean {
  return fieldConfig.formInput === "checkbox" && fieldConfig.fieldType === "array";
}
