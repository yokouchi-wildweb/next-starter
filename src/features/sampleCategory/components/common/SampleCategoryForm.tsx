// src/features/sampleCategory/components/common/SampleCategoryForm.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { SampleCategoryFields } from "./SampleCategoryFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type SampleCategoryFormProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmitAction: (data: TFieldValues) => Promise<void>;
  isMutating?: boolean;
  submitLabel: string;
  onCancel?: () => void;
};

export function SampleCategoryForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  onCancel,
}: SampleCategoryFormProps<TFieldValues>) {
  return (
    <AppForm
      methods={methods}
      onSubmit={onSubmitAction}
      pending={isMutating}
      fieldSpace={6}
    >
      <SampleCategoryFields<TFieldValues> methods={methods} />
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
