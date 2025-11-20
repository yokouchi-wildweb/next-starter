import type React from "react";

import type { Options } from "@/types/form";

export type EditableGridEditorType = "text" | "number" | "select" | "date" | "time" | "datetime";

export type EditableGridColumn<T> = {
  field: string;
  header: string;
  editorType: EditableGridEditorType;
  placeholder?: string;
  width?: string;
  options?: Options[];
  getValue?: (row: T) => unknown;
  formatValue?: (value: unknown, row: T) => string;
  parseValue?: (value: string, row: T) => unknown;
  validator?: (value: unknown, row: T) => string | null;
  renderDisplay?: (value: unknown, row: T) => React.ReactNode;
};

export type EditableGridCellChangeEvent<T> = {
  rowKey: React.Key;
  field: string;
  value: unknown;
  row: T;
};

export type EditableGridOrderRule<T> = {
  field: EditableGridColumn<T>["field"];
  direction?: "asc" | "desc";
};

export type EditableGridTableProps<T> = {
  rows: T[];
  columns: EditableGridColumn<T>[];
  getKey?: (row: T, index: number) => React.Key;
  className?: string;
  onCellChange?: (event: EditableGridCellChangeEvent<T>) => void;
  emptyValueFallback?: string;
  tableLayout?: "auto" | "fixed";
  /**
   * true の場合、order で指定された条件に基づいて rows を並び替えて表示する。
   */
  autoSort?: boolean;
  /**
   * autoSort 時に適用する並び替え条件。配列の先頭ほど優先順位が高い。
   */
  order?: EditableGridOrderRule<T>[];
};
