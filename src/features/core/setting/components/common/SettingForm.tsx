// src/features/setting/components/common/SettingForm.tsx

"use client";

import type { ReactNode } from "react";
import { useCallback } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { SettingFields } from "./SettingFields";

export type SettingFormProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmitAction: (data: TFieldValues) => Promise<void>;
  isMutating?: boolean;
  submitLabel: string;
  /** 拡張設定フィールド用のスロット（ダウンストリームが自由にUIを構成する） */
  children?: ReactNode;
};

export function SettingForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
  children,
}: SettingFormProps<TFieldValues>) {
  const {
    control,
    formState: { isSubmitting },
  } = methods;

  const loading = isSubmitting || isMutating;

  const handleSubmit = useCallback(
    async (data: TFieldValues) => {
      await onSubmitAction(data);
    },
    [onSubmitAction],
  );

  const handleCancel = useCallback(() => {
    methods.reset();
  }, [methods]);

  return (
    <AppForm
      methods={methods}
      onSubmit={handleSubmit}
      pending={loading}
      fieldSpace={6}
    >
      <SettingFields<TFieldValues> control={control} />
      {children}
      <div className="flex justify-center">
        <Button type="submit" disabled={loading} variant="default">
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancel} className="ml-4">
          キャンセル
        </Button>
      </div>
    </AppForm>
  );
}
