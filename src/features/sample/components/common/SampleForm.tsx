// src/features/sample/components/common/SampleForm.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { SampleFields } from "./SampleFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type SampleFormProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmitAction: (data: TFieldValues) => Promise<void>;
  isMutating?: boolean;
  submitLabel: string;
  onCancel?: () => void;
};

export function SampleForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  onCancel,
}: SampleFormProps<TFieldValues>) {
  return (
    <AppForm
      methods={methods}
      onSubmit={onSubmitAction}
      pending={isMutating}
      fieldSpace={6}
    >
      <SampleFields<TFieldValues> methods={methods} />
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
