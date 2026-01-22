// src/features/sample/components/common/SampleFields.tsx

"use client";

import type { FieldValues, UseFormReturn } from "react-hook-form";
import { FieldRenderer, type MediaState } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field";
import { useRelationOptions } from "@/lib/domain/hooks";
import domainConfig from "@/features/sample/domain.json";

export type SampleFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: MediaState | null) => void;
};

export function SampleFields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
}: SampleFieldsProps<TFieldValues>) {
  // リレーション先のデータを自動取得し、insertBefore 形式で返す
  const { insertBefore } = useRelationOptions(domainConfig, { suspense: true });

  return (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={(domainConfig.fields ?? []) as FieldConfig[]}
      insertBefore={insertBefore}
      onMediaStateChange={onMediaStateChange}
    />
  );
}
