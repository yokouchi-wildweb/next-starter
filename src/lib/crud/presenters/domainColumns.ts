import { isArrayFieldType } from "@/lib/domain/fields/fieldTypes.mjs";
import { presenterFor } from "@/lib/domain/fields/presenterFor.mjs";
import type { DataTableColumn } from "@/lib/tableSuite";
import { formatDateJa } from "@/utils/date";
import { truncateJapanese } from "@/utils/string";
import type { FieldPresenter } from "./formatters";
import { formatCollectionThumbnails, formatMediaThumbnail, formatMediaThumbnails } from "./media";

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

const formatDate = (value: unknown, format: string) => formatDateJa(value, { format, fallback: null });

/**
 * presenters を渡していない列の表示。domain.json の項目は生成の presenters.ts と同じ答え（presenterFor）で描く。
 * 一覧特有の扱い: 空・null は空欄（presenters の "―" ではなく ""）、textarea の文字列は切り詰める、値が Date なら日付。
 * 項目でない列（リレーション・id）と createdAt / updatedAt は presenterFor の外
 */
function renderValue({
  value,
  field,
  fieldConfig,
  truncateLength,
}: {
  value: unknown;
  field: string;
  fieldConfig?: DomainFieldConfig;
  truncateLength: number;
}) {
  if (field === "createdAt" || field === "updatedAt") return formatDate(value, "YYYY/MM/DD HH:mm");
  if (!fieldConfig) {
    if (value instanceof Date) return formatDate(value, "YYYY/MM/DD");
    return String(value ?? "");
  }

  const spec = presenterFor(fieldConfig);
  if (spec.kind === "enum") {
    if (value == null) return "";
    const option = spec.options?.find((o) => String(o.value) === String(value));
    return option ? (option.label ?? String(option.value)) : String(value);
  }
  if (spec.kind === "datetime") return formatDate(value, "YYYY/MM/DD HH:mm");
  if (spec.kind === "date" || value instanceof Date) return formatDate(value, "YYYY/MM/DD");

  switch (spec.kind) {
    case "boolean":
      return value == null ? "" : value ? "はい" : "いいえ";
    case "number":
      return value != null ? Number(value).toLocaleString() : "";
    case "stringArray":
      return Array.isArray(value) ? value.map((item) => String(item)).join(", ") : String(value ?? "");
    case "collectionThumbnails":
      return formatCollectionThumbnails(value);
    case "mediaThumbnails":
      return formatMediaThumbnails(value);
    case "mediaThumbnail":
      return formatMediaThumbnail(value);
    default:
      if (fieldConfig.formInput === "textarea") return truncateJapanese(String(value ?? ""), truncateLength);
      return String(value ?? "");
  }
}

const UNSORTABLE_INPUT_TYPES = new Set(["mediaUploader", "mediaUploaderMulti"]);

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
  const { labelMap, inputMap } = buildLabelMap(config);
  const fieldConfigMap = new Map((config.fields ?? []).map((f) => [f.name, f]));

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
      const presenter = presenters?.[field];
      if (presenter) {
        return presenter({ value, field, record: item });
      }
      return renderValue({ value, field, fieldConfig: fieldConfigMap.get(field), truncateLength });
    },
  }));

  if (actionColumn) {
    columns.push(actionColumn);
  }

  return columns;
}
