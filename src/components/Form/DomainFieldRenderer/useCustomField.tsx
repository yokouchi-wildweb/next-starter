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
  const domainFieldsWithIndex = useMemo(() => {
    const sourceFields = domainFields ?? [];
    return sourceFields.map((field, index) => {
      if (typeof field.domainFieldIndex === "number") {
        return field;
      }
      return {
        ...field,
        domainFieldIndex: index,
      };
    });
  }, [domainFields]);

  const filteredDomainJsonFields = useMemo(
    () => domainFieldsWithIndex.filter((field) => field.name !== targetFieldName),
    [domainFieldsWithIndex, targetFieldName],
  );

  const customFields = useMemo(() => {
    const target = domainFieldsWithIndex.find((field) => field.name === targetFieldName);
    if (!target) {
      return baseFields;
    }
    const domainFieldIndex = target.domainFieldIndex;
    const builtField = buildFieldConfig(target);
    const normalizedField =
      typeof domainFieldIndex === "number"
        ? { ...builtField, domainFieldIndex }
        : builtField;
    return [...baseFields, normalizedField];
  }, [baseFields, buildFieldConfig, domainFieldsWithIndex, targetFieldName]);

  return { customFields, filteredDomainJsonFields };
};
