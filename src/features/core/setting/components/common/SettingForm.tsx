// src/features/setting/components/common/SettingForm.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { SettingFields } from "./SettingFields";
import { FieldRenderer } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useCallback } from "react";
import settingFieldsJson from "../../setting-fields.json";

// setting-fields.json のフィールド型定義
type SettingJsonField = {
  name: string;
  label: string;
  formInput: string;
  fieldType: string;
  options?: Array<{ value: string; label: string }>;
  uploadPath?: string;
  accept?: string;
  description?: string;
};

// setting-fields.json を FieldConfig[] 形式に変換
const extendedFields = (settingFieldsJson.fields as SettingJsonField[]).map((field) => ({
  name: field.name,
  label: field.label,
  formInput: field.formInput,
  fieldType: field.fieldType,
  options: field.options,
  uploadPath: field.uploadPath,
  accept: field.accept,
  helperText: field.description,
})) as FieldConfig[];

export type SettingFormProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmitAction: (data: TFieldValues) => Promise<void>;
  isMutating?: boolean;
  submitLabel: string;
};

export function SettingForm<TFieldValues extends FieldValues>({
  methods,
  onSubmitAction,
  isMutating = false,
  submitLabel,
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
      {/* 拡張設定フィールド（setting-fields.json から動的レンダリング） */}
      <FieldRenderer<TFieldValues>
        control={control}
        methods={methods}
        baseFields={extendedFields}
      />
      <div className="flex justify-center">
        <Button type="submit" disabled={loading} variant="default">
        </Button>
        <Button type="button" variant="outline" onClick={handleCancel} className="ml-4">
          キャンセル
        </Button>
      </div>
    </AppForm>
  );
}
