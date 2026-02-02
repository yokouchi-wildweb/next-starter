import type React from "react";

import type { Options } from "@/components/Form/types";
import type {
  TableColumnAlignment,
  TableStylingProps,
  TableCellStyleProps,
  PaddingSize,
} from "../types";
import type { CellAction } from "../DataTable";

export type EditableGridEditorType =
  | "text"
  | "number"
  | "select"
  | "multi-select"
  | "date"
  | "time"
  | "datetime"
  | "readonly"
  | "switch"
  | "action";

export type EditableGridColumn<T> = {
  field: string;
  header: React.ReactNode;
  editorType: EditableGridEditorType;
  placeholder?: string;
  width?: string;
  options?: Options[];
  allowNullSelection?: boolean;
  nullOptionLabel?: string;
  getValue?: (row: T) => unknown;
  formatValue?: (value: unknown, row: T) => string;
  parseValue?: (value: unknown, row: T) => unknown;
  validator?: (value: unknown, row: T) => string | null;
  renderDisplay?: (value: unknown, row: T) => React.ReactNode;
  /** action タイプで使用する操作部品のレンダラー */
  renderAction?: (row: T) => React.ReactNode;
  onToggleRequest?: (event: EditableGridSwitchToggleEvent<T>) => boolean | Promise<boolean>;
  align?: TableColumnAlignment;
  /**
   * このカラムの水平パディングを上書き
   */
  paddingX?: PaddingSize;
  /**
   * このカラムの垂直パディングを上書き
   */
  paddingY?: PaddingSize;
  /**
   * readonly セルにクリック可能なオーバーレイを追加する。
   * ホバー時にクリック領域とインジケーターが表示される。
   * editorType: "readonly" の場合のみ有効。
   */
  cellAction?: CellAction<T>;
};

export type EditableGridHeaderIconMode = "readonly" | "editable" | "both" | "none";

export type EditableGridCellChangeEvent<T> = {
  rowKey: React.Key;
  field: string;
  value: unknown;
  row: T;
};

export type EditableGridSwitchToggleEvent<T> = {
  row: T;
  rowKey: React.Key;
  field: string;
  nextValue: boolean;
  previousValue: boolean;
};

export type EditableGridOrderRule<T> = {
  field: EditableGridColumn<T>["field"];
  direction?: "asc" | "desc";
};

export type EditableGridTableProps<T> = TableStylingProps<T> &
  TableCellStyleProps & {
    /**
     * DataTable/RecordSelectionTable と同じ API を採用。未指定時は空配列扱い。
     */
    items?: T[];
    columns: EditableGridColumn<T>[];
    getKey?: (row: T, index: number) => React.Key;
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
    /**
     * ヘッダーへ表示するアイコンのモード。
     * - readonly: Readonly列のみ表示（デフォルト）
     * - editable: 編集可能列のみ表示
     * - both: 両方の列に表示
     * - none: アイコンを表示しない
     */
    headerIconMode?: EditableGridHeaderIconMode;
    /**
     * readonly セルに背景色を適用するかどうか。
     * @default true
     */
    highlightReadonlyCells?: boolean;
    /**
     * 行ホバー時の背景色変更を無効にするかどうか。
     * @default false
     */
    disableRowHover?: boolean;
  };
