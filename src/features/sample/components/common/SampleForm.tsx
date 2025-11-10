// src/features/undefined/components/common/SampleForm.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { SampleFields, type SampleFieldsProps } from "./SampleFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type SampleFormProps<TFieldValues extends FieldValues> =
  Omit<SampleFieldsProps<TFieldValues>, 'control'> & {
    methods: UseFormReturn<TFieldValues>;
    onSubmitAction: (data: TFieldValues) => Promise<void>;
    isMutating?: boolean;
    submitLabel: string;
    processingLabel: string;
    onCancel?: () => void;
  };

export function SampleForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
  ...fieldsProps
}: SampleFormProps<TFieldValues>) {
  const {
    control,
    formState: { isSubmitting },
  } = methods;

  const loading = isSubmitting || isMutating;

  return (
    <AppForm
      methods={methods}
      onSubmit={onSubmitAction}
      pending={isMutating}
      className="space-y-4"
    >
      <SampleFields<TFieldValues> {...fieldsProps} control={control} />
      {onCancel ? (
        <div className="flex gap-2">
          <Button type="submit" disabled={loading} variant="default">
            {loading ? processingLabel : submitLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
        </div>
      ) : (
        <Button type="submit" disabled={loading} variant="default">
          {loading ? processingLabel : submitLabel}
        </Button>
      )}
    </AppForm>
  );
}
