import type { FieldPath, FieldValues } from "react-hook-form";

import type { DomainFieldRenderConfig } from "./fieldTypes";
import type { FileValidationRule } from "@/lib/mediaInputSuite";

export type DomainJsonField = {
  name: string;
  label: string;
  formInput: string;
  uploadPath?: string;
  options?: { value: string | number | boolean; label: string }[];
  helperText?: string;
  accept?: string;
  placeholder?: string;
  validationRule?: FileValidationRule;
  readonly?: boolean;
  domainFieldIndex?: number;
};

export const mapDomainFieldToRenderConfig = (
  field: DomainJsonField,
): DomainFieldRenderConfig<any, any> | null => {
  const base = {
    name: field.name,
    label: field.label,
    readOnly: field.readonly ?? false,
    domainFieldIndex: field.domainFieldIndex,
  };
  switch (field.formInput) {
    case "hidden":
      return { ...base, type: "hidden" };
    case "textInput":
      return { ...base, type: "text" };
    case "numberInput":
      return { ...base, type: "number" };
    case "textarea":
      return { ...base, type: "textarea", placeholder: field.placeholder };
    case "stepperInput":
      return { ...base, type: "stepper" };
    case "switchInput":
      return { ...base, type: "switch" };
    case "radio": {
      const options = (field.options ?? []).map((option) => ({
        value: option.value === true || option.value === "true",
        label: option.label,
      }));
      return { ...base, type: "radioBoolean", options };
    }
    case "select":
      return { ...base, type: "select", options: field.options ?? [] };
    case "multiSelect":
      return {
        ...base,
        type: "multiSelect",
        options: field.options ?? [],
        placeholder: field.placeholder,
      };
    case "mediaUploader":
      return {
        ...base,
        type: "mediaUploader",
        uploadPath: field.uploadPath ?? "",
        helperText: field.helperText,
        accept: field.accept,
        validationRule: field.validationRule,
      };
    default:
      return null;
  }
};

export function buildFieldConfigsFromDomainJson<TFieldValues extends FieldValues>(
  fields: DomainJsonField[],
): DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>[] {
  return fields
    .map((field, index) => {
      const domainFieldIndex =
        typeof field.domainFieldIndex === "number" ? field.domainFieldIndex : index;
      const config = mapDomainFieldToRenderConfig(field);
      if (!config) return null;
      return {
        ...config,
        name: field.name as FieldPath<TFieldValues>,
        domainFieldIndex,
      } as DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>>;
    })
    .filter(
      (config): config is DomainFieldRenderConfig<TFieldValues, FieldPath<TFieldValues>> => config !== null,
    );
}
