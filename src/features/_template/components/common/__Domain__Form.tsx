// src/features/__domain__/components/common/__Domain__Form.tsx

"use client";

import { Button } from "@/components/Form/Button";
import { Form } from "@/components/Shadcn/form";
import { __Domain__Fields, type __Domain__FieldsProps } from "./__Domain__Fields";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useRouteTransitionPending } from "@/hooks/useRouteTransitionPending";

export type __Domain__FormProps<TFieldValues extends FieldValues> =
  Omit<__Domain__FieldsProps<TFieldValues>, 'control'> & {
    methods: UseFormReturn<TFieldValues>;
    onSubmitAction: (data: TFieldValues) => Promise<void>;
    isMutating?: boolean;
    submitLabel: string;
    processingLabel: string;
    onCancel?: () => void;
  };

export function __Domain__Form<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
  ...fieldsProps
}: __Domain__FormProps<TFieldValues>) {
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
        <__Domain__Fields<TFieldValues> {...fieldsProps} control={control} />
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
