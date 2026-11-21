# tableSuite

## Overview

- テーブル系 UI コンポーネントのライブラリ。すべて `@/lib/tableSuite` からインポートする
- 閉じた lib: 入口は `@/lib/tableSuite` だけ。読む lib は appEnv・cn・date・sortableList・unsavedGuard、棚 `@/components`(peers)
- DataTable: 読み取り専用の一覧表示
- RecordSelectionTable: 行選択 + 一括操作
- RecordSelectionList: カードの一覧の行選択 + 一括操作(RecordSelectionTable の兄弟)
- EditableGridTable: インライン編集(内部構造とエディターの追加は `EditableGridTable/README.md`)
- PlainTable: 機能を足していない素の表の部品(`Table`・`TableHeader`・`TableBody`・`TableRow`・`TableHead`・`TableCell`・`TableFooter`・`TableCaption`)。上の 4 つの土台で、自分で組む表にもそのまま使う
- 決まり(選択のフック・ソートの責任・並び替えの鍵と範囲・未保存の守り・全幅行・無限スクロール・エディターの作り)は札 `.claude/rules/items/lib/tableSuite.md`。管理一覧の一括操作の受け口は CLAUDE.md COMPONENTS admin_bulk_actions(札 items/lib/tableSuite.md)

## Usage

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

- `canSelectRow?: (item, index) => boolean`: 選べない行はチェックが押せず(disabled)、ヘッダーの全部の選択にも入らない(未指定 = 全部選べる)
- `rangeSelect?: boolean`: shift を押した行 / チェックのクリックで、前に切り替えた行から今の行までを同じ値にする(既定 false)

#### 選択の出し方（selectionMode）

`selectionMode`（既定 `"onSelect"`）はチェックと一括操作バーをいつ出すか。RecordSelectionTable と RecordSelectionList で同じ。

- `"onSelect"`: チェックはいつも出し、バーは 1 件以上選んだ時だけ
- `"always"`: チェックもバーもいつも出す
- `"toggle"`: バーはいつも出し、その中の「選択モード」の切り替え（SwitchInput）が入の間だけチェックと操作を出す。切にすると選択を空に戻す
- `selectionBehavior`（`"row"` = 行を押して選ぶ / `"checkbox"` = チェックだけで選ぶ）とは別の軸。toggle の切の間は行を押しても選ばない
- 旧 `bulkActionsAlwaysVisible` は無い（`false` → `"onSelect"`、`true` → `"always"`）

### RecordSelectionList

RecordSelectionTable のカードの一覧の兄弟。選択の状態・一括操作バー・`selectionMode`・一括操作の項目を描く `BulkActionItems`（Extension）は表と同じ物を使う。1 件 = 左のチェックの列 + `renderItem(item, { selected, index })` のカード。

- チェックの列はカードの全高・押しやすい幅で、列のどこを押しても選択が切り替わる（チェックの aria-label・キーボードはそのまま）
- 見出しの行が無いので「すべて選択」はバーの左に出る（読み込み済みの選べる行が対象）
- `isSelectable(item)` が false の行はチェックを出さず、すべて選択からも外す
- 無限スクロールは呼び手の `InfiniteScrollList` の children の中に置く（番兵は InfiniteScrollList が持つ。`bottomSentinelRef` は自前で番兵を置くとき用）

```tsx
import { BulkActionItems, RecordSelectionList } from "@/lib/tableSuite";

<InfiniteScrollList items={query.items} /* … */>
  {(items) => (
    <RecordSelectionList
      items={items}
      getKey={(item) => item.id}
      isSelectable={(item) => !item.deletedAt}
      selectionMode="toggle"
      bulkActions={(selection) => <BulkActionItems items={actions} selection={selection} onDone={query.revalidate} />}
      renderItem={(item) => <Row item={item} />}
    />
  )}
</InfiniteScrollList>
```

### 選択のフックと一括操作のバー（表の外で使う）

カードの一覧など表でない所の選択は、RecordSelectionTable と同じ状態のフック `useRecordSelection` と一括操作のバー `BulkActionBar` を入口から使う(見た目は呼び手が持つ)。(札 selection_hook)

