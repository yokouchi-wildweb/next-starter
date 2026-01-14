// src/features/sample/components/common/SampleFields.tsx

import { useMemo } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import {
  DomainFieldRenderer,
  type DomainFieldRenderConfig,
  type DomainMediaState,
} from "@/components/Form/DomainFieldRenderer";
import type { Options } from "@/components/Form/types";
import domainConfig from "@/features/sample/domain.json";

export type SampleFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: DomainMediaState | null) => void;
  sampleCategoryOptions?: Options[];
  sampleTagOptions?: Options[];
};

export function SampleFields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
  sampleCategoryOptions,
  sampleTagOptions,
}: SampleFieldsProps<TFieldValues>) {
  const relationFieldConfigs = useMemo<DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>[]>(
    () => [
      {
        type: "select",
        name: "sample_category_id" as FieldPath<TFieldValues>,
        label: "サンプルカテゴリ",
        options: sampleCategoryOptions,
      },
      {
        type: "checkGroup",
        name: "sample_tag_ids" as FieldPath<TFieldValues>,
        label: "サンプルタグ",
        options: sampleTagOptions,
      }
    ],
    [sampleCategoryOptions, sampleTagOptions],
  );



  const customFields = relationFieldConfigs;
  const filteredDomainJsonFields = domainConfig.fields ?? [];

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