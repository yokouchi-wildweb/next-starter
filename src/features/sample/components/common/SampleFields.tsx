// src/features/sample/components/common/SampleFields.tsx

import { useMemo } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { FieldRenderer, type MediaState } from "@/components/Form/FieldRenderer";
import type { FieldConfig } from "@/components/Form/Field";
import type { Options } from "@/components/Form/types";
import domainConfig from "@/features/sample/domain.json";

export type SampleFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: MediaState | null) => void;
  sampleCategoryOptions?: Options[];
  sampleTagOptions?: Options[];
};

export function SampleFields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
  sampleCategoryOptions,
  sampleTagOptions,
}: SampleFieldsProps<TFieldValues>) {
  const fieldPatches = useMemo<FieldConfig[]>(
    () => [
      {
        name: "sample_category_id",
        label: "サンプルカテゴリ",
        formInput: "select",
        options: sampleCategoryOptions as FieldConfig["options"],
      },
      {
        name: "sample_tag_ids",
        label: "サンプルタグ",
        formInput: "checkbox",
        fieldType: "array",
        options: sampleTagOptions as FieldConfig["options"],
      }
    ],
    [sampleCategoryOptions, sampleTagOptions],
  );

  return (
    <FieldRenderer
      control={methods.control}
      methods={methods}
      fieldPatches={fieldPatches}
      baseFields={(domainConfig.fields ?? []) as FieldConfig[]}
      onMediaStateChange={onMediaStateChange}
    />
  );
}
