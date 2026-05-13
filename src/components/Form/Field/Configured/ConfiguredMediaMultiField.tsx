// src/components/Form/Field/Configured/ConfiguredMediaMultiField.tsx
// config経由の複数枚メディアフィールドコンポーネント

"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { ControlledField } from "../Controlled";
import { useMediaUploaderMultiField } from "@/components/Form/MediaHandler/useMediaUploaderMultiField";
import { useAppFormMedia } from "@/components/Form/AppForm";
import { useAutoSaveContext } from "@/components/Form/AutoSave";
import type { FieldConfig, FieldCommonProps } from "../types";
import type { MediaHandleEntry } from "@/components/Form/FieldRenderer/types";

export type ConfiguredMediaMultiFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = FieldCommonProps & {
  control: Control<TFieldValues, any, TFieldValues>;
  methods: UseFormReturn<TFieldValues>;
  fieldConfig: FieldConfig;
  name?: TName;
  label?: ReactNode;
  /**
   * メディアハンドル変更時のコールバック
   * 省略時は AppForm の Context に自動登録される
   */
  onHandleChange?: (name: TName, entry: MediaHandleEntry | null) => void;
};

/**
 * config 経由の複数枚メディアアップロードフィールド
 * 単一版 ConfiguredMediaField の挙動と一致させた上で、value: string[] を扱う
 */
export function ConfiguredMediaMultiField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
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
}: ConfiguredMediaMultiFieldProps<TFieldValues, TName>) {
  const fieldName = (name ?? fieldConfig.name) as TName;
  const resolvedLabel = label ?? fieldConfig.label;
  const resolvedRequired = required ?? fieldConfig.required ?? false;

  const appFormMedia = useAppFormMedia();
  const autoSaveContext = useAutoSaveContext<TFieldValues>();

  // commit 後に triggerSave を呼ぶための ref
  const mediaHandleRef = useRef<ReturnType<typeof useMediaUploaderMultiField<TFieldValues, TName>> | null>(null);

  const mediaHandle = useMediaUploaderMultiField({
    methods,
    name: fieldName,
    uploaderProps: {
      uploadPath: fieldConfig.uploadPath ?? "",
      accept: fieldConfig.accept,
      helperText: fieldConfig.helperText,
      validationRule: fieldConfig.validationRule,
      reorderable: fieldConfig.reorderable ?? true,
    },
    onUrlsChange: autoSaveContext?.enabled
      ? async (urls) => {
          await mediaHandleRef.current?.commit(urls);
          await autoSaveContext.triggerSave();
        }
      : undefined,
  });

  mediaHandleRef.current = mediaHandle;

  useEffect(() => {
    const entry: MediaHandleEntry = {
      isUploading: mediaHandle.isUploading,
      // MediaHandleEntry.commit は引数なしで呼び出される契約（commitAll 経由）。
      // 複数枚版の commit シグネチャ (finalUrls?: string[]) は wrap して合わせる
      commit: () => mediaHandle.commit(),
      reset: mediaHandle.reset,
    };

    if (onHandleChange) {
      onHandleChange(fieldName, entry);
      return () => {
        onHandleChange(fieldName, null);
      };
    } else if (appFormMedia) {
      appFormMedia.registerMediaHandle(String(fieldName), entry);
      return () => {
        appFormMedia.unregisterMediaHandle(String(fieldName));
      };
    }
  }, [fieldName, mediaHandle.isUploading, mediaHandle.commit, mediaHandle.reset, onHandleChange, appFormMedia]);

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
      blurMode="none"
      renderInput={mediaHandle.render}
    />
  );
}
