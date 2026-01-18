// src/components/Form/Field/ConfiguredMediaField.tsx
// config経由のメディアフィールドコンポーネント（DomainFieldRenderer用）

"use client";

import { useEffect, useRef } from "react";
import { useWatch } from "react-hook-form";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { FieldItem } from "./FieldItem";
import { useMediaUploaderField } from "@/components/Form/MediaHandler/useMediaUploaderField";
import type { MediaUploaderFieldConfig } from "@/components/Form/DomainFieldRenderer/fieldTypes";

export type MediaHandleEntry = {
  isUploading: boolean;
  commit: (finalUrl?: string | null) => Promise<void>;
  reset: () => Promise<void>;
};

export type ConfiguredMediaFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues, any, TFieldValues>;
  methods: UseFormReturn<TFieldValues>;
  config: MediaUploaderFieldConfig<TFieldValues, TName>;
  onHandleChange: (name: TName, entry: MediaHandleEntry | null) => void;
};

/**
 * config経由のメディアアップロードフィールド
 *
 * DomainFieldRenderer から使用される。メディア状態を親に通知する機能を持つ。
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
  config,
  onHandleChange,
}: ConfiguredMediaFieldProps<TFieldValues, TName>) {
  const mediaHandle = useMediaUploaderField({
    methods,
    name: config.name,
    uploaderProps: {
      uploadPath: config.uploadPath,
      accept: config.accept,
      helperText: config.helperText,
      validationRule: config.validationRule,
      onMetadataChange: config.onMetadataChange,
    },
  });

  useEffect(() => {
    onHandleChange(config.name, {
      isUploading: mediaHandle.isUploading,
      commit: mediaHandle.commit,
      reset: mediaHandle.reset,
    });
    return () => {
      onHandleChange(config.name, null);
    };
  }, [config.name, mediaHandle.isUploading, mediaHandle.commit, mediaHandle.reset, onHandleChange]);

  const watchedValue = useWatch({
    control,
    name: config.name,
  }) as string | null | undefined;
  const previousValueRef = useRef<string | null>(
    typeof watchedValue === "string" && watchedValue.length > 0 ? watchedValue : null,
  );
  const handleMetadataChange = config.onMetadataChange;
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
      name={config.name}
      label={config.label}
      description={config.description}
      renderInput={mediaHandle.render}
    />
  );
}
