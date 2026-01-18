// src/features/sample/components/common/SampleFields.tsx

import { useMemo } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import {
  DomainFieldRenderer,
  type DomainJsonField,
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
  const customFields = useMemo<DomainJsonField[]>(
    () => [
      {
        name: "sample_category_id",
        label: "サンプルカテゴリ",
        formInput: "select",
        options: sampleCategoryOptions as DomainJsonField["options"],
      },
      {
        name: "sample_tag_ids",
        label: "サンプルタグ",
        formInput: "checkbox",
        fieldType: "array",
        options: sampleTagOptions as DomainJsonField["options"],
      }
    ],
    [sampleCategoryOptions, sampleTagOptions],
  );

  return (
    <DomainFieldRenderer
      control={methods.control}
      methods={methods}
      customFields={customFields}
      domainJsonFields={(domainConfig.fields ?? []) as DomainJsonField[]}
      onMediaStateChange={onMediaStateChange}
    />
  );
}
