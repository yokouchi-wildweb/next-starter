// src/features/bar/components/common/BarForm.tsx

"use client";

import { Button } from "@/components/Form/Button";
import { Form } from "@/components/Shadcn/form";
import { BarFields, type BarFieldsProps } from "./BarFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useState } from "react";
import { useRouteTransitionPending } from "@/hooks/useRouteTransitionPending";

export type BarFormProps<TFieldValues extends FieldValues> =
  Omit<BarFieldsProps<TFieldValues>, 'control'> & {
    methods: UseFormReturn<TFieldValues>;
    onSubmitAction: (data: TFieldValues) => Promise<void>;
    isMutating?: boolean;
    submitLabel: string;
    processingLabel: string;
    onCancel?: () => void;
  };

export function BarForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
  ...fieldsProps
}: BarFormProps<TFieldValues>) {
  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = methods;

  const [imagePending, setImagePending] = useState(false);

  const isRouting = useRouteTransitionPending();
  const loading = isSubmitting || isMutating || imagePending || isRouting;

  // Pass upload pending state directly to fields

  return (
    <Form {...methods}>
      <form onSubmit={handleSubmit(onSubmitAction)} className="space-y-4">
        <BarFields<TFieldValues>
          {...fieldsProps}
          control={control}
          onPendingChange={setImagePending}
        />
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
      </form>
    </Form>
  );
}
