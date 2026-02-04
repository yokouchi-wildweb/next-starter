// src/components/Form/Field/Configured/ConfiguredMediaField.tsx
// config経由のメディアフィールドコンポーネント

"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useWatch } from "react-hook-form";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { ControlledField } from "../Controlled";
import { useMediaUploaderField } from "@/components/Form/MediaHandler/useMediaUploaderField";
import { useAppFormMedia } from "@/components/Form/AppForm";
import { useAutoSaveContext } from "@/components/Form/AutoSave";
import type { FieldConfig, FieldCommonProps } from "../types";
import type { SelectedMediaMetadata } from "@/lib/mediaInputSuite";
import type { MediaHandleEntry } from "@/components/Form/FieldRenderer/types";

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
  /**
   * メディアハンドル変更時のコールバック
   * 省略時は AppForm の Context に自動登録される
   */
  onHandleChange?: (name: TName, entry: MediaHandleEntry | null) => void;
};

/**
 * config経由のメディアアップロードフィールド
 *
 * AppForm 内で使用すると、自動的にメディア状態が管理され、
 * フォーム送信成功時に自動でコミットされる。
 *
 * @example
 * ```tsx
 * // AppForm 内で使用（自動登録）
 * <AppForm methods={methods} onSubmit={handleSubmit}>
 *   <ConfiguredMediaField
 *     control={control}
 *     methods={methods}
 *     fieldConfig={mediaFieldConfig}
 *   />
 * </AppForm>
 *
 * // FieldRenderer 経由（onHandleChange を渡す）
 * <ConfiguredMediaField
 *   control={control}
 *   methods={methods}
 *   fieldConfig={mediaFieldConfig}
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

  // AppForm の Context を取得
  const appFormMedia = useAppFormMedia();

  // AutoSave の Context を取得
  const autoSaveContext = useAutoSaveContext<TFieldValues>();

  // オートセーブ時のURL変更ハンドラ用ref（commit後にtriggerSaveを呼ぶため）
  const mediaHandleRef = useRef<ReturnType<typeof useMediaUploaderField<TFieldValues, TName>> | null>(null);

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
    // オートセーブが有効な場合、URL変更時に即時保存
    onUrlChange: autoSaveContext?.enabled
      ? async (url) => {
          // メディアをコミット（アップロード確定 or 削除確定）
          await mediaHandleRef.current?.commit(url);
          // フォームデータを保存
          await autoSaveContext.triggerSave();
        }
      : undefined,
  });

  // refを更新（onUrlChange内で使用）
  mediaHandleRef.current = mediaHandle;

  // onHandleChange が渡されている場合はそちらを使用（FieldRenderer 経由）
  // そうでない場合は AppForm の Context に登録
  useEffect(() => {
    const entry: MediaHandleEntry = {
      isUploading: mediaHandle.isUploading,
      commit: mediaHandle.commit,
      reset: mediaHandle.reset,
    };

    if (onHandleChange) {
      // FieldRenderer 経由の場合
      onHandleChange(fieldName, entry);
      return () => {
        onHandleChange(fieldName, null);
      };
    } else if (appFormMedia) {
      // AppForm の Context に直接登録
      appFormMedia.registerMediaHandle(String(fieldName), entry);
      return () => {
        appFormMedia.unregisterMediaHandle(String(fieldName));
      };
    }
  }, [fieldName, mediaHandle.isUploading, mediaHandle.commit, mediaHandle.reset, onHandleChange, appFormMedia]);

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
    <ControlledField
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
      blurMode="none"  // メディアは独自のオートセーブ処理（onUrlChange）を持つ
      renderInput={mediaHandle.render}
    />
  );
}