```tsx
import { BulkActionBar, useRecordSelection } from "@/lib/tableSuite";

const selection = useRecordSelection({
  items,
  getKey: (item) => item.id,
  canSelect: (item) => item.status !== "locked", // 任意
  rangeSelect: true, // 任意: shift で範囲
});

<BulkActionBar selection={selection.bulkSelection} bulkActions={(s) => <Button onClick={() => move(s.selectedIds)}>移す</Button>} />
{items.map((item) => (
  <Card
    key={item.id}
    selected={selection.selectedKeySet.has(item.id)}
    disabled={!selection.isSelectable(item.id)}
    onClick={(e) => selection.toggle(item.id, { shiftKey: e.shiftKey })}
  />
))}
```

| 戻り値 | 説明 |
|---|---|
| `selectedKeySet` / `selectedKeys` / `selectedRows` | 今の選択 |
| `isAllSelected` / `isPartialSelection` | 選べる行を全部選んだか / 一部か |
| `toggle(key, { checked?, shiftKey? })` / `toggleAll(checked)` / `clear()` | 切り替え(`checked` 未指定 = 今の逆) |
| `isSelectable(key)` | `canSelect` で選べる行か |
| `replaceSelection(keys)` | 選択をこの鍵の並びに置き換える(一部の行だけのすべて選択など) |
| `bulkSelection` | `BulkActionBar` の `selection` にそのまま渡す形 |

制御するときは `selectedKeys` と `onSelectionChange`、非制御の初期値は `defaultSelectedKeys`(RecordSelectionTable と同じ)。

`bulkActionsSticky`（RecordSelectionTable / RecordSelectionList。BulkActionBar では `sticky`、既定 false）を付けると、一括操作バーがスクロールコンテナの端（`bulkActionsPosition` が top なら上端、bottom なら下端）に留まる。スクロールする Modal の本体など、テーブルの外の祖先がスクロールするときに `maxHeight="none"` と組み合わせて使う。バーはそのスクロールコンテナの端に留まるので、固定ヘッダーの下に潜るページ全体のスクロールには向かない。

### PlainTable

選択・並び替え・編集を持たない表を自分で組むときの部品。`Table` の `variant`(`default` / `list` / `print`)が中の部品の見た目を決める。部位の印は `data-slot`(`table-container`・`table`・`table-header`・`table-body`・`table-row`・`table-head`・`table-cell`・`table-footer`・`table-caption`)。

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/lib/tableSuite";

<Table variant="list">
  <TableHeader>
    <TableRow>
      <TableHead>名前</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>山田</TableCell>
    </TableRow>
  </TableBody>
</Table>
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

セルの内部構造・カラムのカスタマイズ（validator / onToggleRequest / renderDisplay 等）・エディター型の追加手順は [EditableGridTable/README.md](./EditableGridTable/README.md)。

#### 未保存の守り

書きかけのセル(入力して未確定)がある間と、`onCellChange` が返した Promise が終わるまで(保存待ち)、ページの移動・戻る / 進む・再読み込みに確認を出す(`src/lib/unsavedGuard`、理由 = 未保存 `unsaved`。確認の文は `src/config/lib/unsavedGuard.config.ts`)。

- 外す: `guardUnsaved={false}`(既定 true)
- セルの外を押すと書きかけは確定する(→ `onCellChange`)。同期に保存する使い手(void を返す)は確定の時点で守りが外れる
- 表は確定した値の未保存の状態を持たない(手元にためて後で保存する画面の守りは札 batch_save_guard)
- 確定は編集 1 回につき 1 回(Enter・Tab・フォーカスが外れる、のどれで閉じても。Enter の後の blur でもう一度 `onCellChange` を呼ばない。`EditableGridTable/utils/commitOnce.ts`)
- 行の並び替えの保存待ちは下の「行の並び替えの未保存の守り」(同じ `guardUnsaved` で外れる)
- 判定: `EditableGridTable/utils/editGuard.ts`

#### 行の並び替えの未保存の守り(DataTable / RecordSelectionTable / EditableGridTable)

