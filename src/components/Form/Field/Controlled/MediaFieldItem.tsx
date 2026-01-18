// src/components/Form/Field/MediaFieldItem.tsx
// スタンドアロン版メディアフィールドコンポーネント

"use client";

import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { FieldItem, type FieldItemDescription } from "./FieldItem";
import { useMediaUploaderField } from "@/components/Form/MediaHandler/useMediaUploaderField";
import type { FileValidationRule, SelectedMediaMetadata } from "@/lib/mediaInputSuite";

export type MediaFieldItemProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues, any, TFieldValues>;
  methods: UseFormReturn<TFieldValues>;
  name: TName;
  label?: ReactNode;
  description?: FieldItemDescription;
  uploadPath: string;
  accept?: string;
  helperText?: string;
  validationRule?: FileValidationRule;
  onMetadataChange?: (metadata: SelectedMediaMetadata) => void;
  /** FormItem全体に適用するクラス名 */
  className?: string;
  /** ラベルを視覚的に非表示にする */
  hideLabel?: boolean;
  /** エラーメッセージを非表示にする */
  hideError?: boolean;
  /** フィールドが必須かどうか */
  required?: boolean;
};

/**
 * スタンドアロン版メディアアップロードフィールド
 *
 * DomainFieldRenderer を使わずに単独で配置できる。
 *
 * @example
 * ```tsx
 * <MediaFieldItem
 *   control={control}
 *   methods={methods}
 *   name="imageUrl"
 *   label="画像"
 *   uploadPath="images"
 *   accept="image/*"
 * />
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
}: MediaFieldItemProps<TFieldValues, TName>) {
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

  return (
    <FieldItem
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
      hideLabel={hideLabel}
      hideError={hideError}
      required={required}
      renderInput={mediaHandle.render}
    />
  );
}
