import { isArrayFieldType } from "@/lib/domain/fields/fieldTypes.mjs";
import type { DataTableColumn } from "@/lib/tableSuite";
import { formatDateJa } from "@/utils/date";
import { truncateJapanese } from "@/utils/string";
import type { FieldPresenter } from "./formatters";
import { formatMediaThumbnail, formatMediaThumbnails } from "./media";

type FieldOption = {
  readonly value: unknown;
  readonly label?: string;
};

type DomainFieldConfig = {
  name: string;
  label?: string;
  formInput?: string;
  fieldType?: string;
  options?: readonly FieldOption[];
};

type DomainRelationConfig = {
  fieldName: string;
  label?: string;
};

type DomainJsonConfig = {
  tableFields?: unknown;
  fields?: readonly DomainFieldConfig[];
  relations?: readonly DomainRelationConfig[];
  [key: string]: unknown;
};

type BuildDomainColumnsParams<T> = {
  config: DomainJsonConfig;
  actionColumn?: DataTableColumn<T>;
  truncateLength?: number;
  presenters?: Record<string, FieldPresenter<T>>;
  /**
   * ソート可能にするフィールド名の配列。
   * 指定されたフィールドの DataTableColumn に sortKey が自動設定される。
   * true を渡すと tableFields の全フィールドをソート可能にする（画像・配列フィールドは自動除外）。
   * 値が配列の型（array・stringArray）の列は、名前で指定してもソートしない。
   */
  sortableFields?: string[] | true;
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

  if (inputType === "mediaUploader" || inputType === "fileUploader") {
    return formatMediaThumbnail(value);
  }

  if (inputType === "mediaUploaderMulti") {
    return formatMediaThumbnails(value);
  }

  return String(value ?? "");
}

const UNSORTABLE_INPUT_TYPES = new Set(["mediaUploader", "mediaUploaderMulti", "fileUploader"]);

function resolveSortKey(
  field: string,
  sortableFields: string[] | true | undefined,
  inputType: string | undefined,
  fieldType: string | undefined,
): string | undefined {
  if (!sortableFields) return undefined;
  // 値が配列の型（型の表の array 属性）は並べ替えない。辞書順の比較は先頭要素で並ぶだけで意味が無い。列名で指定しても同じ
  if (isArrayFieldType(fieldType)) return undefined;

  if (sortableFields === true) {
    if (inputType && UNSORTABLE_INPUT_TYPES.has(inputType)) return undefined;
    return field;
  }

  return sortableFields.includes(field) ? field : undefined;
}

export function buildDomainColumns<T>({
  config,
  actionColumn,
  truncateLength = 30,
  presenters,
  sortableFields,
}: BuildDomainColumnsParams<T>): DataTableColumn<T>[] {
  const tableFields = Array.isArray(config.tableFields) ? (config.tableFields as string[]) : [];
  const { labelMap, inputMap, optionLabelMap } = buildLabelMap(config);

  const fieldTypeMap: Record<string, string> = {};
  (config.fields ?? []).forEach(({ name, fieldType }) => {
    if (fieldType) fieldTypeMap[name] = fieldType;
  });

  const columns = tableFields.map<DataTableColumn<T>>((field) => ({
    header: labelMap[field] ?? field,
    sortKey: resolveSortKey(field, sortableFields, inputMap[field], fieldTypeMap[field]),
    render: (item: T) => {
      const record = item as Record<string, unknown>;
      const value = record[field];
      const inputType = inputMap[field];
      const presenter = presenters?.[field];
      if (presenter) {
        return presenter({ value, field, record: item });
      }
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
