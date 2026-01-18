// src/features/sampleTag/components/common/SampleTagFields.tsx

import { useMemo } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import {
  DomainFieldRenderer,
  type DomainJsonField,
  type DomainMediaState,
} from "@/components/Form/DomainFieldRenderer";
import domainConfig from "@/features/sampleTag/domain.json";

export type SampleTagFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: DomainMediaState | null) => void;
};

export function SampleTagFields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
}: SampleTagFieldsProps<TFieldValues>) {
  const customFields = useMemo<DomainJsonField[]>(
    () => [],
    [],
  );

  return (
    <DomainFieldRenderer
      control={methods.control}
      methods={methods}
      customFields={customFields}
      domainJsonFields={domainConfig.fields ?? []}
      onMediaStateChange={onMediaStateChange}
    />
  );
}
