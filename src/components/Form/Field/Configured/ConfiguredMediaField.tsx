// src/components/Form/Field/Configured/ConfiguredMediaField.tsx
// config経由のメディアフィールドコンポーネント（FieldRenderer用）

"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useWatch } from "react-hook-form";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { FieldItem } from "../Controlled";
import { useMediaUploaderField } from "@/components/Form/MediaHandler/useMediaUploaderField";
import type { FieldConfig, FieldCommonProps } from "../types";
import type { SelectedMediaMetadata } from "@/lib/mediaInputSuite";

export type MediaHandleEntry = {
  isUploading: boolean;
  commit: (finalUrl?: string | null) => Promise<void>;
  reset: () => Promise<void>;
};

/**
 * メディアフィールド用の拡張設定
 * FieldConfig に onMetadataChange を追加
 */
export type MediaFieldConfig = FieldConfig & {
  onMetadataChange?: (metadata: SelectedMediaMetadata) => void;
};

export type ConfiguredMediaFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = FieldCommonProps & {
  /** react-hook-form の control */
  control: Control<TFieldValues, any, TFieldValues>;
  /** react-hook-form の methods */
  methods: UseFormReturn<TFieldValues>;
  /** フィールド設定（MediaFieldConfig） */
  fieldConfig: MediaFieldConfig;
  /** フィールド名（省略時は fieldConfig.name） */
  name?: TName;
  /** ラベル（省略時は fieldConfig.label） */
  label?: ReactNode;
  /** メディアハンドル変更時のコールバック */
  onHandleChange: (name: TName, entry: MediaHandleEntry | null) => void;
};

/**
 * config経由のメディアアップロードフィールド
 *
 * FieldRenderer から使用される。メディア状態を親に通知する機能を持つ。
 *
 * @example
 * ```tsx
 * <ConfiguredMediaField
 *   control={control}
 *   methods={methods}
 *   config={mediaFieldConfig}
 *   onHandleChange={handleMediaHandleChange}
 * />
 * ```
 */
export function ConfiguredMediaField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  methods,
  fieldConfig,
  name,
  label,
  onHandleChange,
  description,
  className,
  hideLabel = false,
  hideError = false,
  required,
  requiredMark,
  requiredMarkPosition,
  inputClassName,
  layout,
  labelClass,
}: ConfiguredMediaFieldProps<TFieldValues, TName>) {
  const fieldName = (name ?? fieldConfig.name) as TName;
  const resolvedLabel = label ?? fieldConfig.label;
  const resolvedRequired = required ?? fieldConfig.required ?? false;

  const mediaHandle = useMediaUploaderField({
    methods,
    name: fieldName,
    uploaderProps: {
      uploadPath: fieldConfig.uploadPath ?? "",
      accept: fieldConfig.accept,
      helperText: fieldConfig.helperText,
      validationRule: fieldConfig.validationRule,
      onMetadataChange: fieldConfig.onMetadataChange,
    },
  });

  useEffect(() => {
    onHandleChange(fieldName, {
      isUploading: mediaHandle.isUploading,
      commit: mediaHandle.commit,
      reset: mediaHandle.reset,
    });
    return () => {
      onHandleChange(fieldName, null);
    };
  }, [fieldName, mediaHandle.isUploading, mediaHandle.commit, mediaHandle.reset, onHandleChange]);

  const watchedValue = useWatch({
    control,
    name: fieldName,
  }) as string | null | undefined;
  const previousValueRef = useRef<string | null>(
    typeof watchedValue === "string" && watchedValue.length > 0 ? watchedValue : null,
  );
  const handleMetadataChange = fieldConfig.onMetadataChange;
  useEffect(() => {
    const normalizedValue =
      typeof watchedValue === "string" && watchedValue.trim().length > 0 ? watchedValue : null;
    const previousValue = previousValueRef.current;
    const isValueCleared = Boolean(previousValue) && !normalizedValue;

    if (isValueCleared && handleMetadataChange) {
      handleMetadataChange({
        image: null,
        video: null,
      });
    }

    previousValueRef.current = normalizedValue;
  }, [handleMetadataChange, watchedValue]);

  return (
    <FieldItem
      control={control}
      name={fieldName}
      label={resolvedLabel}
      description={description}
      className={className}
      inputClassName={inputClassName}
      hideLabel={hideLabel}
      hideError={hideError}
      required={resolvedRequired}
      requiredMark={requiredMark}
      requiredMarkPosition={requiredMarkPosition}
      layout={layout}
      labelClass={labelClass}
      renderInput={mediaHandle.render}
    />
  );
}
