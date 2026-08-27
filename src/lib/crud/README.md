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

  // 特権書き込み allowlist（Drizzle のみ、後述）
  systemColumns?: readonly string[],

  // リクエストスコープメモ化（既定: false）
  requestMemo?: boolean,
})
```

### requestMemo（リクエストスコープメモ化）

`requestMemo: true` にすると、`get(id)`（オプションなし呼び出しのみ）が同一サーバー
リクエスト内でメモ化され、複数サブシステムからの同一行の重複クエリが1回に圧縮される。

- 全書き込みメソッド（update / remove / bulkUpdate 等）は完了時にメモを自動破棄する
  → 同一リクエスト内の read-your-writes は維持される（呼び忘れが構造的に起きない）
- `createCrudService` を経由しない生SQL書き込み（`db.update(Table)` 等）をした場合のみ、
  直後に `service.invalidateRequestMemo()` を手動で呼ぶこと（必須ルール）
- リクエストスコープ外（cron / CLI）では自動的に素通しになる（従来動作）
- 対象基準: identity-stable かつ高 fan-in な行（例: user のセッションユーザー行、
  setting のグローバル設定）のみ。list / search はメモ化されない
- 詳細・注意点: `src/lib/requestMemo/README.md`

### systemColumns と特権書き込み（systemUpdate / systemBulkUpdateByQuery）

Create/Update Zod スキーマから意図的に除外したシステム管理カラム（`ended_at`,
`sort_order`, `sold_out_at` 等）は、通常の `update()` に渡しても parseUpdate で
strip される。従来はこの書き込みだけ生SQL（`db.update(Table)`）に落ちるしかなく、
audit 自動記録・requestMemo 自動 invalidate 等の横断フックが素通りしていた。
`systemColumns` はこれを正規経路に戻すための宣言（Drizzle のみ）。

```typescript
// 宣言（drizzleBase / domain.json）
createCrudService(GachaMachineTable, {
  ...,
  systemColumns: ["ended_at", "archived_at", "played_count", "sold_out_at"],
});

// システムカラムの更新（parseUpdate バイパス・allowlist 厳密適用）
await base.systemUpdate(id, { ended_at: new Date() });

// SQL 式によるアトミック加算 + CASE（1 クエリ）
await base.systemUpdate(id, {
  played_count: sql`${GachaMachineTable.playedCount} + 1`,
  sold_out_at: sql`CASE WHEN ${GachaMachineTable.stock} <= 1 THEN now() ELSE ${GachaMachineTable.soldOutAt} END`,
});

// WHERE 条件の特権一括更新
await base.systemBulkUpdateByQuery({ status: "active" }, { archived_at: new Date() });
```

ルール:

- **fail-closed**: `systemColumns` 未宣言のサービスでは system 系メソッドは常に throw。
  宣言外のキーを渡した呼び出しも throw する（Zod との二重管理はせず宣言＝自己文書化。
  通常カラムを同一アトミック書き込みに含めたい場合はそのカラムも明示宣言する）
- 宣言はプロパティ名・DB カラム名のどちらでも可。存在しないカラム名はサービス生成時に
  throw（typo の fail-fast）
- 値には drizzle の `sql\`\`` 式を渡せる（アトミックインクリメント・CASE・COALESCE 採番等）。
  通常の `update()` は従来どおり SQL 式を受け付けない
- updatedAt 付与・audit 記録・requestMemo 自動 invalidate・制約エラー変換は
  `update()` / `bulkUpdateByIds()` と同一挙動。追加クエリなし（ホットパス安全）
- belongsToMany リレーション同期は対象外
- **サービス層限定の特権**。汎用 HTTP ルート（`/api/[domain]/**`）には配線されておらず、
  今後も配線しないこと。HTTP 入力の安全網は従来どおり Zod strip
- business ドメインは domain.json の `systemColumns` に宣言して `dc:generate` で反映、
  core ドメインは drizzleBase の `createCrudService` オプションに直接宣言する

### hiddenColumns（秘匿カラム — サービス境界の外に出さない）

