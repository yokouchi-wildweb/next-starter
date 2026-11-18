# sortableList

## Overview

- `@dnd-kit` + `@tanstack/react-virtual` による縦一列のドラッグ&ドロップ並び替えリスト。管理画面の専用ソート画面(`AdminXxxSort`、pnpm generate domain が生成)や、モーダル内の編集リストの並び替えに使う
- 既存の一覧テーブルに並び替えを足すのは tableSuite の `reorderable`(`src/lib/tableSuite/README.md`)。このライブラリは「並び替えが主目的の専用リスト」向け
- 使う時・直す時の決まりは札 .claude/rules/items/lib/sortableList.md にある。この README は使い方と仕組み

## Usage

### 基本

```tsx
import { SortableList, type ReorderResult } from "@/lib/sortableList";

<SortableList
  items={items}                       // { id: string } を含む配列（表示順）
  columns={[
    { render: (item) => item.name, width: "flex-1" },
    { render: (item) => <Badge>{item.status}</Badge>, width: "w-24", align: "center" },
  ]}
  onReorder={({ itemId, afterItemId }: ReorderResult) => {
    // サーバーへ reorder(itemId, afterItemId) を送る。UI は楽観的更新
  }}
/>
```

- `onReorder` には `itemId / afterItemId / beforeItemId / newIndex / oldIndex` が渡る。`afterItemId` は CRUD サービスの `reorder(id, afterId)` にそのまま渡せる(先頭なら null)
- `items` の順序は呼び出し側が持つ(楽観的更新 → 失敗時にロールバック)。デモ: `src/app/(user)/demo/sortable-list/`

### スクロール領域の持ち方(scroll)

- `scroll="self"`(既定): リスト自身が `overflow-y-auto` + `maxHeight` のスクロールコンテナになり、仮想スクロールで表示範囲の行だけを DOM に載せる。数百〜数千件の専用ソート画面向け
- `scroll="parent"`: スクロールする Modal / TabbedModal / ページセクションの中に数十行程度の編集リストを置くと、既定モードでは Modal 本体とリストの両方にスクロールバーが出る(二重スクロール)。`"parent"` にするとリストはスクロールコンテナを持たず、全行を `flex flex-col gap-2` の通常フローで描画するので、最寄りの祖先が唯一のスクロール領域になる

```tsx
<TabbedModal maxHeight="75vh" scrollable ...>
  <Stack gap="lg">
    <BreakSettingsSection />
    <SortableList items={gauges} columns={...} onReorder={...} scroll="parent" />
    <SortableList items={actions} columns={...} onReorder={...} scroll="parent" />
  </Stack>
</TabbedModal>
```

- `"parent"` は仮想化しない。全行がマウントされるので、目安は「数十行まで」(大量件数は `"self"`)。`maxHeight` は無視される
- `showHeader` / `isItemDisabled` / `disabled` / `rowClassName` / `itemHeight` / `itemPaddingX|Y` はどちらのモードでも同じ挙動。DnD の意味論(`onReorder` の結果)も同じ
- ドラッグ中に祖先の端へ寄せたときの自動スクロールは、dnd-kit の既定 autoScroll がスクロール可能な祖先を走査するため祖先側で機能する
- `maxHeight="none"` は仮想化の未定義挙動(コンテナが内容に伸びて全行描画になる)に依存する
- 使い分け: 大量件数の専用ソート画面 → `"self"` | スクロールする Modal / セクションの中の短い編集リスト → `"parent"` | Modal を固定高・内側だけスクロールにできる単一セクション構成 → Modal の `scrollable={false}` + `"self"` でもよい(`src/components/Overlays/README.md` の固定高コンテナモード)

## API

- `items`(`{ id: string }` を含む配列、表示順)・`columns`(`SortableListColumn`: `render(item)`・`header?`・`width?`・`align?`・`paddingX?`・`paddingY?`)・`onReorder(result)`(void か Promise)・`className?`
- `showHeader` / `headerClassName`: カラムヘッダー行をスクロール領域の外・上に常時表示
- `showDragHandle`(既定 true): ハンドル列の表示
- `disabled`: 全体のドラッグ無効化。`isItemDisabled(item)`: 行単位の無効化(SortableContext から除外され StaticItem で描画)
- `rowClassName`: 文字列または `(item, { index }) => string`。`draggingClassName` / `dragOverClassName`: ドラッグ中の行・重ねた先の行
- `itemHeight`(xs〜xl、既定 md)/ `itemPaddingX`(既定 sm)/ `itemPaddingY`(既定 none): 行の高さとパディング。ヘッダー行とも共有される
- `maxHeight`(既定 70vh): リスト自身のスクロールコンテナの最大高さ。`scroll="parent"` では無視
- `emptyMessage` / `isLoading`: 空表示・スケルトン表示
- `scroll`(`"self" | "parent"`、既定 `"self"`): スクロール領域の持ち方(Usage)
- `guardUnsaved`(既定 true): 並びの保存待ちの守り(Internals)
- 入口の他の出す物: 行の部品 `SortableItem` / `StaticItem` / `DragHandle`・`computeReorderResult(ids, activeId, overId)`(Internals)
- 型: `ReorderResult` / `SortableListScrollMode` / `SortableListProps` / `SortableListColumn` / `SortableItemType`(`{ id: string }`)

## Internals

### 未保存の守り(並びの保存待ち)

- `onReorder` が Promise を返すと、終わるまで(並びの保存待ち)ページの移動・戻る / 進む・再読み込みに確認を出す(`src/lib/unsavedGuard`、理由 = 未保存 `unsaved`。確認の文は `src/config/ui/unsaved-guard.config.ts`)。void を返す使い手は守らない。外すのは `guardUnsaved={false}`
- リストは未保存の並びを持たない(落とすたびに使い手が保存する)
- 判定は `reorderGuard.ts`(テスト `pnpm test src/lib/sortableList`)

### 中の部品

- 本体が DndContext・仮想化・scroll のモードの分岐を持つ。行は `SortableItem`(useSortable の行)/ 無効の行は `StaticItem`
- `computeReorderResult`: active / over の ID から after / before を出す。tableSuite の reorderable(`computeGroupedReorder`)も同じ関数を使う
- 読む lib: `@/lib/unsavedGuard`(入口だけ)・`@/lib/cn`
