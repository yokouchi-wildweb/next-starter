// src/components/Form/Field/MediaFieldItem.tsx
// スタンドアロン版メディアフィールドコンポーネント

"use client";

import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { FieldItem } from "./FieldItem";
import { useMediaUploaderField } from "@/components/Form/MediaHandler/useMediaUploaderField";
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
 * FieldRenderer を使わずに単独で配置できる。
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
  requiredMark,
  requiredMarkPosition,
  inputClassName,
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
      inputClassName={inputClassName}
      hideLabel={hideLabel}
      hideError={hideError}
      required={required}
      requiredMark={requiredMark}
      requiredMarkPosition={requiredMarkPosition}
      renderInput={mediaHandle.render}
    />
  );
}
