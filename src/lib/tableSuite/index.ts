// src/lib/tableSuite/index.ts
//
// tableSuite ライブラリのエントリーポイント
// 外部からはこのファイルを通じてインポートすることで、
// 内部のファイル構造が変わってもインポートパスが変わらない

// ============================================================
// テーブルコンポーネント
// ============================================================
export { default as DataTable } from "./DataTable";
export { default as RecordSelectionTable } from "./RecordSelectionTable";
export { default as EditableGridTable } from "./EditableGridTable";
export { default as SortableList } from "./SortableList";

// ============================================================
// 共通コンポーネント（shared/）
// ============================================================
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCellAction,
  TABLE_CELL_ACTION_CLASS,
  CellClickOverlay,
  type CellClickOverlayProps,
  getCellClickOverlayClassName,
} from "./shared";

// ============================================================
// DataTable 固有コンポーネント
// ============================================================
export { TableFooter, TableCaption } from "./DataTable/components";

// ============================================================
// 型定義
// ============================================================
// 共通型
export type {
  RowHeight,
  PaddingSize,
  TableColumnAlignment,
  TableCellStyleProps,
  TableRowClassContext,
  RowClassNameResolver,
  TableStylingProps,
  CellAction,
} from "./types";
export {
  ROW_HEIGHT_CLASS,
  PADDING_X_CLASS,
  PADDING_Y_CLASS,
  resolvePaddingClass,
  resolveColumnTextAlignClass,
  resolveColumnFlexAlignClass,
  resolveRowClassName,
} from "./types";

// DataTable 型
export type {
  DataTableColumn,
  DataTableProps,
  RowCursor,
} from "./DataTable";

// RecordSelectionTable 型
export type {
  RecordSelectionTableProps,
  BulkActionSelection,
  BulkActionBarSpacing,
} from "./RecordSelectionTable";

// EditableGridTable 型
export type {
  EditableGridEditorType,
  EditableGridColumn,
  EditableGridHeaderIconMode,
  EditableGridCellChangeEvent,
  EditableGridSwitchToggleEvent,
  EditableGridOrderRule,
  EditableGridTableProps,
} from "./EditableGridTable";

// SortableList 型
export type {
  SortableItem as SortableItemType,
  SortableListColumn,
  SortableListProps,
  ReorderResult,
} from "./SortableList";
export { DragHandle, SortableItem } from "./SortableList";
