"use client";

import type { FieldPath, FieldValues } from "react-hook-form";

import type { DomainFieldRenderConfig } from "./fieldTypes";
import type { DomainJsonField } from "./fieldMapper";
import { useCustomField } from "./useCustomField";

export type MediaFieldMetadataHandler<TFieldValues extends FieldValues> = (
  metadata: unknown,
) => void;

export type UseMediaFieldHandlerOptions<TFieldValues extends FieldValues> = {
  domainFields?: DomainJsonField[];
  targetFieldName: string;
  onMetadataChange: MediaFieldMetadataHandler<TFieldValues>;
  baseFields?: DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>[];
};

export const useMediaFieldHandler = <TFieldValues extends FieldValues>({
  domainFields,
  targetFieldName,
  onMetadataChange,
  baseFields,
}: UseMediaFieldHandlerOptions<TFieldValues>) => {
  return useCustomField<TFieldValues>({
    domainFields,
    targetFieldName,
    baseFields,
    buildFieldConfig: (field) => ({
      type: "mediaUploader",
      name: field.name as FieldPath<TFieldValues>,
      label: field.label,
      uploadPath: field.uploadPath ?? "",
      accept: field.accept,
      helperText: field.helperText,
      validationRule: field.validationRule,
      onMetadataChange,
    }),
  });
};
