// src/features/sampleTag/components/common/SampleTagForm.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { SampleTagFields, type SampleTagFieldsProps } from "./SampleTagFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type SampleTagFormProps<TFieldValues extends FieldValues> =
  Omit<SampleTagFieldsProps<TFieldValues>, "methods" | "onMediaStateChange"> & {
    methods: UseFormReturn<TFieldValues>;
    onSubmitAction: (data: TFieldValues) => Promise<void>;
    isMutating?: boolean;
    submitLabel: string;
    onCancel?: () => void;
  };

export function SampleTagForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  onCancel,
  ...fieldsProps
}: SampleTagFormProps<TFieldValues>) {
  return (
    <AppForm
      methods={methods}
      onSubmit={onSubmitAction}
      pending={isMutating}
      fieldSpace={6}
    >
      <SampleTagFields<TFieldValues> {...fieldsProps} methods={methods} />
      <div className="flex justify-center gap-3">
        <Button type="submit" variant="default">
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
        ) : null}
      </div>
    </AppForm>
  );
}
