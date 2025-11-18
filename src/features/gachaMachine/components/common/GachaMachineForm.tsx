// src/features/undefined/components/common/GachaMachineForm.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "../../../../components/Form/Button/Button";
import { GachaMachineFields, type GachaMachineFieldsProps } from "./GachaMachineFields";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useState } from "react";

export type GachaMachineFormProps<TFieldValues extends FieldValues> =
  Omit<GachaMachineFieldsProps<TFieldValues>, 'control'> & {
    methods: UseFormReturn<TFieldValues>;
    onSubmitAction: (data: TFieldValues) => Promise<void>;
    isMutating?: boolean;
    submitLabel: string;
    processingLabel: string;
    onCancel?: () => void;
  };

export function GachaMachineForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  processingLabel,
  onCancel,
  ...fieldsProps
}: GachaMachineFormProps<TFieldValues>) {
  const {
    control,
    formState: { isSubmitting },
  } = methods;

  const [imagePending, setImagePending] = useState(false);

  const loading = isSubmitting || isMutating || imagePending;

  return (
    <AppForm
      methods={methods}
      onSubmit={onSubmitAction}
      pending={isMutating}
      fieldSpace="md"
    >
      <GachaMachineFields<TFieldValues> {...fieldsProps} control={control} />
      <div className="flex justify-center gap-3">
        <Button type="submit" disabled={loading} variant="default">
          {loading ? processingLabel : submitLabel}
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