`reorderable.onReorder` が返した Promise が終わるまで(並びの保存待ち)、理由「未保存」で守る(`lib/sortableList` と同じ決まり。`shared/reorder/reorderGuard.ts`)。

- 外す: `guardUnsaved={false}`(既定 true。EditableGridTable は編集の守りと同じ prop)
- `void` を返す `onReorder` は守らない(保存待ちが無い)
- 表は未保存の並びを持たない(札 batch_save_guard)

### カラムソート

3つのテーブル（DataTable / RecordSelectionTable / EditableGridTable）で共通のヘッダークリックソートを提供する（並べ替え自体は呼び手、札 sort_by_caller）。

#### カラムにソートキーを設定する

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

#### クライアントサイドソート

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
null/undefined は昇順で末尾・降順で先頭（比較を反転するため）、文字列は `localeCompare("ja")` で比較。

3 つ目の引数 `options`（任意）:

- `getValue: (item, field) => unknown`: 並べる値の取り出し（未指定 = `item[field]`）。入れ子の値・派生の値で並べるとき。数字の形の文字列を数として並べるなら `Number(…)` を返す
- `nulls: "last" | "first"`: null / undefined を向きによらず末尾 / 先頭に置く

```tsx
const sorted = useMemo(
  () => sortItems(items, sort, { getValue: (row, field) => (field === "hp" ? row.stats.hp : row[field]), nulls: "last" }),
  [items, sort],
);
```

#### サーバーサイドソート（ページネーション対応）

ページネーション済みデータにクライアントソートを適用すると、現在のページ内だけのソートになり不適切。`onSortChange` で URL パラメータを更新し、サーバー再フェッチする。

```tsx
import {
  DataTable,
  serializeSortState,
  parseSortState,
  type SortState,
} from "@/lib/tableSuite";
import { toOrderBySpec } from "@/lib/crud"; // SortState → search の orderBy は並べる側(crud)の関数
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

#### buildDomainColumns との連携

`presenters` を渡していない列は、生成の presenters.ts と同じ答え（`presenterFor`、src/lib/domain/README.md「表示の種類の決め方(`presenterFor`)」）で描く（boolean は「はい / いいえ」、数値の型は桁区切り、配列は「, 」区切り、enum は選択肢のラベル、画像はサムネイル、主の集まりは先頭 1 件と +N）。一覧特有の扱いは 2 つ: 空・null は空欄（presenters の「―」ではない）、textarea の文字列は `truncateLength` で切り詰める。リレーション・id・createdAt / updatedAt の列は今までどおり。

`buildDomainColumns` の `sortableFields` オプションで sortKey を自動設定できる。

```tsx
import { buildDomainColumns } from "@/lib/crud";
import { formatDateJa } from "@/utils/date";
import { truncateJapanese } from "@/utils/string";

// 特定フィールドのみソート可能（値が配列の型 array・stringArray の列は指定してもソートしない）
// formatDate・truncate は必須(日付の書き方と切り詰めはアプリのもの)
const columns = buildDomainColumns<Sample>({
  config,
  formatDate: formatDateJa,
  truncate: truncateJapanese,
  sortableFields: ["name", "number", "updatedAt"],
});

