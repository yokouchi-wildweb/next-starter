# sortableList — ドラッグ&ドロップ並び替えリスト

`@dnd-kit` + `@tanstack/react-virtual` による縦一列の並び替えリスト。管理画面の専用ソート画面（`AdminXxxSort`、dc:generate が生成）や、モーダル内の編集リストの並び替えに使う。

- 既存の一覧テーブルに並び替えを足したいだけなら tableSuite の `reorderable`（`src/lib/tableSuite/README.md`）を使う。本ライブラリは「並び替えが主目的の専用リスト」向け。

## 基本

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

- `onReorder` には `itemId / afterItemId / beforeItemId / newIndex / oldIndex` が渡る。`afterItemId` は CRUD サービスの `reorder(id, afterId)` にそのまま渡せる（先頭なら null）。
- `items` の順序は呼び出し側が管理する（楽観的更新 → 失敗時にロールバック）。デモ: `src/app/(user)/demo/sortable-list/`。

## 主な Props

- `showHeader` / `headerClassName`: カラムヘッダー行をスクロール領域の外・上に常時表示。
- `showDragHandle`（既定 true）: ハンドル列の表示。
- `disabled`: 全体のドラッグ無効化。`isItemDisabled(item)`: 行単位の無効化（SortableContext から除外され StaticItem で描画）。
- `rowClassName`: 文字列または `(item, { index }) => string`。
- `itemHeight`（xs〜xl、既定 md）/ `itemPaddingX`（既定 sm）/ `itemPaddingY`（既定 none）: 行の高さとパディング。ヘッダー行とも共有される。
- `maxHeight`（既定 70vh）: リスト自身のスクロールコンテナの最大高さ。`scroll="parent"` では無視。
- `emptyMessage` / `isLoading`: 空表示・スケルトン表示。
- `scroll`（`"self" | "parent"`、既定 `"self"`）: スクロール領域の持ち方。次節。

## スクロール領域の持ち方（scroll）

### scroll="self"（既定）

リスト自身が `overflow-y-auto` + `maxHeight` のスクロールコンテナになり、仮想スクロールで表示範囲の行だけを DOM に載せる。数百〜数千件の専用ソート画面向け。

### 親スクロールに追従させる（scroll="parent"）

スクロールする Modal / TabbedModal / ページセクションの **中に** 数十行程度の編集リストを置くと、既定モードでは Modal 本体とリストの両方にスクロールバーが出て操作しづらい（二重スクロール）。`scroll="parent"` にするとリストはスクロールコンテナを持たず、全行を `flex flex-col gap-2` の通常フローで描画するので、最寄りの祖先が唯一のスクロール領域になる。

```tsx
<TabbedModal maxHeight="75vh" scrollable ...>
  <Stack space={6}>
    <BreakSettingsSection />
    <SortableList items={gauges} columns={...} onReorder={...} scroll="parent" />
    <SortableList items={actions} columns={...} onReorder={...} scroll="parent" />
  </Stack>
</TabbedModal>
```

- 仮想化は行われない。全行がマウントされるため、対象は「数十行まで」を目安にする（大量件数は `"self"`）。
- `maxHeight` は無視される（ラッパーが高さ制約を持たない）。
- `showHeader` / `isItemDisabled` / `disabled` / `rowClassName` / `itemHeight` / `itemPaddingX|Y` はすべて同じ挙動。DnD の意味論（`onReorder` の結果）も同じ。
- ドラッグ中に祖先の端へ寄せたときの自動スクロールは、dnd-kit の既定 autoScroll がスクロール可能な祖先を走査するため祖先側で機能する。
- `maxHeight="none"` による回避は仮想化の未定義挙動（コンテナが内容に伸びて全行描画になる）に依存するため使わない。

### 使い分け

- 大量件数の専用ソート画面 → `"self"`
- スクロールする Modal / セクションの中の短い編集リスト → `"parent"`
- Modal を固定高・内側だけスクロールにできる単一セクション構成 → Modal の `scrollable={false}` + `"self"` でもよい（`src/components/Overlays/README.md` の固定高コンテナモード参照）

## ファイル構成

- `SortableList.tsx`: 本体（DndContext / 仮想化 / scroll モード分岐）
- `components/`: `SortableItem`（useSortable 行）/ `StaticItem`（無効行）/ `HeaderRow` / `DragHandle`
- `types.ts`: Props・`ReorderResult`・`SortableListScrollMode`
- `utils.ts`: `computeReorderResult`（active/over ID から after/before を算出。tableSuite reorderable も共用）
- `variants.ts`: 行の高さ・パディング・配置クラス
