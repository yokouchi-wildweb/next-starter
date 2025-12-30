// src/features/foo/components/common/FooFields.tsx

import { useMemo } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import {
  DomainFieldRenderer,
  type DomainFieldRenderConfig,
  type DomainMediaState,
} from "@/components/Form/DomainFieldRenderer";
import type { Options } from "@/types/form";
import domainConfig from "@/features/foo/domain.json";

export type FooFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: DomainMediaState | null) => void;
  sampleCategoryOptions?: Options[];
};

export function FooFields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
  sampleCategoryOptions,
}: FooFieldsProps<TFieldValues>) {
  const relationFieldConfigs = useMemo<DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>[]>(
    () => [
      {
        type: "select",
        name: "sample_category_id" as FieldPath<TFieldValues>,
        label: "category",
        options: sampleCategoryOptions,
      }
    ],
    [sampleCategoryOptions],
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