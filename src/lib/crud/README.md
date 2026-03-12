# 汎用 CRUD ライブラリ仕様

> このドキュメントは `createCrudService` を中心としたライブラリ内部のコアスペックです。
> 使い方・拡張判断のガイドは `docs/!must-read/汎用CRUDの仕様と拡張方法について.md` を参照してください。

---

## ディレクトリ構成

```
src/lib/crud/
├── types.ts                  # 共通型（SearchParams, WhereExpr, BelongsToManyFilter 等）
├── index.ts                  # バレルエクスポート
├── client/                   # クライアント層（createApiClient, イベント）
├── components/               # CRUD 用 UI ボタン群
├── hooks/                    # 汎用フック（dc:generate で各ドメインに展開）
├── presenters/               # カラムメタデータ・フォーマッタ
├── storageIntegration/       # ストレージ連携（ファイル削除・複製）
├── utils/                    # パス・スキーマユーティリティ
├── drizzle/                  # Drizzle (Neon/PostgreSQL) 実装
│   ├── service.ts            # createCrudService 本体
│   ├── types.ts              # Drizzle 固有型
│   ├── utils.ts              # INSERT デフォルト値、キー正規化等
│   ├── belongsToMany.ts      # M2M 同期・ハイドレーション
│   ├── fractionalSort/       # Fractional Indexing（並び替え）
│   ├── query/                # SQL クエリビルダー群
│   │   ├── buildWhere.ts     # WhereExpr DSL → SQL
│   │   ├── buildRelationWhere.ts  # BelongsToManyFilter → SQL
│   │   ├── buildOrderBy.ts   # OrderBySpec → SQL
│   │   └── runQuery.ts       # ページネーション付きクエリ実行
│   └── relations/            # ハイドレーション（belongsTo, M2M オブジェクト, count）
└── firestore/                # Firestore 実装
```

---

## createCrudService のオプション

```typescript
createCrudService<TTable, TCreate>(table, {
  // ID生成
  idType?: "uuid" | "db" | "manual",        // デフォルト: "uuid"

  // 自動タイムスタンプ
  useCreatedAt?: boolean,
  useUpdatedAt?: boolean,

  // ソフトデリート
  useSoftDelete?: boolean,

  // 検索デフォルト
  defaultSearchFields?: string[],
  defaultSearchPriorityFields?: string[],
  prioritizeSearchHitsByDefault?: boolean,
  defaultOrderBy?: OrderBySpec,

  // 入力パース
  parseCreate?: (data) => data,
  parseUpdate?: (data) => data,
  parseUpsert?: (data) => data,

  // upsert デフォルト
  defaultUpsertConflictFields?: string[],

  // belongsToMany（M2M 自動同期）
  belongsToManyRelations?: BelongsToManyRelationConfig[],

  // withRelations 用リレーション設定
  belongsToRelations?: BelongsToRelation[],
  belongsToManyObjectRelations?: BelongsToManyObjectRelation[],

  // withCount 用
  countableRelations?: CountableRelation[],

  // 並び替え
  sortOrderColumn?: AnyPgColumn,
})
```

---

## 提供メソッド一覧

### 基本 CRUD

| メソッド | 引数 | 戻り値 | 備考 |
|----------|------|--------|------|
| `create(data, tx?)` | Insert | Select | M2M 自動同期、sortOrder 自動割当 |
| `get(id, options?)` | string | Select \| undefined | withRelations / withCount 対応 |
| `list(options?)` | WithOptions | Select[] | 全件取得（上限 100）。フィルタ不要な場合のみ |
| `update(id, data, tx?)` | string, Partial | Select | M2M 差分同期 |
| `remove(id, tx?)` | string | void | useSoftDelete 時は論理削除 |

### 検索・クエリ・カウント

