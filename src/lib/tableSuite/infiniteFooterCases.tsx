// 表の無限の足元(infiniteFooter)を足す前後で、渡さない出力が変わらないことを比べる場合の一覧
// (render テストと期待値の記録で同じ物を使う)
import { createElement, type ReactElement } from "react";

import { DataTable, EditableGridTable, RecordSelectionTable } from "./index";

type Row = { id: string; name: string };
const items: Row[] = [
  { id: "1", name: "a" },
  { id: "2", name: "b" },
];
const sentinel = () => {};
const dataColumns = [{ header: "名前", render: (r: Row) => r.name }];
const gridColumns = [{ field: "name", header: "名前", editorType: "readonly" as const }];

export const tableDefaultCases: Record<string, ReactElement> = {
  dataTable: createElement(DataTable<Row>, { items, columns: dataColumns, getKey: (r: Row) => r.id }),
  dataTableSentinel: createElement(DataTable<Row>, { items, columns: dataColumns, getKey: (r: Row) => r.id, bottomSentinelRef: sentinel }),
  selection: createElement(RecordSelectionTable<Row>, { items, columns: dataColumns, getKey: (r: Row) => r.id }),
  selectionSentinel: createElement(RecordSelectionTable<Row>, { items, columns: dataColumns, getKey: (r: Row) => r.id, bottomSentinelRef: sentinel }),
  grid: createElement(EditableGridTable<Row>, { items, columns: gridColumns, getKey: (r: Row) => r.id }),
  gridSentinel: createElement(EditableGridTable<Row>, { items, columns: gridColumns, getKey: (r: Row) => r.id, bottomSentinelRef: sentinel }),
};
