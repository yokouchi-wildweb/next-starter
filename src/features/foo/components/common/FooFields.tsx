// src/features/foo/components/common/FooFields.tsx

import { useMemo } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import {
  DomainFieldRenderer,
  type DomainFieldRenderConfig,
  type DomainMediaState,
  useMediaFieldHandler,
} from "@/components/Form/DomainFieldRenderer";
import { useMediaMetadataBinding } from "@/lib/mediaInputSuite/hooks";
import domainConfig from "@/features/foo/domain.json";

export type FooFieldsProps<TFieldValues extends FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onMediaStateChange?: (state: DomainMediaState | null) => void;
};

export function FooFields<TFieldValues extends FieldValues>({
  methods,
  onMediaStateChange,
}: FooFieldsProps<TFieldValues>) {
  const relationFieldConfigs = useMemo<DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>[]>(
    () => [],
    [],
  );

  const handleMediaMetadata = useMediaMetadataBinding({
    methods,
    binding: {
      sizeBytes: "filesize" as FieldPath<TFieldValues>,
      width: "width" as FieldPath<TFieldValues>,
      mimeType: "mimetype" as FieldPath<TFieldValues>,
    },
  });

  const mediaFieldState0 = useMediaFieldHandler({
    domainFields: domainConfig.fields ?? [],
    targetFieldName: "media",
    baseFields: relationFieldConfigs,
    onMetadataChange: handleMediaMetadata,
  });

  const customFields = mediaFieldState0.customFields;
  const filteredDomainJsonFields = mediaFieldState0.filteredDomainJsonFields;

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