# crud/firestore

## Overview

- Firestore 版の createCrudService。機能凍結済みで、下表の制限は仕様として固定し、以後の機能拡張は行わない（CLAUDE.md BACKENDS doctrine、`docs/!must-read/バックエンド構成ドクトリン.md`）

## API

### Drizzle 版との差異

| 機能 | Drizzle | Firestore |
|------|---------|-----------|
| belongsToMany | 自動同期 + hydrate | 非対応 |
| relationWhere | 対応 | 非対応 |
| extraWhere | 対応 | 非対応 |
| extraOrderBy | 対応 | 非対応 |
| or 条件 | 対応 | 非対応（エラー） |
| where の演算子 | `QueryOp` の全部 | `eq` `ne` `lt` `lte` `gt` `gte` `like`（前方一致）のみ。ほかの演算子（`in` / `notIn` / `isNull` / `isNotNull` / `startsWith` / `endsWith` / `contains` ほか）はエラー（条件を黙って捨てない） |
| 複数列 orderBy | 対応 | 単一列のみ |
| テキスト検索（searchQuery） | `searchFields` 全カラムに `ILIKE %q%` を OR | `searchFields` の **先頭 1 カラムのみ** 前方一致（`>= q` かつ `<= q + "\uf8ff"`） |
| searchRank | 対応 | 非対応（無視） |
| ページネーション | LIMIT/OFFSET + COUNT(*) | page*limit 件取得 → slice。`search` の `total` は取得件数（最大 page*limit）で実総数ではない（実総数は `count()`） |
| withRelations / withCount | 対応 | 非対応 |
| replaceByQuery | 対応 | 非対応 |
| 並び替え | Fractional Indexing | 非対応 |
| バッチ制限 | なし | 500 件/バッチ |

## Internals

- 論理削除（`useSoftDelete`）: 一覧・検索・件数は `deletedAt == null` で絞り、Firestore はフィールドの無い文書をこれに一致させない。このため作成の経路（`create` / `duplicate` / `upsert` / `bulkUpsert`）は `deletedAt: null` を書く（入力に値があればそれを使う）
  - `upsert` / `bulkUpsert` は同じ TX で今の文書を読み、`deletedAt` が無いときだけ `null` を足す。論理削除済みの行は削除のまま（復元は `restore`）
  - `deletedAt` の無い古い文書は `get` では読めるが、一覧・検索・件数に出ない。出すには `deletedAt: null` を書く
  - クライアントから直接作る文書も同じく `deletedAt: null` を書く（chatRoom の `createRoomWithSystemMessage`）
