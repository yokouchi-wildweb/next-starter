// src/features/undefined/components/common/FooForm.tsx

"use client";

import { useCallback, useState } from "react";
import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FooFields, type FooFieldsProps } from "./FooFields";
import type { DomainMediaState } from "@/components/Form/DomainFieldRenderer";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type FooFormProps<TFieldValues extends FieldValues> =
  Omit<FooFieldsProps<TFieldValues>, "methods" | "onMediaStateChange"> & {
    methods: UseFormReturn<TFieldValues>;
    onSubmitAction: (data: TFieldValues) => Promise<void>;
    isMutating?: boolean;
    submitLabel: string;
    processingLabel: string;
    onCancel?: () => void;
  };

export function FooForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
  ...fieldsProps
}: FooFormProps<TFieldValues>) {
  const {
    formState: { isSubmitting },
  } = methods;

  const [mediaState, setMediaState] = useState<DomainMediaState | null>(null);

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
      <FooFields<TFieldValues>
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