| メソッド | 引数 | 戻り値 | 備考 |
|----------|------|--------|------|
| `search(params?)` | SearchParams & WithOptions & ExtraWhereOption | PaginatedResult | メインの検索メソッド |
| `searchWithDeleted(params?)` | 同上 | PaginatedResult | 論理削除レコードも含む |
| `count(params?)` | CountParams & ExtraWhereOption | CountResult | 件数のみ取得（レコード不要時に最適） |
| `countWithDeleted(params?)` | 同上 | CountResult | 論理削除レコードも含めた件数 |
| `query(baseQuery, options?, countQuery?)` | カスタム SELECT | PaginatedResult | サーバー専用。JOIN 等の自由なクエリ |
| `searchForSorting(params?)` | SearchParams & ExtraWhereOption | PaginatedResult | sort_order NULL を自動初期化 |

### バルク操作

| メソッド | 引数 | 戻り値 | 備考 |
|----------|------|--------|------|
| `upsert(data, options?, tx?)` | Insert | Select | M2M 同期あり |
| `bulkUpsert(records, options?, tx?)` | Insert[] | BulkUpsertResult | M2M 非対応（警告ログ） |
| `bulkUpdate(records, tx?)` | BulkUpdateRecord[] | BulkUpdateResult | CASE WHEN + M2M グループ同期 |
| `bulkUpdateByIds(ids, data, tx?)` | string[], Partial | { count } | 全 ID に同じ値を適用 |
| `bulkDeleteByIds(ids, tx?)` | string[] | void | ソフト/ハード自動判定 |
| `bulkHardDeleteByIds(ids, tx?)` | string[] | void | 物理削除 |
| `bulkDeleteByQuery(where, tx?)` | WhereExpr | void | 条件一致を削除 |
| `duplicate(id, tx?)` | string | Select | name に「_コピー」付与 |

### ソフトデリート専用

| メソッド | 条件 | 備考 |
|----------|------|------|
| `restore(id, tx?)` | useSoftDelete | deletedAt を NULL に戻す |
| `hardDelete(id, tx?)` | useSoftDelete | 物理削除 |
| `listWithDeleted(options?)` | useSoftDelete | 削除済み含む全件 |
| `getWithDeleted(id, options?)` | useSoftDelete | 削除済み含む取得 |

### 並び替え専用

| メソッド | 条件 | 備考 |
|----------|------|------|
| `reorder(id, afterItemId, tx?)` | sortOrderColumn | Fractional Indexing で再配置 |
| `initializeSortOrder(ids, tx?)` | sortOrderColumn | 一括初期化 |

### ユーティリティ

| メソッド | 備考 |
|----------|------|
| `truncateAll()` | TRUNCATE CASCADE（中間テーブル含む） |
| `getTruncateAffectedTables()` | 影響テーブル名のみ取得 |
| `getTableName()` | テーブル名を返す |

---

## search() / count() の詳細仕様

### WHERE 合成順序

`search()` と `count()` は同じ WHERE 合成ロジックを使用する。

```
1. buildWhere(table, where)           ← WhereExpr DSL
2. AND extraWhere                     ← Drizzle SQL 直接注入
3. AND buildRelationWhere(...)        ← リレーションフィルタ（belongsToMany / belongsTo）
4. AND buildSoftDeleteFilter()        ← deletedAt IS NULL
5. AND searchQuery ILIKE conditions   ← テキスト検索
```

各レイヤーは値がなければスキップ。すべて `and()` で合成される。

`count()` は上記の WHERE 条件で `SELECT COUNT(*)` のみを実行し、`{ total: number }` を返す。レコードの取得・ハイドレーション・ソートは一切行わない。

### WhereExpr DSL

```typescript
// 単一条件
{ field: "status", op: "eq", value: "active" }

// 論理合成
{ and: [expr1, expr2] }
{ or: [expr1, expr2] }
```

**対応演算子:** eq, ne, lt, lte, gt, gte, like, startsWith, endsWith, in, notIn, isNull, isNotNull, contains, containedBy, hasKey, arrayContains, arrayOverlaps

### relationWhere（リレーションフィルタ）

belongsToMany（M2M）と belongsTo の両方に対応。`targetIds` の有無で自動判別される。

#### belongsToMany フィルタ（M2M）

```typescript
relationWhere: [
  {
    relationField: "sampleTagIds",   // belongsToManyRelations の fieldName
    targetIds: ["id1", "id2"],
    mode: "any",                     // "any" | "all" | "none"
  }
]
```

