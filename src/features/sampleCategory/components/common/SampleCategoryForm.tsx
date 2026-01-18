// src/features/undefined/components/common/SampleCategoryForm.tsx

"use client";

import { useCallback, useState } from "react";
import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { SampleCategoryFields, type SampleCategoryFieldsProps } from "./SampleCategoryFields";
import type { MediaState } from "@/components/Form/FieldRenderer";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type SampleCategoryFormProps<TFieldValues extends FieldValues> =
  Omit<SampleCategoryFieldsProps<TFieldValues>, "methods" | "onMediaStateChange"> & {
    methods: UseFormReturn<TFieldValues>;
    onSubmitAction: (data: TFieldValues) => Promise<void>;
    isMutating?: boolean;
    submitLabel: string;
    processingLabel: string;
    onCancel?: () => void;
  };

export function SampleCategoryForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
  ...fieldsProps
}: SampleCategoryFormProps<TFieldValues>) {
  const {
    formState: { isSubmitting },
  } = methods;

  const [mediaState, setMediaState] = useState<MediaState | null>(null);

  const loading = isSubmitting || isMutating;
  const disabled = loading || Boolean(mediaState?.isUploading);

  const handleSubmit = useCallback(
    async (data: TFieldValues) => {
      await onSubmitAction(data);
      await mediaState?.commitAll();
    },
    [mediaState, onSubmitAction],
  );

  const handleCancel = useCallback(async () => {
    await mediaState?.resetAll();
    onCancel?.();
  }, [mediaState, onCancel]);

  return (
    <AppForm
      methods={methods}
      onSubmit={handleSubmit}
      pending={disabled}
      fieldSpace="md"
    >
      <SampleCategoryFields<TFieldValues>
        {...fieldsProps}
        methods={methods}
        onMediaStateChange={setMediaState}
      />
      <div className="flex justify-center gap-3">
        <Button type="submit" disabled={disabled} variant="default">
          {disabled ? processingLabel : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={handleCancel}>
            キャンセル
          </Button>
        ) : null}
      </div>
    </AppForm>
  );
}
