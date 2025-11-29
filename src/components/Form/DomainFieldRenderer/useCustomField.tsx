"use client";

import { useMemo } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";

import type { DomainJsonField } from "./fieldMapper";
import type { DomainFieldRenderConfig } from "./fieldTypes";

export type UseCustomFieldOptions<TFieldValues extends FieldValues> = {
  domainFields?: DomainJsonField[];
  targetFieldName: string;
  buildFieldConfig: (
    field: DomainJsonField,
  ) => DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>;
  baseFields?: DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>[];
};

export const useCustomField = <TFieldValues extends FieldValues>({
  domainFields,
  targetFieldName,
  buildFieldConfig,
  baseFields = [],
}: UseCustomFieldOptions<TFieldValues>) => {
  const fields = domainFields ?? [];

  const filteredDomainJsonFields = useMemo(
    () => fields.filter((field) => field.name !== targetFieldName),
    [fields, targetFieldName],
  );

  const customFields = useMemo(() => {
    const target = fields.find((field) => field.name === targetFieldName);
    if (!target) {
      return baseFields;
    }
    return [...baseFields, buildFieldConfig(target)];
  }, [baseFields, buildFieldConfig, fields, targetFieldName]);

  return { customFields, filteredDomainJsonFields };
};

