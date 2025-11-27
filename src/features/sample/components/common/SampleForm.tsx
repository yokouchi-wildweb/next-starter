// src/features/undefined/components/common/SampleForm.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { SampleFields, type SampleFieldsProps } from "./SampleFields";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { useCallback, useMemo } from "react";
import { useMediaUploaderField } from "@/lib/mediaInputSuite";

export type SampleFormProps<TFieldValues extends FieldValues> =
  Omit<SampleFieldsProps<TFieldValues>, "control" | "mainImageFieldRender"> & {
    methods: UseFormReturn<TFieldValues>;
    onSubmitAction: (data: TFieldValues) => Promise<void>;
    isMutating?: boolean;
    submitLabel: string;
    processingLabel: string;
    onCancel?: () => void;
    uploadPath: string;
    defaultMainImageUrl?: string | null;
  };

export function SampleForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
  uploadPath,
  defaultMainImageUrl = null,
  ...fieldsProps
}: SampleFormProps<TFieldValues>) {
  const {
    control,
    formState: { isSubmitting },
  } = methods;

  const baseUploaderProps = useMemo(
    () => ({
      uploadPath,
      accept: "image/*",
      helperText: "1枚の画像をアップロードできます",
    }),
    [uploadPath],
  );

  const mainImageField = useMediaUploaderField<TFieldValues, FieldPath<TFieldValues>>({
    methods,
    name: "main_image" as FieldPath<TFieldValues>,
    defaultValue: defaultMainImageUrl ?? null,
    uploaderProps: baseUploaderProps,
  });

  const loading = isSubmitting || isMutating;
  const disabled = loading || mainImageField.isUploading;

  const handleSubmit = useCallback(
    async (data: TFieldValues) => {
      await onSubmitAction(data);
      await mainImageField.commit();
    },
    [mainImageField, onSubmitAction],
  );

  const handleCancelClick = useCallback(async () => {
    await mainImageField.reset();
    onCancel?.();
  }, [mainImageField, onCancel]);

  return (
    <AppForm
      methods={methods}
      onSubmit={handleSubmit}
      pending={disabled}
      fieldSpace="md"
    >
      <SampleFields<TFieldValues> {...fieldsProps} control={control} mainImageFieldRender={mainImageField.render} />
      <div className="flex justify-center gap-3">
        <Button type="submit" disabled={disabled} variant="default">
          {disabled ? processingLabel : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={handleCancelClick}>
            キャンセル
          </Button>
        ) : null}
      </div>
    </AppForm>
  );
}