// 全 tableFields をソート可能にする（画像・配列の型 array・stringArray は自動除外）
const columns = buildDomainColumns<Sample>({
  config,
  formatDate: formatDateJa,
  truncate: truncateJapanese,
  sortableFields: true,
});
```

#### ソートユーティリティまとめ

| 関数 | 用途 |
|---|---|
| `sortItems(items, sort?, options?)` | クライアントサイドソート（options: `getValue`・`nulls`） |
| `serializeSortState(sort)` | SortState → URL文字列（例: `"name.asc"`） |
| `parseSortState(value?)` | URL文字列 → SortState |
| `resolveNextSort(current?, field)` | ヘッダークリック時の次のソート状態を算出 |

SortState を `search` の `orderBy` に直す `toOrderBySpec` は `@/lib/crud` にある(tableSuite は crud を読まない。[src/lib/crud/README.md](../crud/README.md)「一覧の列」)

### 行の並び替え（reorderable）

3つのテーブル共通で、行のドラッグ並び替えを提供する。指定すると先頭にドラッグハンドル列が追加される（ハンドル限定ドラッグ。行クリック選択・onRowClick・セル編集と衝突しない）。

#### 基本的な使い方

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

呼び出し側の定石は「楽観的更新 + 失敗時ロールバック」（生成の並び替え画面 `Admin__Domain__SortScreen.tsx` と同じ）:

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

#### グループ内の並び替え（getGroup）

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

#### オプション

| キー | 説明 |
|---|---|
| `onReorder(result)` | 並び替え確定時のコールバック（必須） |
| `getGroup(item)` | グループ判定。指定するとグループ内限定の並び替えになる |
| `disabled` | ドラッグ全体を無効化（ハンドル列は薄表示で残る） |
| `isItemDisabled(item)` | 行単位でドラッグを無効化 |

#### 制約・注意

- **getKey**: 安定したレコードIDを返す `getKey` が要る(札 reorder_key。index フォールバックは並び替えに使えない)
- **カラムソートと排他**: `sort` 適用中は表示順と保存順が一致しないため、ハンドルが自動で無効化される（title で理由を表示）
- **ページネーション**: afterItemId 方式なのでページ内のドラッグは正しく保存されるが、ページ境界を越える移動はできない(使い分けは札 reorder_scope)
- **SortableList との使い分け**: 大量件数の専用ソート画面 → `@/lib/sortableList`（仮想スクロールあり）／スクロールする Modal 内の数十行の編集リスト → `@/lib/sortableList` の `scroll="parent"`（仮想化なし・親スクロールに追従）／既存の一覧テーブルに並び替えを足したい → tableSuite `reorderable`

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
- **`afterIndex` は現在の items に対する位置**(再計算は札 full_width_index。ページネーション環境ではサーバー側で位置を算出して渡すとよい)

### 印刷の表（variant="print"）

DataTable に `variant="print"` を渡すと印刷の表になる: スクロールの箱を付けない（`maxHeight` / `scrollContainerRef` は効かない）、小さな文字（text-xs）、セルに素の罫線、行の hover と縞なし。印刷の場所（portal・印刷用の CSS）と `window.print()` は呼び手が持つ。選択・編集の表では効かない（RecordSelectionTable は型で受けるが常に list）。

```tsx
<DataTable items={rows} columns={columns} variant="print" className="print-area" />
```

鍵と値の表（行ごとにセルの数が違う「項目名: 値」）は DataTable でなく `DetailTable`（`@/components/Overlays/DetailModal`、src/components/Overlays/DetailModal/README.md）。

### 無限スクロールの足元（infiniteFooter）

- 表のスクロール領域の中で続きを読むとき(`maxHeight` で表が自分でスクロールする)、フックの `sentinelRef` を `bottomSentinelRef` に、`isFetchingMore` / `hasMore` / `total` を `infiniteFooter` に渡す
- スクロール領域の中・表の下・sentinel の直前に、読み込み中(Spinner +「読み込み中...」)と、続きが無くなったときの終端(`total` があれば「全 N 件を表示しました」、無ければ `completedText`)が出る。待機中は何も出さない。DataTable・RecordSelectionTable・EditableGridTable で同じ
- 表をページ全体のスクロールで読む(`maxHeight="none"`)なら、表を `InfiniteScrollList` で包む(`src/components/Widgets/InfiniteScrollList/README.md`)

```tsx
const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
const { items, total, isFetchingMore, hasMore, sentinelRef } = useMyRows({ observerOptions: { root: scrollEl } });

<DataTable
  items={items}
  columns={columns}
  scrollContainerRef={setScrollEl}
  bottomSentinelRef={sentinelRef}
  infiniteFooter={{ isFetchingMore, hasMore, total }}
