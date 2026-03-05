# tableSuite

テーブル系UIコンポーネントのライブラリ。すべて `@/lib/tableSuite` からインポートする。

## コンポーネント一覧

| コンポーネント | 用途 |
|---|---|
| DataTable | 読み取り専用の一覧表示 |
| RecordSelectionTable | 行選択 + 一括操作 |
| EditableGridTable | インライン編集 |
| SortableList | ドラッグ&ドロップ並び替え（仮想スクロール対応） |

## 基本的な使い方

### DataTable

```tsx
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";

const columns: DataTableColumn<Item>[] = [
  { header: "名前", render: (item) => item.name },
  { header: "数量", render: (item) => item.count, align: "right" },
];

<DataTable items={items} columns={columns} getKey={(item) => item.id} />
```

### RecordSelectionTable

DataTable の全機能に加え、行選択と一括操作バーを提供する。

```tsx
import { RecordSelectionTable } from "@/lib/tableSuite";

<RecordSelectionTable
  items={items}
  columns={columns}
  getKey={(item) => item.id}
  selectionBehavior="checkbox"  // "row" | "checkbox"
  onSelectionChange={(keys, rows) => { /* ... */ }}
  bulkActions={(selection) => (
    <Button onClick={() => bulkDelete(selection.selectedIds)}>一括削除</Button>
  )}
/>
```

### EditableGridTable

```tsx
import { EditableGridTable, type EditableGridColumn } from "@/lib/tableSuite";

const columns: EditableGridColumn<Item>[] = [
  { field: "name", header: "名前", editorType: "readonly" },
  { field: "count", header: "数量", editorType: "number" },
  { field: "category", header: "カテゴリ", editorType: "select", options: [...] },
];

<EditableGridTable
  items={items}
  columns={columns}
  getKey={(row) => row.id}
  onCellChange={(event) => {
    // event: { rowKey, field, value, row }
  }}
/>
```

editorType: `text` | `number` | `select` | `multi-select` | `date` | `time` | `datetime` | `readonly` | `switch` | `action`

### SortableList

ドラッグ&ドロップで並び替え可能なリスト。`@tanstack/react-virtual` による仮想スクロール対応。

```tsx
import { SortableList } from "@/lib/tableSuite";

<SortableList
  items={items}  // { id: string } を含むオブジェクトの配列
  columns={[
    { render: (item) => item.title, width: "flex-1" },
    { render: (item) => <Badge>{item.status}</Badge>, width: "w-24" },
  ]}
  onReorder={({ itemId, afterItemId }) => {
    // サーバーに並び替えリクエストを送信
  }}
/>
```

## カラムソート

3つのテーブル（DataTable / RecordSelectionTable / EditableGridTable）で共通のヘッダークリックソートを提供する。

### 設計方針

- テーブルは**ソート状態の表示とイベント通知のみ**を担当する
- 実際のデータソート（クライアント/サーバー）は**使用側が行う**

### カラムにソートキーを設定する

```tsx
// DataTable / RecordSelectionTable: sortKey を指定
const columns: DataTableColumn<Item>[] = [
  { header: "名前", sortKey: "name", render: (item) => item.name },
  { header: "操作", render: (item) => <Button /> },  // sortKey なし → ソート不可
];

// EditableGridTable: sortable: true を指定（field がソートキーになる）
const columns: EditableGridColumn<Item>[] = [
  { field: "name", header: "名前", editorType: "readonly", sortable: true },
  { field: "action", header: "操作", editorType: "action" },  // sortable なし → ソート不可
];
```

### クライアントサイドソート

```tsx
import { DataTable, sortItems, type SortState } from "@/lib/tableSuite";

const [sort, setSort] = useState<SortState | undefined>(undefined);
const sortedItems = useMemo(() => sortItems(items, sort), [items, sort]);

<DataTable
  items={sortedItems}
  columns={columns}
  sort={sort}
  onSortChange={setSort}
/>
```

`sortItems(items, sort)` は sort 未指定時は元の配列をそのまま返す（コピーしない）。
null/undefined は末尾、文字列は `localeCompare("ja")` で比較。

### サーバーサイドソート（ページネーション対応）

ページネーション済みデータにクライアントソートを適用すると、現在のページ内だけのソートになり不適切。`onSortChange` で URL パラメータを更新し、サーバー再フェッチする。