パスワードハッシュ等「DB には保持するがサービスの戻り値に決して含めてはならない」
カラムをテーブル定義レベルで宣言する仕組み（Drizzle のみ）。宣言はサービスオプション
ではなく **entities/drizzle.ts のテーブル定義直後** に置く。テーブルオブジェクトを
参照するあらゆるコードから import 順序に依存せず参照できるようにするため。

```typescript
// entities/drizzle.ts（テーブル定義の直後）
import { defineHiddenColumns } from "@/lib/crud/drizzle/hiddenColumns";

defineHiddenColumns(UserTable, ["localPassword"]);
```

効果（すべて自動・個別ルート対応不要）:

- `createCrudService` の**全メソッドの戻り値**から宣言カラムが `null` に置換される
  （get/search/create/update/upsert/bulk 系/query/restore/... 戻り形状に依存しない
  deep-strip のため、将来メソッドが増えても fail-closed でカバーされる）
- **他ドメインの `withRelations` 展開**で埋め込まれる行（belongsTo / belongsToMany /
  hasMany、ネスト展開含む）からも除去される
- audit 記録・requestMemo は生値で動作した後、呼び出し元へ返る直前に置換される
  （audit の before/after 差分検出は壊れない。秘匿値自体は audit denylist が別途マスク）

ルール:

- プロパティ名（camelCase）で宣言。存在しないカラム名は定義時に即 throw（fail-fast）
- 値は「キー削除」ではなく「null 置換」。エンティティ型を nullable にしておけば
  型と実態が一致する
- サーバー内部で秘匿値を読む正規経路は、`createCrudService` を経由しない専用
  ファインダー（`services/server/finders/` に直接 drizzle 読み取り）のみ。
  例: `user/services/server/finders/findByIdWithSecrets.ts`。
  ファインダーの戻り値を HTTP レスポンスに乗せることは厳禁
- 未宣言のテーブルにはラッパー自体が適用されず、性能影響ゼロ
- Firestore アダプタは対象外（FROZEN。ドクトリン上 Firestore に秘匿情報は置かない）

---

## 提供メソッド一覧

### 基本 CRUD

| メソッド | 引数 | 戻り値 | 備考 |
|----------|------|--------|------|
| `create(data, tx?)` | Insert | Select | M2M 自動同期、sortOrder 自動割当 |
| `get(id, options?)` | string | Select \| undefined | withRelations / withCount 対応 |
| `list(options?)` | WithOptions | Select[] | 全件取得（上限 100）。フィルタ不要な場合のみ |
| `update(id, data, tx?)` | string, Partial | Select | M2M 差分同期 |
| `systemUpdate(id, data, tx?)` | string, Record | Select | 特権更新（systemColumns 必須・SQL 式可・サーバー専用） |
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
| `bulkUpdateByQuery(where, data, tx?)` | WhereExpr, Partial | { count } | 条件一致に同じ値を適用（parseUpdate 経路・M2M 非対応） |
| `systemBulkUpdateByQuery(where, data, tx?)` | WhereExpr, Record | { count } | 特権一括更新（systemColumns 必須・SQL 式可・サーバー専用） |
| `bulkDeleteByIds(ids, tx?)` | string[] | void | ソフト/ハード自動判定 |
| `bulkHardDeleteByIds(ids, tx?)` | string[] | void | 物理削除 |
| `bulkDeleteByQuery(where, tx?)` | WhereExpr | void | 条件一致を削除 |
| `replaceByQuery(where, records, options?, tx?)` | WhereExpr, Insert[], ReplaceByQueryOptions | Select[] | 条件一致行の全削除 + records 挿入を単一 tx で（詳細は下記） |
| `duplicate(id, options?, tx?)` | string, DuplicateOptions | Select | `options.name` 指定時はそれを採用、未指定時は name に「_コピー」付与 |

### replaceByQuery（条件一致行のアトミック全置換）

「親スコープ配下の子リストを丸ごと入れ替える」ためのメソッド（Drizzle 専用）。
`bulkDeleteByQuery(where)` → `insert(records)` を **単一トランザクション**で合成するため、
並行リーダー（READ COMMITTED）からは常に旧セットか新セットのどちらかが見え、
「削除済み・挿入前」の空状態は観測されない。失敗時は削除ごと巻き戻る。

