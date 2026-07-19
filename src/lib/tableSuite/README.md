# tableSuite

テーブル系UIコンポーネントのライブラリ。すべて `@/lib/tableSuite` からインポートする。

## コンポーネント一覧

| コンポーネント | 用途 |
|---|---|
| DataTable | 読み取り専用の一覧表示 |
| RecordSelectionTable | 行選択 + 一括操作 |
| EditableGridTable | インライン編集 |

## 基本的な使い方

### DataTable

```tsx
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";

const columns: DataTableColumn<Item>[] = [
  { header: "名前", render: (item) => item.name, width: "40%" },
  { header: "数量", render: (item) => item.count, align: "right", width: "120px" },
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

## 行の並び替え（reorderable）

3つのテーブル共通で、行のドラッグ並び替えを提供する。指定すると先頭にドラッグハンドル列が追加される（ハンドル限定ドラッグ。行クリック選択・onRowClick・セル編集と衝突しない）。

### 基本的な使い方

```tsx
import { DataTable, type ReorderResult } from "@/lib/tableSuite";

<DataTable
  items={items}
  columns={columns}
  getKey={(item) => item.id}  // reorderable 使用時は安定IDを返す getKey が必須
  reorderable={{
    onReorder: (result: ReorderResult) => {
      // result: { itemId, afterItemId, beforeItemId, oldIndex, newIndex }
      // CRUD の reorder(id, afterItemId) / useReorder<Domain> にそのまま接続できる
    },
  }}
/>
```

呼び出し側の定石は「楽観的更新 + 失敗時ロールバック」（`Admin__Domain__Sort` テンプレートと同じ）:

```tsx
const handleReorder = async (result: ReorderResult) => {
  const previous = items;
  setItems((prev) => {
    const next = [...prev];
    const [moved] = next.splice(result.oldIndex, 1);
    next.splice(result.newIndex, 0, moved);
    return next;
  });
  try {
    await sampleClient.reorder?.(result.itemId, result.afterItemId);
  } catch {
    setItems(previous); // ロールバック
  }
};
```

### グループ内の並び替え（getGroup）

「グループ → sort_order」順で表示しているテーブルで、グループ内に限定した並び替えができる。

```tsx
reorderable={{
  onReorder: handleReorder,
  getGroup: (item) => item.categoryId,
}}
```

- グループを跨ぐドロップは**キャンセル**される（所属変更は並び替えではなく update の責務）
- `afterItemId` は**同一グループ内の直前レコード**に正規化される。グループ先頭への移動は `afterItemId: null`
- CRUD の reorder は Fractional Indexing のため、この正規化された値をそのまま渡せばグループ内順序が正しく保存される（sort_order キーはグループ内でしか比較されないため、グローバル先頭挿入 = グループ先頭挿入として成立する）
- グループの区切り表示には `fullWidthRows` が使える（もともと並び替え対象外）

### オプション

| キー | 説明 |
|---|---|
| `onReorder(result)` | 並び替え確定時のコールバック（必須） |
| `getGroup(item)` | グループ判定。指定するとグループ内限定の並び替えになる |
| `disabled` | ドラッグ全体を無効化（ハンドル列は薄表示で残る） |
| `isItemDisabled(item)` | 行単位でドラッグを無効化 |

### 制約・注意

- **getKey 必須**: reorderable 使用時は安定したレコードIDを返す `getKey` を必ず指定する（index フォールバックは並び替えに使えない）
- **カラムソートと排他**: `sort` 適用中は表示順と保存順が一致しないため、ハンドルが自動で無効化される（title で理由を表示）
- **ページネーション**: afterItemId 方式なのでページ内のドラッグは正しく保存されるが、ページ境界を越える移動はできない。本格的な並び替え運用は searchForSorting + 専用ソート画面を推奨
- **SortableList との使い分け**: 大量件数の専用ソート画面 → `@/lib/sortableList`（仮想スクロールあり）／既存の一覧テーブルに並び替えを足したい → tableSuite `reorderable`

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

### カラム幅

全テーブル共通で、カラム定義に `width?: string` を指定できる。CSS の width 値（`"200px"`, `"30%"`, `"auto"` など）をヘッダー（th）の `style` に適用する。

```tsx
{ header: "名前", render: (item) => item.name, width: "40%" }
{ header: "操作", render: (item) => <Button />, width: "80px" }
```

### headerHelp（ヘッダーのホバー説明）

全テーブル共通で、カラム定義に `headerHelp?: ReactNode` を指定できる。指定するとヘッダーが「ラベル + ?アイコン + ホバー説明」（`HelpTip`）に合成される。インプレッションや CTR など、名前だけでは意味が伝わらない集計・派生カラムに使用する。

```tsx
{
  header: "詳細CTR",
  headerHelp: "詳細クリック ÷ インプレッション。バナーが表示されたうち詳細が開かれた割合",
  render: (item) => formatRate(item),
}
```

- `header` にカスタムノードを渡している場合も、そのノードがラベルとして HelpTip に合成される
- デスクトップはホバー、タッチデバイスはタップで説明が開閉する
- 注意: ソート可能列（`sortKey` / `sortable`）では、タッチ端末でヘルプをタップするとソートも同時に発火する（クリック伝播は止めない仕様）

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

### fullWidthRows（全幅差し込み行）

DataTable / RecordSelectionTable に `fullWidthRows` を渡すと、データ行の任意位置に全カラムを結合した情報行を挿入できる。グループの空き枠プレースホルダー・セクション区切り・行間の注釈などに使用する。

```tsx
import { DataTable, type FullWidthRow } from "@/lib/tableSuite";

const fullWidthRows: FullWidthRow[] = [
  {
    key: "empty-stack-42",       // データ行のキーと衝突しない一意値
    afterIndex: 2,               // index=2 のデータ行の直後に挿入（-1 = 先頭）
    render: () => <EmptyStackPlaceholder stack={stack} />,
    className: "border-dashed",  // tr への追加クラス（任意）
  },
];

<DataTable items={items} columns={columns} fullWidthRows={fullWidthRows} />
```

- 挿入行は**選択・行クリック・ソート・一括操作の対象外**（RecordSelectionTable の選択状態・select-all・一括バーに影響しない）
- `afterIndex` が items の範囲を超える場合は末尾に丸められる。items が空のときはすべて先頭に描画される
- セルは `p-0` で描画されるため、パディングは `render` 内で自分で付ける
- **`afterIndex` は現在の items に対する位置**。ソート・ページ変更などで items が変わる際は使用側が再計算する責任を持つ（ページネーション環境ではサーバー側で位置を算出して渡すことを推奨）

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
```

## デモ

`/demo/tables` で全テーブルの動作を確認できる。
