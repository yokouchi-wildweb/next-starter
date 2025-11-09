// src/features/undefined/components/common/SampleCategoryForm.tsx

"use client";

import { Button } from "@/components/Form/button/Button";
import { Form } from "@/components/Shadcn/form";
import { SampleCategoryFields, type SampleCategoryFieldsProps } from "./SampleCategoryFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useRouteTransitionPending } from "@/hooks/useRouteTransitionPending";

export type SampleCategoryFormProps<TFieldValues extends FieldValues> =
  Omit<SampleCategoryFieldsProps<TFieldValues>, 'control'> & {
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
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = methods;

  const isRouting = useRouteTransitionPending();
  const loading = isSubmitting || isMutating || isRouting;

  return (
    <Form {...methods}>
      <form onSubmit={handleSubmit(onSubmitAction)} className="space-y-4">
        <SampleCategoryFields<TFieldValues> {...fieldsProps} control={control} />
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
