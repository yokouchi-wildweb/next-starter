import type { DomainDisplay, DomainDisplayRelation, DomainField } from "@/lib/domain";
import { isArrayFieldType } from "@/lib/domain";
import { presenterFor } from "@/lib/domain";
import type { DataTableColumn } from "@/lib/tableSuite";
import type { FieldPresenter } from "@/lib/domain";
import { formatCollectionThumbnails, formatMediaThumbnail, formatMediaThumbnails } from "./media";

/**
 * 列を作るのに読む項目のキー。entity.json の項目の型(lib/domain の DomainField)から取る。
 * name 以外は省ける(手書きの写し domainDisplay は fieldType を省け、label の無い項目は名前で出す)
 */
type DomainColumnField = Pick<DomainField, "name"> &
  Partial<Pick<DomainField, "label" | "formInput" | "fieldType" | "options">>;

/** 列の見出しに読む関連のキー(写しの関連 DomainDisplayRelation から。label の無い関連は fieldName で出す) */
type DomainColumnRelation = Pick<DomainDisplayRelation, "fieldName"> & Partial<Pick<DomainDisplayRelation, "label">>;

/** 列を作るのに読む設定(写し DomainDisplay か entity.json の、tableFields・fields・relations) */
type DomainJsonConfig = Partial<Pick<DomainDisplay, "tableFields">> & {
  fields?: readonly DomainColumnField[];
  relations?: readonly DomainColumnRelation[];
  [key: string]: unknown;
};

/**
 * 日付を文字にする関数。format は "YYYY/MM/DD" か "YYYY/MM/DD HH:mm"、日付で無い値は fallback(null)を返す。
 * 書き方はアプリのもの(呼び手が @/utils/date の formatDateJa を渡す)
 */
export type DomainColumnDateFormatter = (value: unknown, options: { format: string; fallback: null }) => string | null;

/** textarea の文字列を maxLength 文字に切り詰める関数(呼び手が @/utils/string の truncateJapanese を渡す) */
export type DomainColumnTruncate = (text: string, maxLength: number) => string;

type BuildDomainColumnsParams<T> = {
  config: DomainJsonConfig;
  /** 日付・日時の列の書き方(必須。lib は書き方を持たない) */
  formatDate: DomainColumnDateFormatter;
  /** textarea の列の切り詰め(必須) */
  truncate: DomainColumnTruncate;
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

/**
 * presenters を渡していない列の表示。entity.json の項目は生成の <登録名>Presenters.ts と同じ答え（presenterFor）で描く。
 * 一覧特有の扱い: 空・null は空欄（presenters の "―" ではなく ""）、textarea の文字列は切り詰める、値が Date なら日付。
 * 項目でない列（リレーション・id）と createdAt / updatedAt は presenterFor の外
 */
function renderValue({
  value,
  field,
  fieldConfig,
  truncateLength,
  formatDate: formatDateWith,
  truncate,
}: {
  value: unknown;
  field: string;
  fieldConfig?: DomainColumnField;
  truncateLength: number;
  formatDate: DomainColumnDateFormatter;
  truncate: DomainColumnTruncate;
}) {
  const formatDate = (input: unknown, format: string) => formatDateWith(input, { format, fallback: null });
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
      if (fieldConfig.formInput === "textarea") return truncate(String(value ?? ""), truncateLength);
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
  formatDate,
  truncate,
  actionColumn,
  truncateLength = 30,
  presenters,
  sortableFields,
}: BuildDomainColumnsParams<T>): DataTableColumn<T>[] {
  const tableFields = config.tableFields ?? [];
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
      return renderValue({ value, field, fieldConfig: fieldConfigMap.get(field), truncateLength, formatDate, truncate });
    },
  }));

  if (actionColumn) {
    columns.push(actionColumn);
  }

  return columns;
}
