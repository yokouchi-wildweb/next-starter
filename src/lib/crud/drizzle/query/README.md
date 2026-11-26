# crud/drizzle/query

## Overview

- `search()` / `count()` の WHERE と ORDER BY を組み立てる SQL クエリビルダー群（純粋関数、DB アクセスは持たない）。公開の部品は `@/lib/crud/server`（`buildSearchWhere` / `buildSearchRankOrderBy` / `withIdTiebreak` / `composeSearchOrderBy`）

## Usage

### extraWhere

WhereExpr / relationWhere で表現できない条件を Drizzle SQL で直接注入する。

```typescript
import { sql } from "drizzle-orm";
await service.search({
  extraWhere: sql`EXISTS (SELECT 1 FROM other_table WHERE ...)`,
});
```

### extraOrderBy

`OrderBySpec`（カラム名ベース）で表現できない並び順を Drizzle SQL 式で注入する（COALESCE で nullable な日時を寄せる、CASE で優先度バケットを作る、JSONB の値で並べる等）。`search` / `searchWithDeleted` 専用。

```typescript
import { sql } from "drizzle-orm";
await service.search({
  // 実効終了時刻 = ended_at が無ければ sale_end_at
  extraOrderBy: [sql`COALESCE(${t.endedAt}, ${t.saleEndAt}) DESC`],
  orderBy: [["createdAt", "DESC"]], // extraOrderBy の同順位を並べ分けるタイブレーク
});
```

- ORDER BY 合成順: `searchRank` の句（searchQuery 指定時のみ）→ `extraOrderBy` → `orderBy`（未指定なら defaultOrderBy）→ `id`（`orderBy` に id が無い場合のみ）。合成は `composeSearchOrderBy`（`@/lib/crud/server`）
- 未指定なら並び順は変わらない
- サーバー専用。SQL オブジェクトは HTTP で渡せないため `/api/[domain]/search` には出さない（ルートは受け付けるパラメータを個別に組み立てる許可リスト方式）
- `count` / `countWithDeleted` は並び順を持たないので受け付けない。`searchForSorting` は sort_order 専用のため対象外
- 式の中で Date を埋め込むときは下の落とし穴に従う

### 落とし穴: `sql` テンプレートに Date を直接渡さない

`extraWhere` / `extraOrderBy` / `systemUpdate` の SQL 式など、`sql` テンプレートリテラル全般に共通（core/services.md raw_sql）。

- lint `raw-sql-date/no-date-param`（全 Tier error、詳細: eslint-rules/raw-sql-date.mjs）が `new Date()`・Date で初期化した const・型注記が Date の変数と引数を止める。`range.dateFrom` のようなメンバーは型情報が要るので見ない → 書くときに自分で守り、生の SQL の組み立て関数にはテストで押さえる（例: messaging の rawSqlParams.test.ts）
- Date を受ける独自の変換を通す等の正当な例外は理由付きの eslint-disable で外す

- 症状: JS の `Date` を `${...}` に直接埋め込むと PostgreSQL 側でパースに失敗し 500 エラー
- 原因: `sql` 内のパラメータは `Date.toString()` 相当（`"Sun Mar 01 2026 23:59:59 GMT+0900 (...)"`）で渡り、`::timestamptz` キャストを付けても解析できない
- 対処: `.toISOString()` で文字列化してから渡す。Drizzle の組み込みオペレータ（`eq` / `gt` / `lt` / `gte` / `lte` / `between` 等）は Date を正しくシリアライズするので変換不要

```typescript
// NG
sql`CASE WHEN ${t.completedAt} >= ${range.dateFrom} THEN 'current' ELSE 'previous' END`
// OK
sql`CASE WHEN ${t.completedAt} >= ${range.dateFrom.toISOString()} THEN 'current' ELSE 'previous' END`
```

## API

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

### テキスト検索（searchQuery）

- `searchFields` の各カラムに対して `ILIKE %query%` を OR で結合（結果集合・count はこれだけで決まる）。テキストでない列（enum・uuid・数値など、relation の FK 列も）は `::text` に cast して比べる（cast しないと Postgres が `operator does not exist` で拒む）。テキストの列（text・varchar・char）は cast しないので索引の効き方は変わらない
- 並び順: `searchRank` 指定時は後述の関連度ランキングを `extraOrderBy` / `orderBy` の前に置く。未指定なら `extraOrderBy`（あれば）→ `orderBy`
- SQL 片は `buildSearchWhere` / `buildSearchRankOrderBy`（`@/lib/crud/server`）として公開。`base.query()` で独自 JOIN を組む wrapper からも同じ順位付けを再利用できる
- 並び順の最後は `withIdTiebreak(table, orderBy, clauses)`（`@/lib/crud/server`）で閉じる。`orderBy` に id が無ければ `asc(id)` を末尾に足す（base `search()` と同じ規則）。wrapper で `buildOrderBy` の結果だけを使うと、同順位の行の並びが DB 任せになり、ページをまたいで入れ替わる・重複する。base と同じ合成順（rank → extraOrderBy → orderBy → id）でよければ `composeSearchOrderBy` を使う
  ```ts
  const orderClauses = composeSearchOrderBy(table, orderBy, {
    rank: rankOrderClause,
    extra: extraOrderBy,
    base: buildOrderBy(table, orderBy),
  });
  ```

