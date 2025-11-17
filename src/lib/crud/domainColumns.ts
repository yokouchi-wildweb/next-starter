import React from "react";
import type { DataTableColumn } from "@/components/DataTable";
import { formatDateJa } from "@/utils/date";
import { truncateJapanese } from "@/utils/string";

type DomainFieldConfig = {
  name: string;
  label?: string;
  formInput?: string;
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
} {
  const labelMap: Record<string, string> = {};
  const inputMap: Record<string, string> = {};

  (config.fields ?? []).forEach(({ name, label, formInput }) => {
    labelMap[name] = label ?? name;
    if (formInput) {
      inputMap[name] = formInput;
    }
  });

  (config.relations ?? []).forEach(({ fieldName, label }) => {
    labelMap[fieldName] = label ?? fieldName;
  });

  labelMap.id = labelMap.id ?? "ID";
  labelMap.createdAt = labelMap.createdAt ?? "作成日時";
  labelMap.updatedAt = labelMap.updatedAt ?? "更新日時";

  return { labelMap, inputMap };
}

function renderValue(value: unknown, field: string, inputType: string | undefined, truncateLength: number) {
  const isDatetimeField =
    field === "createdAt" ||
    field === "updatedAt" ||
    inputType === "datetimeInput";
  const isDateField = inputType === "dateInput";

  if (value instanceof Date || isDatetimeField || isDateField) {
    const format = isDatetimeField ? "YYYY/MM/DD HH:mm" : "YYYY/MM/DD";
    return formatDateJa(value, { format });
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
  const { labelMap, inputMap } = buildLabelMap(config);

  const columns = tableFields.map<DataTableColumn<T>>((field) => ({
    header: labelMap[field] ?? field,
    render: (item: T) => {
      const record = item as Record<string, unknown>;
      const value = record[field];
      const inputType = inputMap[field];
      return renderValue(value, field, inputType, truncateLength);
    },
  }));

  if (actionColumn) {
    columns.push(actionColumn);
  }

  return columns;
}
