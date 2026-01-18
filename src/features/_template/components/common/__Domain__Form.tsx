// src/features/__domain__/components/common/__Domain__Form.tsx

"use client";

import { useCallback, useState } from "react";
import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { __Domain__Fields, type __Domain__FieldsProps } from "./__Domain__Fields";
import type { MediaState } from "@/components/Form/FieldRenderer";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type __Domain__FormProps<TFieldValues extends FieldValues> =
  Omit<__Domain__FieldsProps<TFieldValues>, "methods" | "onMediaStateChange"> & {
    methods: UseFormReturn<TFieldValues>;
    onSubmitAction: (data: TFieldValues) => Promise<void>;
    isMutating?: boolean;
    submitLabel: string;
    processingLabel: string;
    onCancel?: () => void;
  };

export function __Domain__Form<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
  ...fieldsProps
}: __Domain__FormProps<TFieldValues>) {
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
      <__Domain__Fields<TFieldValues>
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
