"use client";

import { useEffect } from "react";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { useMediaUploaderField } from "@/lib/mediaInputSuite";

import type { MediaUploaderFieldConfig } from "./fieldTypes";

type MediaFieldItemProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = {
  control: Control<TFieldValues, any, TFieldValues>;
  methods: UseFormReturn<TFieldValues>;
  config: MediaUploaderFieldConfig<TFieldValues, TName>;
  onHandleChange: (
    name: TName,
    entry:
      | {
          isUploading: boolean;
          commit: (finalUrl?: string | null) => Promise<void>;
          reset: () => Promise<void>;
        }
      | null,
  ) => void;
};

export function MediaFieldItem<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  methods,
  config,
  onHandleChange,
}: MediaFieldItemProps<TFieldValues, TName>) {
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

  return (
    <FormFieldItem
      control={control}
      name={config.name}
      label={config.label}
      description={config.description}
      renderInput={mediaHandle.render}
    />
  );
}