### searchRank（関連度ランキング）

ピッカー等のキーワード検索で「探している 1 件」を上に出すための並び替え。`searchQuery` があるときだけ ORDER BY の先頭に入り、結果集合・count・先読み一覧（searchQuery 無し）には影響しない。Drizzle 専用（Firestore では無視）。

```typescript
// 呼び出し側（SearchParams）
searchRank?: boolean | { fields?: Array<string | { field: string; weight?: number }> }
//  true  = サービスの defaultSearchRank、無ければ searchFields を等重み
//  spec  = 呼び出しごとに重みを指定
//  未指定 / false = ランキングなし

// サービス側（createCrudService オプション）— 「どう並べるか」の既定のみ。ON/OFF は呼び出し側が決める
defaultSearchRank?: { fields: [{ field: "name", weight: 3 }, "email"] }
// ビジネスドメインは登録の entity.json の `searchRank` キーに同じ形で宣言 → pnpm generate domain が `<登録名>Base` に展開
```

採点式（フィールドごとに算出し合算。複数フィールド一致は合算で自然に加点）:

```sql
CASE
  WHEN lower(col::text) = lower(q)      THEN 100  -- 完全一致
  WHEN col::text ILIKE 'q%'             THEN 60   -- 前置一致
  WHEN col::text ~* '(^|[\s@._/-])q'    THEN 40   -- 語頭一致（空白・@・.・_・-・/ の直後）
  WHEN col::text ILIKE '%q%'            THEN 20   -- 部分一致
  ELSE 0
END * weight
-- ORDER BY (sum) DESC, <extraOrderBy>, <orderBy / defaultOrderBy>, id
```

例: user は `name` weight 3。「ab」で検索すると name 前置一致 = 60×3 = 180、email ドメイン語頭一致（`foo@abc.com`）= 40×1 = 40 となり、名前が ab で始まるユーザーが先に並ぶ。

ルール:

- 採点対象は `searchFields ∩ 実在カラム` に限定（WHERE に参加しない列で並び替えない、fail-closed）。全て除外された場合は legacy 経路にフォールバック
- weight は有限の正数のみ。HTTP 経由（`GET /api/[domain]/search?searchRank=...`）は `true|false|1|0` か `{"fields":[...]}` の JSON のみ受理、未知キー・weight 0〜100 外・20 フィールド超は 400
- クエリ由来の値は全てバインドパラメータ。スコアと weight のみリテラル
- `AsyncComboboxInput` / `AsyncMultiSelectInput` は既定で `searchRank: true` を送る（prop で `false` / spec に上書き可）。管理一覧など picker 以外の `search` 呼び出しは従来どおり
- `%q%` の全走査コストはランキングでは変わらない。大規模テーブルでは下記のインデックスを検討

#### 大規模テーブル向けインデックス推奨（pg_trgm、下流判断・[user-run]）

`ILIKE '%q%'` は B-tree を使えない。users 等が数十万行を超える場合は pg_trgm の GIN インデックスで WHERE 側の走査を抑える（並び替え式はフィルタ後の行にしか評価されないため、ここが効けば全体が軽くなる）。

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_name_trgm_idx  ON users USING gin (lower(name)  gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_email_trgm_idx ON users USING gin (lower(email) gin_trgm_ops);
```

- Neon は pg_trgm 利用可。拡張作成を含むため core には同梱せず、下流が必要なテーブルに対して手動で適用する
- 式インデックスを使うため `lower(col) LIKE lower('%q%')` 形でないと当たらない点に注意（現行 `ILIKE` はプランナが trigram index に当てられる。EXPLAIN で確認すること）
- 2 文字以下のクエリはトライグラム未満のため効果が薄い（既知の限界）

### ページネーション

```typescript
// runQuery 内部
SELECT * FROM table WHERE ... ORDER BY ... LIMIT limit OFFSET (page - 1) * limit
// 並列で COUNT(*) を実行
SELECT COUNT(*) FROM table WHERE ...
```

戻り値: `{ results: T[], total: number }`
