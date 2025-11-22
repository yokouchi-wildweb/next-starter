// src/lib/tableSuite/types.ts

export type TableRowClassContext = {
  index: number;
  /**
   * RecordSelectionTable など、選択状態を持つテーブルが値を設定する。
   * DataTable / EditableGridTable のように選択状態を持たない場合は undefined。
   */
  selected?: boolean;
};

export type RowClassNameResolver<T> =
  | string
  | ((item: T, context: TableRowClassContext) => string | undefined);

export type TableStylingProps<T> = {
  /**
   * テーブル全体のラッパー div に適用されるクラス名。
   */
  className?: string;
  /**
   * 行単位で適用するクラス名。関数を渡すと行ごとに計算できる。
   */
  rowClassName?: RowClassNameResolver<T>;
};

export type TableColumnAlignment = "left" | "center" | "right";

const columnTextAlignClassMap: Record<TableColumnAlignment, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const columnFlexAlignClassMap: Record<TableColumnAlignment, string> = {
  left: "justify-start text-left",
  center: "justify-center text-center",
  right: "justify-end text-right",
};

export const resolveRowClassName = <T,>(
  rowClassName: RowClassNameResolver<T> | undefined,
  item: T,
  context: TableRowClassContext,
) => {
  if (!rowClassName) {
    return undefined;
  }
  if (typeof rowClassName === "function") {
    return rowClassName(item, context) ?? undefined;
  }
  return rowClassName;
};

export const resolveColumnTextAlignClass = (align?: TableColumnAlignment) => {
  if (!align) {
    return undefined;
  }
  return columnTextAlignClassMap[align];
};

export const resolveColumnFlexAlignClass = (align?: TableColumnAlignment) => {
  if (!align) {
    return undefined;
  }
  return columnFlexAlignClassMap[align];
};
