// src/features/cardRarity/components/common/CardRarityForm.tsx

"use client";

import { Button } from "@/components/Form/Button";
import { Form } from "@/components/Shadcn/form";
import { CardRarityFields } from "./CardRarityFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type { Options } from "@/types/form";
import { useRouteTransitionPending } from "@/hooks/useRouteTransitionPending";

export type CardRarityFormProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmitAction: (data: TFieldValues) => Promise<void>;
  titleOptions: Options[];
  isMutating?: boolean;
  submitLabel: string;
  processingLabel: string;
  onCancel?: () => void;
};

export function CardRarityForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  titleOptions,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
}: CardRarityFormProps<TFieldValues>) {
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
        <CardRarityFields<TFieldValues> control={control} titleOptions={titleOptions} />
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
