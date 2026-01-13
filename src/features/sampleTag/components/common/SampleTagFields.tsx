// src/features/sampleTag/components/common/SampleTagFields.tsx

import { useMemo } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import {
  DomainFieldRenderer,
  type DomainFieldRenderConfig,
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
  const relationFieldConfigs = useMemo<DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>[]>(
    () => [],
    [],
  );



  const customFields = relationFieldConfigs;
  // domain.json は自動生成ファイルのため、型キャストで対応
  const filteredDomainJsonFields = (domainConfig.fields ?? []) as Parameters<typeof DomainFieldRenderer>["0"]["domainJsonFields"];

  return (
    <DomainFieldRenderer
      control={methods.control}
      methods={methods}
      fields={customFields}
      domainJsonFields={filteredDomainJsonFields}
      onMediaStateChange={onMediaStateChange}
    />
  );
}