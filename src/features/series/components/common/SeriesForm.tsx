// src/features/series/components/common/SeriesForm.tsx

"use client";

import { Button } from "@/components/Form/Button";
import { Form } from "@/components/Shadcn/form";
import { SeriesFields } from "./SeriesFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type { Options } from "@/types/form";
import { useRouteTransitionPending } from "@/hooks/useRouteTransitionPending";

export type SeriesFormProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmitAction: (data: TFieldValues) => Promise<void>;
  titleOptions: Options[];
  isMutating?: boolean;
  submitLabel: string;
  processingLabel: string;
  onCancel?: () => void;
};

export function SeriesForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  titleOptions,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
}: SeriesFormProps<TFieldValues>) {
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
        <SeriesFields<TFieldValues> control={control} titleOptions={titleOptions} />
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
