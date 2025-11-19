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

export type EditableGridTableProps<T> = {
  rows: T[];
  columns: EditableGridColumn<T>[];
  getKey?: (row: T, index: number) => React.Key;
  className?: string;
  onCellChange?: (event: EditableGridCellChangeEvent<T>) => void;
  emptyValueFallback?: string;
  tableLayout?: "auto" | "fixed";
};
