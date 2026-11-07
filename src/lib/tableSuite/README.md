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

### 一括操作の受け口（管理一覧）

管理一覧の一括操作は、`bulkActions` の中に手で書かず、持ち主のドメインの受け口 `adminBulkActions` に **1 項目 1 ファイル**で置く（棚の評議会 D149）。上流の既定の操作も同じ受け口の項目で、fork は項目を足すか、上流の項目を `<名前>.override.ts` で外す・並べ替える。

- 項目の型 `BulkActionItem<Row, Access>` = `{ key, Component, lists?, enabled?, order?, access? }`。`Component` は `{ selection, onDone }` を受ける部品
  - `key`: 受け口の中で一意。override の宛先
  - `lists`: 出す一覧の名前（省略 = 全部の一覧。user は `"general"` / `"managerial"` / `"demo"`）
  - `enabled`: `false` か `() => boolean`（機能の設定に従うときは関数）
  - `order`: 小さい順（省略 = 100、同じなら key の順）
  - `access`: 表示の出し分け（管理一覧は `{ roles: [...] }` = `AdminBulkActionAccess`）。**権限の守りは API**で、ここは見せ方だけ
- `selectBulkActions(items, { list, can })` が絞って並べ、`<BulkActionItems items selection onDone? />` が描く。項目の `onDone` は選択を外してから容器の `onDone` を呼ぶ。容器はドメインのフック（`useUserAdminBulkActions(list)` など）でこの 2 つを呼ぶ
- よくある一括変更は `@/lib/crud/components` の作成関数で数行: `bulkFieldAction`（列挙型の列）・`bulkBelongsToAction`・`bulkRelationAction`（多対多。`mode: "replace" | "add"`）・`bulkDeleteAction`。ボタン（`Bulk*Button`）は成功で `router.refresh()` する
- 汎用の一括ボタンは**副作用の無い列だけ**。記録が必須の操作（状態の一括変更など）は上流が専用のサービス・API と作成関数で出す

```tsx
// src/features/core/user/adminBulkActions/userTags.tsx（上流の既定の項目）
export const bulkAction: UserAdminBulkActionItem = bulkRelationAction(
  { key: "userTags", lists: ["general"], enabled: () => APP_FEATURES.user.enableUserTag, order: 10 },
  { domain: userDisplay, relation: "userTag", mode: "replace", icon: Tags, label: "タグ設定" },
);

// fork: src/features/core/user/adminBulkActions/userTags.override.ts（上流の項目を外す・並べ替える。書けるのは enabled・order）
export const override = { enabled: false };
```

- 受け口のある一覧: user の 3 一覧（`src/features/core/user/adminBulkActions/`）・お知らせ（`src/features/core/notification/adminBulkActions/`、既定 = 一括削除）・pnpm generate domain で作るドメインの一覧（`src/features/<domain>/adminBulkActions/`。受け口の宣言 `extensionPoints.ts` と型は生成器が書く。項目が無ければ選択の無い素の表）
- 項目を置いた・消したら `pnpm generate extensions`（一覧 `extensions/adminBulkActions.ts` を作り直す）。書式: `scripts/structure/extensions/README.md`

`bulkActionsSticky`（既定 false）を付けると、一括操作バーがスクロールコンテナの端（`bulkActionsPosition` が top なら上端、bottom なら下端）に留まる。スクロールする Modal の本体など、テーブルの外の祖先がスクロールするときに `maxHeight="none"` と組み合わせて使う。バーはそのスクロールコンテナの最上端に留まるので、固定ヘッダーの下に潜るページ全体のスクロールには向かない。

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

書きかけのセル(入力して未確定)がある間と、`onCellChange` が返した Promise が終わるまで(保存待ち)、ページの移動・戻る / 進む・再読み込みに確認を出す(`src/lib/unsavedGuard`、理由 = 未保存 `unsaved`。確認の文は `src/config/ui/unsaved-guard.config.ts`)。

- 外す: `guardUnsaved={false}`(既定 true)
- セルの外を押すと書きかけは確定する(→ `onCellChange`)。同期に保存する使い手(void を返す)は確定の時点で守りが外れる
- 表は確定した値の未保存の状態を持たない。手元に変更をためて後でまとめて保存する画面は、その画面が `useUnsavedGuard` を呼ぶ
- 確定は編集 1 回につき 1 回(Enter・Tab・フォーカスが外れる、のどれで閉じても。Enter の後の blur でもう一度 `onCellChange` を呼ばない。`EditableGridTable/utils/commitOnce.ts`)
- 行の並び替えの保存待ちは下の「行の並び替えの未保存の守り」(同じ `guardUnsaved` で外れる)
- 判定: `EditableGridTable/utils/editGuard.ts`(テスト `pnpm test src/lib/`)

#### 行の並び替えの未保存の守り(DataTable / RecordSelectionTable / EditableGridTable)

`reorderable.onReorder` が返した Promise が終わるまで(並びの保存待ち)、理由「未保存」で守る(`lib/sortableList` と同じ決まり。`shared/reorder/reorderGuard.ts`、テスト `pnpm test src/lib/`)。

- 外す: `guardUnsaved={false}`(既定 true。EditableGridTable は編集の守りと同じ prop)
- `void` を返す `onReorder` は守らない(保存待ちが無い)
- 並びを手元にためて後でまとめて保存する画面は、その画面が `useUnsavedGuard` を呼ぶ(表は未保存の並びを持たない)

## 依存(読む lib)

守りの lib は入口 `@/lib/unsavedGuard` だけを読む(中のファイルを読まない)。

- `src/lib/unsavedGuard`(EditableGridTable の編集の守り・3 つの表の並び替えの守り)
- `src/lib/sortableList`(行の並び替えの計算 `computeReorderResult`)
- `src/lib/cn`・`src/lib/crud`・`src/lib/date`(クラスの結合・ソートの型 `crud/types`・日時の解釈 `date/parseFlexible`)

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

`presenters` を渡していない列は、生成の presenters.ts と同じ答え（`presenterFor`、src/lib/domain/README.md「何で表示するか」）で描く（boolean は「はい / いいえ」、数値の型は桁区切り、配列は「, 」区切り、enum は選択肢のラベル、画像はサムネイル、主の集まりは先頭 1 件と +N）。一覧特有の扱いは 2 つ: 空・null は空欄（presenters の「―」ではない）、textarea の文字列は `truncateLength` で切り詰める。リレーション・id・createdAt / updatedAt の列は今までどおり。

`buildDomainColumns` の `sortableFields` オプションで sortKey を自動設定できる。

```tsx
import { buildDomainColumns } from "@/lib/crud";

// 特定フィールドのみソート可能（値が配列の型 array・stringArray の列は指定してもソートしない）
const columns = buildDomainColumns<Sample>({
  config,
  sortableFields: ["name", "number", "updatedAt"],
});

// 全 tableFields をソート可能にする（画像・配列の型 array・stringArray は自動除外）
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
- **SortableList との使い分け**: 大量件数の専用ソート画面 → `@/lib/sortableList`（仮想スクロールあり）／スクロールする Modal 内の数十行の編集リスト → `@/lib/sortableList` の `scroll="parent"`（仮想化なし・親スクロールに追従）／既存の一覧テーブルに並び替えを足したい → tableSuite `reorderable`

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