```tsx
import {
  DataTable,
  serializeSortState,
  parseSortState,
  toOrderBySpec,
  type SortState,
} from "@/lib/tableSuite";
```

**page.tsx（サーバーコンポーネント）:**
```tsx
const { sortBy } = await searchParams;
const sort = parseSortState(sortBy);  // "name.asc" → { field: "name", direction: "asc" }
const orderBy = sort ? toOrderBySpec(sort) : [["createdAt", "DESC"]];

const { results, total } = await service.search({ page, limit, orderBy });

<MyList items={results} sort={sort} />
```

**クライアントコンポーネント:**
```tsx
const handleSortChange = (nextSort: SortState) => {
  const search = new URLSearchParams(params.toString());
  search.set("sortBy", serializeSortState(nextSort));  // { field: "name", direction: "asc" } → "name.asc"
  search.delete("page");  // ソート変更時は1ページ目に戻す
  router.push(makeHref(search));
};

<DataTable items={items} columns={columns} sort={sort} onSortChange={handleSortChange} />
```

### buildDomainColumns との連携

`buildDomainColumns` の `sortableFields` オプションで sortKey を自動設定できる。

```tsx
import { buildDomainColumns } from "@/lib/crud";

// 特定フィールドのみソート可能
const columns = buildDomainColumns<Sample>({
  config,
  sortableFields: ["name", "number", "updatedAt"],
});

// 全 tableFields をソート可能にする（画像・配列フィールドは自動除外）
const columns = buildDomainColumns<Sample>({
  config,
  sortableFields: true,
});
```

### ソートユーティリティまとめ

| 関数 | 用途 |
|---|---|
| `sortItems(items, sort?)` | クライアントサイドソート |
| `serializeSortState(sort)` | SortState → URL文字列（例: `"name.asc"`） |
| `parseSortState(value?)` | URL文字列 → SortState |
| `toOrderBySpec(sort)` | SortState → CRUD の OrderBySpec |
| `resolveNextSort(current?, field)` | ヘッダークリック時の次のソート状態を算出 |

## 共通Props

### スタイリング

全テーブル共通で以下の Props を受け付ける。

| Prop | 型 | デフォルト | 説明 |
|---|---|---|---|
| `className` | `string` | - | ラッパー div のクラス |
| `maxHeight` | `string` | `"70vh"` | スクロール領域の最大高さ |
| `rowClassName` | `string \| (item, context) => string` | - | 行単位のクラス |
| `rowHeight` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | `"md"` | 行の高さ |
| `cellPaddingX` | `PaddingSize` | `"sm"` | セルの水平パディング |
| `cellPaddingY` | `PaddingSize` | `"none"` | セルの垂直パディング |
| `disableRowHover` | `boolean` | `false` | 行ホバー時の背景色変更を無効化 |

### CellAction（セルクリックオーバーレイ）

DataTable / RecordSelectionTable のカラムに `cellAction` を設定すると、ホバー時にクリック領域とインジケーターが表示される。

```tsx
{
  header: "名前",
  render: (item) => item.name,
  cellAction: {
    onClick: (item) => { /* クリック時の処理 */ },
    indicator: <Eye className="size-4" />,  // 省略時はデフォルトの目アイコン
    fullWidth: true,  // セル全体をクリック領域にする
  },
}
```

ポップオーバーモードも利用可能:

```tsx
cellAction: {
  popover: (item, trigger) => (
    <InfoPopover trigger={trigger} title={item.name}>
      {/* ポップオーバー内容 */}
    </InfoPopover>
  ),
}
```

## ディレクトリ構造

```
tableSuite/
  index.ts              # エントリーポイント（すべてここからインポート）
  types.ts              # 共通型定義
  table-variants.ts     # スタイルバリアント定義
  shared/               # 共通コンポーネント（Table, TableRow, SortableTableHead 等）
  utils/                # ユーティリティ（sortItems, sortState）
  DataTable/            # 読み取り専用テーブル
  RecordSelectionTable/ # 行選択テーブル
  EditableGridTable/    # インライン編集テーブル
  SortableList/         # ドラッグ&ドロップリスト
```

## デモ

`/demo/tables` で全テーブルの動作を確認できる。
