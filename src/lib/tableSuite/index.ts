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
export { default as RecordSelectionList } from "./RecordSelectionList";
export { default as EditableGridTable } from "./EditableGridTable";

// 一括操作の受け口の項目(型・絞って並べる関数・描く部品。D149)
export { BulkActionItems, selectBulkActions, DEFAULT_BULK_ACTION_ORDER } from "./BulkActions";
export type { BulkActionItem, BulkActionProps, BulkActionItemsProps, SelectBulkActionsOptions } from "./BulkActions";

// ============================================================
// 素の表 PlainTable(機能を足していない表の部品。上の表の土台)
// ============================================================
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./shared";
export { TableFooter, TableCaption } from "./DataTable/components";

// ============================================================
// 共通コンポーネント（shared/）
// ============================================================
export {
  TableCellAction,
  TABLE_CELL_ACTION_CLASS,
  CellClickOverlay,
  type CellClickOverlayProps,
  getCellClickOverlayClassName,
  SortableTableHead,
} from "./shared";
export { InfiniteTableFooter, type InfiniteTableFooterProps } from "./shared/InfiniteTableFooter";

// 行の選択の状態(見た目を持たない)と一括操作のバー: RecordSelectionTable と同じ物を表の外でも使う
export {
  useRecordSelection,
  type UseRecordSelectionOptions,
  type RecordSelectionToggleOptions,
} from "./RecordSelectionTable/hooks/useRecordSelection";
export { BulkActionBar, type BulkActionBarProps } from "./RecordSelectionTable/components/BulkActionBar";

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
  FullWidthRow,
  SortDirection,
  SortState,
  ColumnSortProps,
  ReorderableConfig,
  RowReorderProps,
} from "./types";

// 行並び替え（reorderable）の結果型。CRUD の reorder(id, afterItemId) にそのまま接続できる
export type { ReorderResult } from "@/lib/sortableList";
export {
  ROW_HEIGHT_CLASS,
  PADDING_X_CLASS,
  PADDING_Y_CLASS,
  resolvePaddingClass,
  resolveColumnTextAlignClass,
  resolveColumnFlexAlignClass,
  resolveRowClassName,
  resolveNextSort,
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
  BulkActionBarPosition,
  SelectionMode,
} from "./RecordSelectionTable";

// RecordSelectionList 型(カードの一覧の兄弟、D95)
export type { RecordSelectionListProps } from "./RecordSelectionList";

// EditableGridTable 型
export type {
  EditableGridEditorType,
  EditableGridColumn,
  EditableGridHeaderIconMode,
  EditableGridCellChangeEvent,
  EditableGridSwitchToggleEvent,
  EditableGridTableProps,
} from "./EditableGridTable";

// ============================================================
// ユーティリティ
// ============================================================
export { sortItems, type SortItemsOptions } from "./utils/sortItems";
export { serializeSortState, parseSortState, toOrderBySpec } from "./utils/sortState";

