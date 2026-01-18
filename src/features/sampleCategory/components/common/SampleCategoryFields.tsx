// src/features/sampleCategory/components/common/SampleCategoryFields.tsx

import type { FieldValues, UseFormReturn } from "react-hook-form";
import { FieldRenderer, type MediaState } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field";
import domainConfig from "@/features/sampleCategory/domain.json";

export type SampleCategoryFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: MediaState | null) => void;
};

export function SampleCategoryFields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
}: SampleCategoryFieldsProps<TFieldValues>) {
  return (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={(domainConfig.fields ?? []) as FieldConfig[]}
      onMediaStateChange={onMediaStateChange}
    />
  );
}
