// src/components/Form/Field/MediaFieldItem.tsx
// スタンドアロン版メディアフィールドコンポーネント

"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { FieldItem } from "./FieldItem";
import { useMediaUploaderField } from "@/components/Form/MediaHandler/useMediaUploaderField";
import { useAppFormMedia } from "@/components/Form/AppForm";
import type { FileValidationRule, SelectedMediaMetadata } from "@/lib/mediaInputSuite";
import type { FieldCommonProps } from "../types";

export type MediaFieldItemProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = FieldCommonProps & {
  control: Control<TFieldValues, any, TFieldValues>;
  methods: UseFormReturn<TFieldValues>;
  name: TName;
  label?: ReactNode;
  uploadPath: string;
  accept?: string;
  helperText?: string;
  validationRule?: FileValidationRule;
  onMetadataChange?: (metadata: SelectedMediaMetadata) => void;
};

/**
 * スタンドアロン版メディアアップロードフィールド
 *
 * AppForm 内で使用すると、自動的にメディア状態が管理され、
 * フォーム送信成功時に自動でコミットされる。
 *
 * @example
 * ```tsx
 * <AppForm methods={methods} onSubmit={handleSubmit}>
 *   <MediaFieldItem
 *     control={control}
 *     methods={methods}
 *     name="imageUrl"
 *     label="画像"
 *     uploadPath="images"
 *     accept="image/*"
 *   />
 * </AppForm>
 * ```
 */
export function MediaFieldItem<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  methods,
  name,
  label,
  description,
  uploadPath,
  accept,
  helperText,
  validationRule,
  onMetadataChange,
  className,
  hideLabel = false,
  hideError = false,
  required = false,
  requiredMark,
  requiredMarkPosition,
  inputClassName,
  layout,
  labelClass,
}: MediaFieldItemProps<TFieldValues, TName>) {
  // AppForm の Context を取得
  const appFormMedia = useAppFormMedia();

  const mediaHandle = useMediaUploaderField({
    methods,
    name,
    uploaderProps: {
      uploadPath,
      accept,
      helperText,
      validationRule,
      onMetadataChange,
    },
  });

  // AppForm の Context に自動登録
  useEffect(() => {
    if (!appFormMedia) return;

    appFormMedia.registerMediaHandle(String(name), {
      isUploading: mediaHandle.isUploading,
      commit: mediaHandle.commit,
      reset: mediaHandle.reset,
    });

    return () => {
      appFormMedia.unregisterMediaHandle(String(name));
    };
  }, [name, mediaHandle.isUploading, mediaHandle.commit, mediaHandle.reset, appFormMedia]);

  return (
    <FieldItem
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
      inputClassName={inputClassName}
      hideLabel={hideLabel}
      hideError={hideError}
      required={required}
      requiredMark={requiredMark}
      requiredMarkPosition={requiredMarkPosition}
      layout={layout}
      labelClass={labelClass}
      renderInput={mediaHandle.render}
    />
  );
}
