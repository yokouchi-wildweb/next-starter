// src/features/card/components/common/CardForm.tsx

"use client";

import { Button } from "@/components/Form/Button";
import { Form } from "@/components/Shadcn/form";
import { CardFields } from "./CardFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type { Options } from "@/types/form";
import { useState } from "react";
import { useRouteTransitionPending } from "@/hooks/useRouteTransitionPending";

export type CardFormProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmitAction: (data: TFieldValues) => Promise<void>;
  titleOptions: Options[];
  rarityOptions: Options[];
  tagOptions: Options[];
  seriesOptions: Options[];
  /** 編集時に表示する既存画像 URL */
  mainImageUrl?: string | null;
  onUpload: (file: File) => Promise<string>;
  onDelete?: (url: string) => Promise<void>;
  isMutating?: boolean;
  submitLabel: string;
  processingLabel: string;
  onCancel?: () => void | Promise<void>;
};

export function CardForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  titleOptions,
  rarityOptions,
  tagOptions,
  seriesOptions,
  mainImageUrl,
  onUpload,
  onDelete,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
}: CardFormProps<TFieldValues>) {
  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = methods;

  const [imagePending, setImagePending] = useState(false);

  const isRouting = useRouteTransitionPending();
  const loading = isSubmitting || isMutating || imagePending || isRouting;

  return (
    <Form {...methods}>
      <form onSubmit={handleSubmit(onSubmitAction)} className="space-y-4">
        <CardFields<TFieldValues>
          control={control}
          titleOptions={titleOptions}
          rarityOptions={rarityOptions}
          tagOptions={tagOptions}
          seriesOptions={seriesOptions}
          mainImageUrl={mainImageUrl}
          onUpload={onUpload}
          onDelete={onDelete}
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
