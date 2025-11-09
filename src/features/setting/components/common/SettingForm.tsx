// src/features/setting/components/common/SettingForm.tsx

"use client";

import { Button } from "@/components/Form/button/Button";
import { Form } from "@/components/Shadcn/form";
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
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = methods;

  const loading = isSubmitting || isMutating;

  return (
    <Form {...methods}>
      <form onSubmit={handleSubmit(onSubmitAction)} className="space-y-4">
        <SettingFields<TFieldValues> control={control} />
        <Button type="submit" disabled={loading} variant="default">
          {loading ? processingLabel : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
