// src/features/cardTag/components/common/CardTagForm.tsx

"use client";

import { Button } from "@/components/Form/Button";
import { Form } from "@/components/Shadcn/form";
import { CardTagFields } from "./CardTagFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useRouteTransitionPending } from "@/hooks/useRouteTransitionPending";

export type CardTagFormProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmitAction: (data: TFieldValues) => Promise<void>;
  isMutating?: boolean;
  submitLabel: string;
  processingLabel: string;
  onCancel?: () => void;
};

export function CardTagForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
}: CardTagFormProps<TFieldValues>) {
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
        <CardTagFields<TFieldValues> control={control} />
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