```ts
// gacha_machine_id = X 配下の景品リストを丸ごと置換
const inserted = await service.replaceByQuery(
  { field: "gacha_machine_id", op: "eq", value: machineId },
  records, // parseCreate（Zod）経路を通る。挿入行を入力順で返す
);
```

- **records 空 = 削除のみ**: `records: []` は許可され、条件一致行を削除して `[]` を返す。
- **スコープガード（fail-closed）**: where の `eq` 句（`and` 直下含む。`or` 分岐内は対象外）を
  スコープ制約とみなす。record 側の該当カラムが未指定なら where の値で自動補完し
  （Zod スキーマ外で strip された場合も復元）、parse 後の値が食い違う record が
  1 件でもあれば **422** で全体を拒否する。records がスコープ外の親に逃げることはない。
  `eq` 句を 1 つも含まない where はガード対象外（削除条件としては機能する）。
- **`options.sortOrderFromIndex`**: `sortOrderColumn` 設定済みサービスで `true` を渡すと、
  records の**配列順**に fractional sort key を自動採番する（records 内の明示値より優先）。
  `sortOrderColumn` 未設定で指定すると throw（fail-fast）。未指定時は sort_order 無加工
  （NULL は searchForSorting の自動初期化に委ねる）。
- **削除フェーズ**: `bulkDeleteByQuery` と同じ分岐。`useSoftDelete` テーブルはソフトマーク
  （旧行が残るため、同一 id を records で再送すると PK 衝突する点に注意）、物理削除は
  制約エラー変換 + Storage クリーンアップ（コミット後 best-effort）を行う。
- **belongsToMany 非対応**: records の M2M フィールドに**非空の値**が入っている場合は throw。
  空配列 / 未指定は Zod default（`[]`）由来のケースがあるため黙って無視する（M2M 同期は行わない）。
  リレーション同期が必要な場合は `create()` を個別に使う。
- **audit**: aggregate = `<prefix>.bulk_replaced` 1 行（`deletedCount` / `insertedCount` /
  `criteria` / sample ID）、detail = 削除行ごとの deleted + 挿入行ごとの created、off = 記録なし。
- **ロックなし**: 親行のロックは取得しない（アトミックコミットで読者には十分。
  排他が必要な場合は呼び出し側で tx + ロックを張り、`tx` 引数で合流させる）。
- **HTTP/hook**: `POST /api/[domain]/bulk/replace-by-query`（body `{ where, records, options? }`）、
  クライアント `apiClient.replaceByQuery(where, records, options?)`、
  生成フック `useReplaceByQuery<Domain>`（Drizzle ドメインのみ生成）。
  アクセス制御は operations キー `replaceByQuery`（未宣言時は write ルールにフォールバック）。

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

## Storage 連携クリーンアップ

`mediaUploader`（単一 / string）および `mediaUploaderMulti`（複数 / string[]）列が参照する
Storage 上のファイルは、レコードが **物理削除** されるタイミングで `createCrudService` が
自動削除する（best-effort）。ドメイン側でラッパーを書く必要はない。

- 有効化: `createCrudService` の `storageCleanupFields` に対象フィールド名を渡す。
  生成される `drizzleBase.ts` が `extractStorageFields(conf)` の結果を自動的に渡すため、
  `mediaUploader` を持つドメインは設定不要で有効になる。
- 対象操作: `hardDelete` / `bulkHardDeleteByIds`（常に物理削除）、および
  `remove` / `bulkDeleteByIds` / `bulkDeleteByQuery`（`useSoftDelete=false` のときのみ物理削除）。
- ソフトデリート（`deletedAt` 設定）では復元可能性を保つためファイルは保持し、`hardDelete` 時にのみ削除する。
- `duplicate` のみファイル複製が必要なため、`storageIntegration/createStorageAwareDuplicate` を使った
  ラッパー（`wrappers/duplicate.ts`）で上書きする（生成器が自動生成）。

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

> **機能凍結**: Firestore アダプタは機能凍結済み。下表の制限は仕様として固定し、以後の機能拡張は行わない（理由: `docs/!must-read/バックエンド構成ドクトリン.md`）。

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
| replaceByQuery | 対応 | 非対応 |
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
