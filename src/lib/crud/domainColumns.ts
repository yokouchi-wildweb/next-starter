import React from "react";
import type { DataTableColumn } from "@/components/Tables/DataTable";
import { formatDateJa } from "@/utils/date";
import { truncateJapanese } from "@/utils/string";

type FieldOption = {
  value: string | number | boolean;
  label: string;
};

type DomainFieldConfig = {
  name: string;
  label?: string;
  formInput?: string;
  fieldType?: string;
  options?: FieldOption[];
};

type DomainRelationConfig = {
  fieldName: string;
  label?: string;
};

type DomainJsonConfig = {
  tableFields?: unknown;
  fields?: DomainFieldConfig[];
  relations?: DomainRelationConfig[];
  [key: string]: unknown;
};

type BuildDomainColumnsParams<T> = {
  config: DomainJsonConfig;
  actionColumn?: DataTableColumn<T>;
  truncateLength?: number;
};

function buildLabelMap(config: DomainJsonConfig): {
  labelMap: Record<string, string>;
  inputMap: Record<string, string>;
  optionLabelMap: Record<string, Record<string, string>>;
} {
  const labelMap: Record<string, string> = {};
  const inputMap: Record<string, string> = {};
  const optionLabelMap: Record<string, Record<string, string>> = {};

  (config.fields ?? []).forEach(({ name, label, formInput, fieldType, options }) => {
    labelMap[name] = label ?? name;
    if (formInput) {
      inputMap[name] = formInput;
    }

    if (fieldType === "enum" && Array.isArray(options) && options.length > 0) {
      optionLabelMap[name] = options.reduce<Record<string, string>>((acc, option) => {
        acc[String(option.value)] = option.label ?? String(option.value);
        return acc;
      }, {});
    }
  });

  (config.relations ?? []).forEach(({ fieldName, label }) => {
    labelMap[fieldName] = label ?? fieldName;
  });

  labelMap.id = labelMap.id ?? "ID";
  labelMap.createdAt = labelMap.createdAt ?? "作成日時";
  labelMap.updatedAt = labelMap.updatedAt ?? "更新日時";

  return { labelMap, inputMap, optionLabelMap };
}

function renderValue({
  value,
  field,
  inputType,
  truncateLength,
  options,
}: {
  value: unknown;
  field: string;
  inputType?: string;
  truncateLength: number;
  options?: Record<string, string>;
}) {
  if (options) {
    if (value == null) return "";
    return options[String(value)] ?? String(value);
  }

  const isDatetimeField =
    field === "createdAt" ||
    field === "updatedAt" ||
    inputType === "datetimeInput";
  const isDateField = inputType === "dateInput";

  if (value instanceof Date || isDatetimeField || isDateField) {
    const format = isDatetimeField ? "YYYY/MM/DD HH:mm" : "YYYY/MM/DD";
    return formatDateJa(value, { format, fallback: null });
  }

  if (inputType === "numberInput" || inputType === "stepperInput") {
    return value != null ? Number(value).toLocaleString() : "";
  }

  if (inputType === "textarea") {
    return truncateJapanese(String(value ?? ""), truncateLength);
  }

  if (inputType === "imageUploader" || inputType === "fileUploader") {
    return value
      ? React.createElement("img", {
          src: String(value),
          alt: "",
          className: "mx-auto h-12 w-12 object-cover",
        })
      : null;
  }

  return String(value ?? "");
}

export function buildDomainColumns<T>({
  config,
  actionColumn,
  truncateLength = 30,
}: BuildDomainColumnsParams<T>): DataTableColumn<T>[] {
  const tableFields = Array.isArray(config.tableFields) ? (config.tableFields as string[]) : [];
  const { labelMap, inputMap, optionLabelMap } = buildLabelMap(config);

  const columns = tableFields.map<DataTableColumn<T>>((field) => ({
    header: labelMap[field] ?? field,
    render: (item: T) => {
      const record = item as Record<string, unknown>;
      const value = record[field];
      const inputType = inputMap[field];
      return renderValue({
        value,
        field,
        inputType,
        truncateLength,
        options: optionLabelMap[field],
      });
    },
  }));

  if (actionColumn) {
    columns.push(actionColumn);
  }

  return columns;
}
