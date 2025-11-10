// src/features/setting/components/common/SettingForm.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { SettingFields } from "./SettingFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type SettingFormProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmitAction: (data: TFieldValues) => Promise<void>;
  isMutating?: boolean;
  submitLabel: string;
  processingLabel: string;
};

export function SettingForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  processingLabel,
}: SettingFormProps<TFieldValues>) {
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
      <SettingFields<TFieldValues> control={control} />
      <Button type="submit" disabled={loading} variant="default">
        {loading ? processingLabel : submitLabel}
      </Button>
    </AppForm>
  );
}