/>
```

| key | 型 | 説明 |
|---|---|---|
| `isFetchingMore` / `hasMore` | `boolean` | フックの値 |
| `total` | `number \| null` | 全件数(任意)。あれば終端が「全 N 件を表示しました」 |
| `completedText` | `ReactNode` | `total` が無いときの終端の文(既定「すべて表示しました」) |
| `fetchingMoreNode` / `completedNode` | `ReactNode` | 読み込み中 / 終端の差し替え(`completedNode={null}` で終端を出さない) |

## API

### 共通 Props: スタイリング

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
| `scrollContainerRef` / `bottomSentinelRef` | `Ref<HTMLDivElement>` | - | スクロール領域の div / 最下部の sentinel(無限スクロールの IntersectionObserver の root / target) |
| `infiniteFooter` | `InfiniteTableFooterProps` | - | 表の中の無限スクロールの足元(下の「無限スクロールの足元」) |

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

## Extension

### 一括操作の受け口(管理一覧)

管理一覧の一括操作は、`bulkActions` の中に手で書かず、持ち主のドメインの受け口 `adminBulkActions` に **1 項目 1 ファイル**で置く。上流の既定の操作も同じ受け口の項目で、fork は項目を足すか、上流の項目を `<名前>.override.ts` で外す・並べ替える。

- 項目の型 `BulkActionItem<Row, Access>` = `{ key, Component, lists?, enabled?, order?, access? }`。`Component` は `{ selection, onDone }` を受ける部品
  - `key`: 受け口の中で一意。override の宛先
  - `lists`: 出す一覧の名前（省略 = 全部の一覧。user は `"general"` / `"managerial"` / `"demo"`）
  - `enabled`: `false` か `() => boolean`（機能の設定に従うときは関数）
  - `order`: 小さい順（省略 = 100、同じなら key の順）
  - `access`: 表示の出し分け（管理一覧は `{ roles: [...] }` = `AdminBulkActionAccess`）。見せ方だけ（権限の守りは API）
- `selectBulkActions(items, { list, can })` が絞って並べ（`list` 省略 = `lists` を持つ項目は出さない、`can` 省略 = `access` を持つ項目は出さない）、`<BulkActionItems items selection onDone? />` が描く。項目の `onDone` は選択を外してから容器の `onDone` を呼ぶ。容器はドメインのフック（`useUserAdminBulkActions(list)` など）でこの 2 つを呼ぶ
- よくある一括変更は `@/lib/crud` の作成関数で数行: `bulkFieldAction`（列挙型の列）・`bulkBelongsToAction`・`bulkRelationAction`（多対多。`mode: "replace" | "add"`）・`bulkDeleteAction`。ボタン（`Bulk*Button`）は成功で `router.refresh()` する
- 汎用の一括ボタンは**副作用の無い列だけ**。記録が必須の操作（状態の一括変更など）は上流が専用のサービス・API と作成関数で出す

```tsx
// src/features/core/user/adminBulkActions/userTags.tsx（上流の既定の項目）
export const bulkAction: UserAdminBulkActionItem = bulkRelationAction(
  { key: "userTags", lists: ["general"], order: 10 },
  { domain: userDisplay, relation: "userTag", mode: "replace", icon: Tags, label: "タグ設定" },
);

// fork: src/features/core/user/adminBulkActions/userTags.override.ts（上流の項目を外す・並べ替える。書けるのは enabled・order）
export const override = { enabled: false };
```

- 受け口のある一覧:
  - user の 3 一覧(`src/features/core/user/adminBulkActions/`)
  - 振込審査(`src/features/core/bankTransferReview/adminBulkActions/`、既定 = メール一斉送信)
  - 送信一覧(`src/features/core/messaging/adminBulkActions/`、既定 = 削除、RecordSelectionList)
  - pnpm generate domain で作るドメインの一覧(`src/features/<domain>/adminBulkActions/`。受け口の宣言 `extensionPoints.ts` と型は生成器が書く。項目が無ければ選択の無い素の表)
- 項目を置いた・消したら `pnpm generate extensions`（一覧 `extensions/adminBulkActions.ts` を作り直す）。書式: `scripts/structure/extensions/README.md`

## Internals

### 使う部品

- 行の並び替えの計算は `@/lib/sortableList` の `computeReorderResult`、編集と並び替えの未保存の守りは `@/lib/unsavedGuard` の `useUnsavedTasks`

## Verification

- `/demo/tables` で全テーブルの動作を確認できる
- 未保存の守り・並び替えの守りの判定: `pnpm test src/lib/`
