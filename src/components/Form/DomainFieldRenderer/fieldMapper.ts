import type { FieldPath, FieldValues } from "react-hook-form";

import type { DomainFieldRenderConfig } from "./fieldTypes";
import type { DomainJsonField } from "./types";
import type { RadioGroupDisplayType } from "@/components/Form/Input/Manual/RadioGroupInput";
import type { CheckGroupDisplayType } from "@/components/Form/Input/Manual/CheckGroupInput";

// 型の re-export
export type { DomainJsonField, DomainFormInput, DomainFieldType } from "./types";

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
    case "dateInput":
      return { ...base, type: "date" };
    case "timeInput":
      return { ...base, type: "time" };
    case "datetimeInput":
      return { ...base, type: "datetime" };
    case "emailInput":
      return { ...base, type: "email" };
    case "passwordInput":
      return { ...base, type: "password" };
    case "radio": {
      const options = (field.options ?? []).map((option) => {
        let normalizedValue: string | number | boolean = option.value as any;
        if (option.value === true || option.value === "true") {
          normalizedValue = true;
        } else if (option.value === false || option.value === "false") {
          normalizedValue = false;
        }
        return {
          value: normalizedValue,
          label: option.label,
        };
      });
      return {
        ...base,
        type: "radio",
        options,
        displayType: (field.displayType as RadioGroupDisplayType | undefined) ?? "standard",
      };
    }
    case "checkbox": {
      if (field.fieldType === "array") {
        return {
          ...base,
          type: "checkGroup",
          options: [...(field.options ?? [])],
          displayType: (field.displayType as CheckGroupDisplayType | undefined) ?? "standard",
        };
      }
      return { ...base, type: "booleanCheckbox" };
    }
    case "select":
      return { ...base, type: "select", options: [...(field.options ?? [])] };
    case "multiSelect":
      return {
        ...base,
        type: "multiSelect",
        options: [...(field.options ?? [])],
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
