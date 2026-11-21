# crud/drizzle/fractionalSort

## Overview

- 文字列ベースの順序値を使い、2 つのレコード間に無限に新しい値を挿入できる方式。`fractional-indexing` ライブラリ（Notion/Figma 方式）を採用。

## Usage

`sortOrderColumn` オプションにカラムを指定すると以下が利用可能:
- `reorder(id, afterItemId)` — 指定位置に再配置
- `searchForSorting(params)` — NULL の sort_order を自動初期化してから検索
- `initializeSortOrder(ids)` — 指定順序で一括初期化

## API

### reorder の動作

```
afterItemId = null → リストの先頭に配置（generateFirstSortKey）
afterItemId = "xxx" → xxx の直後に配置（generateSortKey(xxx.sort_order, next.sort_order)）
```

### create 時の自動割当

新規レコードは自動的にリストの **先頭** に配置される（`generateFirstSortKey` を使用）。

## Internals

### 並びの鍵の照合順序（COLLATE "C"）

鍵の生成（fractional-indexing）はバイト順（`0-9 < A-Z < a-z`）で前後を決める。DB や列の照合順序が C でないと（例: `en_US`・ICU）、`ORDER BY sort_order` が大文字小文字を混ぜて並べ、鍵の順と食い違う（鍵が 37 個を超えたり、`a0V` のような中間の鍵ができたりすると起きる）。そのため lib は text の並びの鍵を必ず `COLLATE "C"` で並べ・比べる。

- 式は `fractionalSort/sortKeyOrder.ts` の 1 か所: `sortKeyExpr` / `sortKeyAsc` / `sortKeyDesc` / `sortKeyGt`。text の列は `COLLATE "C"`、integer の列は何も足さない
- 使う所: create の採番・`reorder`（先頭・次の行の `>` の比較）・`initializeSortOrder`・`fractionalSort/server.ts`・集まりの並び、と `sortOrderColumn` を名指しする `orderBy` / `defaultOrderBy`（`search` / `searchWithDeleted` / `list` / `listWithDeleted` / `searchForSorting`。`buildOrderBy` の `sortKeyColumn`）
- 保存された鍵は書き換えない（並べ方と比べ方だけ）
- index: 並びの列の普通の index は `COLLATE "C"` の並べ方・比べ方に使われない（DB の既定が C.UTF-8 でも）。自分で index を張るなら `sortKeyIndexColumn` で宣言する。生成器は並びの列に index を出さない
  ```ts
  import { sortKeyIndexColumn } from "@/lib/crud/server";

  index("items_sort_idx").on(sortKeyIndexColumn(table.sort_order));
  index("items_parent_sort_idx").on(table.parent_id, sortKeyIndexColumn(table.sort_order));
  ```
  - integer の列には何も足さない。昇順 NULLS LAST のみ（lib の読み方と同じ。降順は後ろから読めば同じ index で足りる）
  - 仕組み: drizzle の opclass 欄に `COLLATE "C"` を書く。drizzle-kit は opclass をそのまま SQL に出し、push の比較には使わない。drizzle-kit の更新で変わると `pnpm test --db src/lib/crud/drizzle/fractionalSort/` が落ちる
  - 使わない書き方:
    - `` sql`${table.sort_order} COLLATE "C"` ``: 単一列でも複合でも、全列 sql でも、push のたびに DROP + CREATE になる
    - 普通の `.on(table.sort_order)`: 新しい環境では C にならず、並びに使われない
    - 列を `text COLLATE "C"` で宣言: push のたびに ALTER COLUMN が出る
  - 既にある普通の index を書き換えても push は気づかない（opclass は比較されないので、同じ名前のままだと C にならない）。index の名前を変えて作り直す（表が大きければ書き込みの少ない時間に）
- 自前の SQL で並びの列を並べる・比べるときも `sortKeyExpr`（`@/lib/crud/server`）を使う
