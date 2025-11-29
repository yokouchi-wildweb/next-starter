// src/features/foo/components/common/FooFields.tsx

import { useMemo } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import {
  DomainFieldRenderer,
  type DomainFieldRenderConfig,
  type DomainMediaState,
} from "@/components/Form/DomainFieldRenderer";
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

  return (
    <DomainFieldRenderer
      control={methods.control}
      methods={methods}
      fields={relationFieldConfigs}
      domainJsonFields={domainConfig.fields ?? []}
      onMediaStateChange={onMediaStateChange}
    />
  );
}