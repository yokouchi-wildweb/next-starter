// src/features/sampleTag/components/common/SampleTagFields.tsx

import type { FieldValues, UseFormReturn } from "react-hook-form";
import { FieldRenderer, type MediaState } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field";
import domainConfig from "@/features/sampleTag/domain.json";

export type SampleTagFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: MediaState | null) => void;
};

export function SampleTagFields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
}: SampleTagFieldsProps<TFieldValues>) {
  return (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      baseFields={(domainConfig.fields ?? []) as FieldConfig[]}
      onMediaStateChange={onMediaStateChange}
    />
  );
}