| モード | 生成 SQL | 意味 |
|--------|----------|------|
| `any`（デフォルト） | `EXISTS (... WHERE target IN (...))` | いずれかの ID を持つ |
| `all` | `COUNT(DISTINCT target) = N` | すべての ID を持つ |
| `none` | `NOT EXISTS (... WHERE target IN (...))` | いずれの ID も持たない |

- `targetIds` が空配列の場合はスキップ（no-op）

#### belongsTo フィルタ

```typescript
relationWhere: [
  {
    relationField: "user",           // belongsToRelations の field
    where: { field: "role", op: "eq", value: "contributor" },
  }
]
```

生成 SQL: `EXISTS (SELECT 1 FROM users WHERE users.id = main_table.user_id AND users.role = 'contributor')`

- `where` には WhereExpr DSL をそのまま使用（and/or ネストも可）

#### 共通ルール

- 未登録の `relationField` はエラー（利用可能なフィールド名を含むメッセージ）
- 複数エントリは AND で合成
- belongsToMany と belongsTo を同一配列内に混在可能

### extraWhere

WhereExpr / relationWhere で表現できない条件を Drizzle SQL で直接注入する。

```typescript
import { sql } from "drizzle-orm";
await service.search({
  extraWhere: sql`EXISTS (SELECT 1 FROM other_table WHERE ...)`,
});
```

### テキスト検索（searchQuery）

- `searchFields` の各カラムに対して `ILIKE %query%` を OR で結合
- `searchPriorityFields` で `CASE WHEN col ILIKE pattern THEN 0 ELSE 1 END` による優先度ソートを生成
- `prioritizeSearchHits: true` で優先度を `orderBy` より前に適用

### ページネーション

```typescript
// runQuery 内部
SELECT * FROM table WHERE ... ORDER BY ... LIMIT limit OFFSET (page - 1) * limit
// 並列で COUNT(*) を実行
SELECT COUNT(*) FROM table WHERE ...
```

戻り値: `{ results: T[], total: number }`

---

## belongsToMany の仕組み

### 3 段階のライフサイクル

```
1. Sync（書き込み時）
   create/update → separateBelongsToManyInput → INSERT本体 → syncBelongsToManyRelations

2. Hydrate IDs（読み取り時、常時）
   list/get/search → hydrateBelongsToManyRelations → ID配列をレコードに付与

3. Hydrate Objects（読み取り時、withRelations 有効時）
   → hydrateBelongsToManyObjects → 中間テーブル JOIN でオブジェクト配列を展開
```

### Sync の流れ

1. `separateBelongsToManyInput()` — 入力データからリレーション ID 配列を分離
2. メインレコードを INSERT/UPDATE
3. `syncBelongsToManyRelations()` — 中間テーブルの既存行を DELETE → 新しい行を INSERT
4. `assignLocalRelationValues()` — 戻り値に ID 配列を再付与

### BelongsToManyRelationConfig

```typescript
{
  fieldName: "sampleTagIds",          // エンティティ上のフィールド名
  throughTable: SampleToSampleTagTable, // 中間テーブル
  sourceColumn: table.sampleId,       // 中間テーブルの自ドメイン ID カラム
  targetColumn: table.sampleTagId,    // 中間テーブルの相手ドメイン ID カラム
  sourceProperty: "sampleId",         // INSERT 用プロパティ名
  targetProperty: "sampleTagId",      // INSERT 用プロパティ名
}
```

---

## withRelations / withCount の展開フロー

### 深さの解決

| 値 | 深さ | 動作 |
|----|------|------|
| `false` / `undefined` | 0 | ID 配列のみ（M2M hydrate は常時実行） |
| `true` / `1` | 1 | FK → オブジェクト、M2M → オブジェクト配列 |
| `2` | 2 | さらにリレーション先のリレーションも展開 |

### ハイドレーション順序

```
1. hydrateBelongsToManyRelations()     ← ID 配列（常時、belongsToManyRelations 設定時）
2. hydrateBelongsTo()                  ← FK → オブジェクト（depth > 0）
3. hydrateBelongsToManyObjects()       ← M2M → オブジェクト配列（depth > 0）
4. hydrateCount()                      ← _count オブジェクト（withCount: true）
```

### BelongsToRelation（FK 展開）

```typescript
{
  field: "sample_category",           // 展開後のフィールド名
  foreignKey: "sample_category_id",   // FK カラム名
  table: SampleCategoryTable,         // リレーション先テーブル
  targetFields?: ["id", "name"],      // 取得カラム限定（省略時は全カラム）
  nested?: { belongsTo: [...] },      // 2 階層目の設定
}
```

### BelongsToManyObjectRelation（M2M オブジェクト展開）

```typescript
{
  field: "sample_tags",               // 展開後のフィールド名
  targetTable: SampleTagTable,        // リレーション先テーブル
  throughTable: SampleToSampleTagTable,
  sourceColumn: table.sampleId,
  targetColumn: table.sampleTagId,
  targetFields?: ["id", "name"],
  nested?: { belongsTo: [...] },
}
```

### CountableRelation（カウント取得）

```typescript
{
  field: "sample_tags",               // _count のキー名
  throughTable: SampleToSampleTagTable,
  foreignKey: "sampleId",            // 中間テーブルの FK プロパティ名
}
```

結果: `record._count = { sample_tags: 5 }`

---

## 並び替え（Fractional Indexing）

### 概要

文字列ベースの順序値を使い、2 つのレコード間に無限に新しい値を挿入できる方式。
`fractional-indexing` ライブラリ（Notion/Figma 方式）を採用。

### 有効化

`sortOrderColumn` オプションにカラムを指定すると以下が利用可能:
- `reorder(id, afterItemId)` — 指定位置に再配置
- `searchForSorting(params)` — NULL の sort_order を自動初期化してから検索
- `initializeSortOrder(ids)` — 指定順序で一括初期化

### reorder の動作

```
afterItemId = null → リストの先頭に配置（generateFirstSortKey）
afterItemId = "xxx" → xxx の直後に配置（generateSortKey(xxx.sort_order, next.sort_order)）
```

### create 時の自動割当

新規レコードは自動的にリストの **先頭** に配置される（`generateFirstSortKey` を使用）。

---

## Firestore 版との差異

| 機能 | Drizzle | Firestore |
|------|---------|-----------|
| belongsToMany | 自動同期 + hydrate | 非対応 |
| relationWhere | 対応 | 非対応 |
| extraWhere | 対応 | 非対応 |
| or 条件 | 対応 | 非対応（エラー） |
| 複数列 orderBy | 対応 | 単一列のみ |
| searchPriorityFields | 対応 | 非対応 |
| ページネーション | LIMIT/OFFSET + COUNT(*) | page*limit 件取得 → slice |
| withRelations / withCount | 対応 | 非対応 |
| 並び替え | Fractional Indexing | 非対応 |
| バッチ制限 | なし | 500 件/バッチ |

---

## トランザクション

- すべての書き込みメソッドは `tx?: DbTransaction` を受け付ける
- 外部トランザクション: `db.transaction(async (tx) => { await service.create(data, tx); })`
- 内部トランザクション: belongsToMany 同期時、tx が未指定なら内部で自動生成
- `query()` はトランザクション非対応（読み取り専用）

---

## エラーハンドリング

PostgreSQL 制約違反を `DomainError` に変換:

| コード | 制約 | ステータス | メッセージ |
|--------|------|-----------|-----------|
| 23503 | 外部キー | 409 | 関連レコードが存在（delete 時）/ 参照先が不在（write 時） |
| 23502 | NOT NULL | 409 | 必須フィールドが未入力 |
| 23505 | UNIQUE | 409 | 値が重複 |

---

## ライブラリ拡張時の注意事項

1. **後方互換性の維持** — SearchParams 等の共通型への追加はオプショナルプロパティに限定する
2. **Firestore 側の考慮** — Drizzle 固有機能を追加した場合、Firestore 側では無視するかエラーにするか決める
3. **生成コードへの影響** — `hooks/` 配下は `dc:generate` で各ドメインに展開されるため、シグネチャ変更は全ドメインに波及する
4. **query/ 配下の純粋関数化** — クエリビルダーは DB アクセスを持たない純粋関数として実装する
