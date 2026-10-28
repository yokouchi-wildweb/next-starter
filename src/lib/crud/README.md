# 汎用 CRUD ライブラリ仕様

> このドキュメントは `createCrudService` を中心としたライブラリ内部のコアスペックです。
> 拡張するときは次の順で、手前で足りるならそこで止める: ① 提供メソッド → ② `relationWhere` → ③ `extraWhere` / `extraOrderBy` → ④ `base.query()` + `wrappers/` → ⑤ 独自サービス。
> フックの使い方は [hooks/README.md](./hooks/README.md)。

---

## ディレクトリ構成

```
src/lib/crud/
├── types.ts                  # 共通型（SearchParams, WhereExpr, BelongsToManyFilter 等）
├── index.ts                  # バレルエクスポート
├── client/                   # クライアント層（createApiClient, イベント）
├── components/               # CRUD 用 UI ボタン群
├── hooks/                    # 汎用フック（dc:generate で各ドメインに展開）
│   └── internal/             # mutation 共通実装（useDomainMutation / concurrentMutation + テスト）
├── presenters/               # カラムメタデータ・フォーマッタ
├── storageIntegration/       # ストレージ連携（ファイル削除・複製）
├── collections/              # ドメイン集約（collections オプション・同期・射影・複製・先頭 1 件の SQL）
├── utils/                    # パス・スキーマユーティリティ
├── drizzle/                  # Drizzle (Neon/PostgreSQL) 実装
│   ├── service.ts            # createCrudService 本体
│   ├── types.ts              # Drizzle 固有型
│   ├── utils.ts              # INSERT デフォルト値、キー正規化等
│   ├── belongsToMany.ts      # M2M 同期・ハイドレーション
│   ├── fractionalSort/       # Fractional Indexing（並び替え。sortKeyOrder.ts = 鍵の並べ方・比べ方）
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
  defaultSearchRank?: SearchRankSpec,          // 関連度ランキングの重み既定（searchRank 節）
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

  // ファイル台帳との連動（Drizzle のみ、後述「storage オプション」）
  storage?: CrudStorageBinding,

  // ドメイン集約（Drizzle のみ、後述「ドメイン集約」）
  collections?: CrudCollectionConfig[],
})
```

### 型パラメーター（TCreate / DefaultInsert）と upsert の要求型

- `TCreate` = サービスが受け取る作成データ型。省略時は `DefaultInsert<TTable>`
  （= `InferInsertModel<TTable>` から `id` / `createdAt` / `updatedAt` を除いた型、`drizzle/service.ts`）。
  `entities/drizzle.ts` のテーブル定義変更がそのまま型に連動する
- 作成用型を差し替える場合は `createCrudService<MyTable, CustomCreate>(...)` と第 2 型引数を明示する
- `defaultUpsertConflictFields` / `upsert` の `conflictFields` は `TCreate` のキーからしか選べない。
  解決順: 呼び出しの `conflictFields` → `defaultUpsertConflictFields` → `id`（`resolveConflictTarget`）
- `upsert(data: Insert & { id?: string })` は **完全な Insert 形状**を要求する。
  同じ値を `insert ... values` と `onConflictDoUpdate.set`（`id` のみ除去）の両方に使う
  1 ステートメント実装のため、型レベルでは「新規作成できるデータ」でなければならない。
  各フィールドをオプショナルにした部分更新用スキーマは `upsert` に渡せない
- 既存レコードの部分更新は `update(id, Partial<Insert>)` を使う（`undefined` は除去されて送られる）

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

#### 生 drizzle（select / returning）では効かない

`db.select()` / `insert().returning()` など `createCrudService` を経由しない生クエリは
自動除去を通らない。その行を HTTP レスポンスや Client Component の props（RSC payload）に
載せると秘匿値がそのまま漏れる（例: 並び替え用の生 select を持つ一覧 loader）。

- 行を丸ごと取りたい生クエリは `getPublicColumns(<Table>)` を select / returning に渡す。
  秘匿カラムは SQL 上 `null as "<column>"` になり、DB から取り出されない
  （戻り値の形はサービス経由の null 置換と同じ。未宣言テーブルでは `getTableColumns` と同じ）

  ```typescript
  import { getPublicColumns } from "@/lib/crud/drizzle/hiddenColumns";

  const [user] = await db.insert(UserTable).values(values).returning(getPublicColumns(UserTable));
  const rows = await db.select(getPublicColumns(UserTable)).from(UserTable).where(...);
  ```

- 必要な列だけを明示 select するなら、秘匿カラムを並べない
- where / orderBy での参照（`eq(Table.tokenHash, hash)` 等）は問題ない
- **lint `hidden-columns/no-raw-select`（error、上流・下流とも）** が次を検出する（`eslint-rules/hidden-columns.mjs`）:
  - select / returning の引数に `<Table>.<秘匿カラム>` や `getTableColumns(<Table>)` を書いている
  - 秘匿カラムを持つテーブルへの引数なし `select().from(<Table>)` / `insert|update|delete(<Table>)…returning()`
  - 対象テーブルは `src/**/entities/drizzle.ts` の `defineHiddenColumns` 宣言から自動で集める（手書きの一覧なし）
  - `services/server/finders/` と `entities/` は対象外。それ以外の正当な例外は理由付き eslint-disable
  - 限界: テーブルは識別子名で照合（import 別名・変数経由は追わない）、relational query（`db.query.*`）は対象外
- テスト: `pnpm test:hidden-columns-lint`

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
| `search(params?)` | SearchParams & WithOptions & ExtraWhereOption & ExtraOrderByOption | PaginatedResult | メインの検索メソッド |
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
  制約エラー変換を行う。storage オプション付きのサービスでは台帳も連動する（後述「storage オプション」の replaceByQuery）。
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
| `duplicateWithIdMap(id, options?, tx?)` | duplicate と同じ複製をし、集まりの旧→新の従属 id の対応表も返す（集まりが無ければ `idMaps` は `{}`。後述「ドメイン集約」） |

---

## 汎用フック（hooks/）の mutation 契約

> 生成フックごとの使い方（命名・条件付き生成・取得/更新の使用例）は [`hooks/README.md`](./hooks/README.md)。

`useCreateDomain` / `useUpdateDomain` / `useDeleteDomain` / `useUpsertDomain` / `useBulk*Domain` / `useDuplicateDomain` / `useRestoreDomain` / `useHardDeleteDomain` / `useReorderDomain` / `useReplaceByQueryDomain` は全て `hooks/internal/useDomainMutation.ts` の薄いラッパー。戻り値は `{ trigger, isMutating, isLoading, error }`（bulkUpdate 系は `data` も）。

**同一インスタンスでの並列 trigger は安全**（`Promise.all(rows.map((r) => update.trigger(...)))` のような一括保存を想定）:

- 失敗した trigger は必ずその error で reject する（並列数に依存しない）
- 成功した trigger は必ず結果 T で resolve する（undefined は返さない）
- `isMutating` は 1 件でも in-flight がある間 true、全件 settle で false
- `error` / `data` は「直近に settle した trigger の結果」（逐次利用なら useSWRMutation と同じ）
- 成功した trigger ごとに `revalidateRelatedCaches(revalidateKey)` を await してから resolve する。再検証自体の失敗は書き込み成功を reject に変えない（握って `console.error`）
- `mutate(key, promise, { populateCache: false, throwOnError: true })` 経由なので、完了後の `key` 自身の再検証と SWR の mutation ウィンドウ（競合する revalidate の破棄）は従来どおり

**useSWRMutation を使わない理由**: swr/mutation は「最後に開始した trigger」以外の結果を捨てる（`ditchMutationsUntilRef`）。並列時に先行分が成功でも失敗でも state 更新・onSuccess・throw を行わず undefined で resolve するため、一括保存の途中失敗が「全件成功」に見える無言のデータ欠損を起こす（tier3 本番で発生）。

**テスト**: `pnpm test:crud-hooks`（node:test + Node 組み込みの TypeScript type stripping、追加依存なし）。React 非依存の中核 `concurrentMutation.ts` を検証する。

**独自 mutation フックの作り方**: `useDomainMutation(key, fn, revalidateKey?)` を `@/lib/crud/hooks` から import して包む（core の useChangeUserRole / useAdjustWallet / useProfileUpsert / useAdminSetup 等が実例）。`useSWRMutation` の直接利用は禁止（同じ握りつぶしを再発させる）。

---

## storage オプション（ファイル台帳との連動）

`storage://` の ref を保存するメディア列を、ファイル台帳（[features/core/storageObject](../../features/core/storageObject/README.md)）と同じ TX で連動させる。メディア列の書き込みはこの binding か `storageObjectService.attach` だけで行い、生 SQL・systemUpdate・ref の別表への複写はしない（共有は copy）。dc:generate はメディア列を持つドメインの drizzleBase にこの binding を出す（purpose = `<domain>.<field>`）。指定しないサービスの挙動は変わらない。

```ts
import { storageBindingFor } from "@/features/core/storageObject/services/server";

createCrudService(SampleTable, {
  storage: storageBindingFor("sample", [
    { name: "main_image", purpose: "sample.main_image" },
    { name: "gallery_images", purpose: "sample.gallery_images", multi: true },
  ]),
});
```

- lib/crud が持つのは型（`storageIntegration/types.ts` の `CrudStorageBinding`）と呼び出し口（`applyStorageBinding.ts`）だけ。台帳の操作は features 側の `storageBindingFor` が差し込む（lib → features の依存を作らない）
- **create / update / upsert**
  - 業務行を書いた直後に、同じ TX の中で `afterWrite` を呼ぶ。update / upsert は、書く前の行を `FOR UPDATE` で読む
  - 新しく現れた ref は attach する。紐付くのは次のときだけで、それ以外は 400 で TX ごと巻き戻る
    - 台帳の行が ready で、まだ紐付いていない
    - 用途と ref が一致する
    - 保存者がアップロードした本人である
  - 外れた ref は deleted（reason `replaced`）にし、実物は commit 後に消す
  - メディア列に触れない update は、台帳を連動させない
- **旧 URL（http(s)）**
  - update で前と同じ値のときだけ保持できる。新しい値と、create での保存は 400
  - import や複製では、`storageObjectService.copy` / `putFromServer` で新しい ref にする
  - 置換で外れた旧 URL の実物は消さない
- **物理削除**
  - 対象は `hardDelete` と、soft delete を使わない表の `remove` / `bulkDeleteByIds` / `bulkDeleteByQuery`
  - 削除する行を `FOR UPDATE` で読み、同じ TX で ref を deleted（reason `record_removed`）にする
  - 自分の旧バケットの旧 URL は、commit 後に実物ごと消す
  - `storageBindingFor(..., { onHardDelete: "keep" })` にすると何もしない（台帳と実物を残す。上流では使っていない選択肢）
- **soft delete・restore**: 何もしない。紐付けを残すので、restore で戻せる
- **duplicate**
  - TX の外で先に、メディア列を copy で新しい ref にする。所有者は実行者になる
  - そのあと新しい行を create し、そこで紐付ける
  - 1 件でも複製に失敗したら、複製全体を失敗にする（元行はそのまま）
- **replaceByQuery**
  - where に合う旧行を `FOR UPDATE` で読み、置き換えた直後に同じ TX の中で `afterReplace` を呼ぶ
  - 値ごとに、旧行全体と新しい行全体を比べる
    - 新しい行にだけある値: create と同じ規則で attach（旧 URL・他人の ref などは 400）
    - 同じ id の行に残る値: 何もしない（records に旧行の id を入れて送れば、紐付けはそのまま）
    - 別の id の行に移った ref: 台帳の紐付け先を新しい行へ付け替える（`storageObjectService.rebind`）。旧 URL は残すだけ
    - 旧行にだけある値: 物理削除と同じ扱い（ref は `record_removed`、自分の旧バケットの旧 URL は実物ごと消す。`onHardDelete: "keep"` なら残す）
  - 同じ値を新しい行の 2 か所に入れたら 400（共有は copy）
  - soft delete の表: 旧行は値を持ったまま残るので、紐付けも残す。旧行の値を新しい行に入れたら 400（restore で同じファイルを 2 行が指さないため）。records がメディア列に触れなければ台帳は連動させない
  - `afterReplace` を持たない binding（`storageBindingFor` 以外の自作）では、replaceByQuery を DomainError 400 で拒否する
- **bulkUpdateByIds / bulkUpdateByQuery / bulkUpdate / bulkUpsert**: メディア列を変える呼び出しは DomainError 400（行ごとの差分計算は初版の範囲外）。行ごとに update を使う
- **TX と後片付け**
  - 呼び出し元が tx を渡さなければ、内部で TX を張る。commit 後に `afterCommit` で実物を消す（ベストエフォート）
  - tx を渡された場合は、外側の TX がまだ commit されていないので消さない
  - どちらの場合も、消し残しは台帳に deleted・`object_removed_at` null として残り、掃除 cron が片付ける
- **actor**: routeFactory が敷く AuditContext の actorId。`runAsSystem` の中では null（所有者 null のサーバー内の書き込みだけが紐付く）
- **storageFields**: storage を指定したサービスは、binding の列の宣言（`name` / `purpose` / `multi` / `scope`）を読み取り専用の `service.storageFields` で出す。指定しないサービスでは undefined。どの列がメディア列かを知る正本で、dataMigration の import / export が使う（クライアントの申告は信用しない）
- **FK cascade**: メディア列を持つ表に、親の削除に伴う DB の `onDelete: "cascade"` を付けてよい
  - DB が消した行は binding を通らない。残った紐付けは、掃除 cron（`storage-sweep`）の照合が後の実行で外し、実物を消す（その場ではない。予算と上限つき。[storageObject README「掃除」](../../features/core/storageObject/README.md)）
  - すぐ片付けたい表は、子の表の FK を `onDelete: "restrict"` にし、親のサービスの削除（remove / hardDelete の wrapper）の中で、同じ tx を渡して子のサービスの削除（`bulkDeleteByQuery` など）を先に呼ぶ（任意）

## ドメイン集約（collections オプション）

主ドメインの 1 行に属する従属ドメインの行の集まりを、主のレコード上の「列でない配列」として読み書きする（例: 商品の 1 行に属するギャラリー画像の行）。書き込みは主の保存と同じ TX で従属のサービスを通して差分同期し、読み出しでは並び順の配列を全件載せる。指定しないサービスの挙動は変わらない（Drizzle のみ）。

### 呼び名と API 名

| 呼び名 | API |
|--------|-----|
| 主ドメイン | `collections` を指定したサービス |
| 従属ドメイン | `CrudCollectionConfig.service` が返すサービス（`createCrudService` の戻り値でよい） |
| 集まり（の項目） | `CrudCollectionConfig`（主のレコード上のフィールド名 = `fieldName`） |
| 集まりの値 | `CollectionValue`（`valueColumn` の値。`string \| number`） |
| 差分同期 | `syncCollection` / `createCrudService` の create・update・upsert |
| 先頭 1 件の SQL | `firstInCollection`（列の形）/ `firstInCollectionForAlias`（別名の形） |
| 2 段の複製 | `duplicateWithCollections` / `duplicate` / `duplicateWithIdMap` |
| 旧→新の従属 id の対応表 | `CollectionDuplicateResult.idMaps` |
| ファイルの複製の口 | `service.duplicateStorageValues`（storage オプション付きのサービス） |
| 集まりの項目名の一覧 | `service.collectionFields` |

### 宣言

```ts
import { createCrudService } from "@/lib/crud/drizzle";

// 従属: 並びの列を systemColumns に宣言する（並びは systemUpdate で書く）
export const galleryImageService = createCrudService(GalleryImageTable, {
  systemColumns: ["sort_order"],
  storage: storageBindingFor("gallery_image", [{ name: "image", purpose: "gallery_image.image" }]),
});

// 主
export const productService = createCrudService(ProductTable, {
  collections: [
    {
      fieldName: "galleryImages",                 // 主のレコード上の配列（列ではない）
      service: () => import("./galleryImageService").then((m) => m.galleryImageService), // 循環を避けて遅延で渡す
      parentColumn: GalleryImageTable.productId,  // 主への参照列（主の物理削除で cascade する FK）
      valueColumn: GalleryImageTable.image,       // 集まりの値の列（差分はこの値で取る）
      sortColumn: GalleryImageTable.sort_order,   // text（fractional の鍵。既定）か integer（0 始まりの添字）
      maxItems: 10,                               // 省略 = 上限なし。超える配列の保存は 400（切り詰めない）
      minItems: 1,                                // 省略 = 下限なし。下回る保存は 400（下の「最小件数」）
      duplicate: true,                            // 主の複製で従属も写すか（既定 true）
    },
  ],
});
```

- 集まりは 1 行 1 値: 従属の 1 行が集まりの 1 要素で、`valueColumn` の値で見分ける（同じ値の重複は持たない）
- `parentColumn` / `valueColumn` / `sortColumn` は同じ従属の表の列で、互いに別の列。従属の表は `id` 列を持つ
- 論理削除の従属（`deletedAt` 列を持つ表）は扱わない（宣言時に throw）
- 宣言の誤り（列の取り違え・`fieldName` が主の列や belongsToMany の項目と重なる・並びの列が text / integer でない・`maxItems` / `minItems` の値の誤り）はサービス生成時に throw する

### 書き込み

- create / update / upsert の入力の集まりの項目は、parse の前に外して検査する（DB に触れる前に 400）
  - 省略（または undefined）= 維持、`[]` = 全部消す
  - 配列でない・空の要素・重複・`maxItems` 超過・`minItems` 不足は 400。切り詰めない（`maxItems` を超えた既存の行も黙って消さない）
- 同期は主の行を `FOR UPDATE` でロックしてから従属を全件読み直し、値で差分を取る
  - 変わらない値の行は残す（従属の id を保つ）/ 消えた値の行は従属の `hardDelete` / 新しい値は従属の `create`
  - 並びは同期のたびに配列順に振り直す（text = fractional の鍵、integer = 添字）。値の変わった行だけ従属の `systemUpdate` で書く
  - 主の保存が後勝ち: 読んでいない行は消さない。従属の API からの直接の書き込みは、次の主の保存でその配列に揃う
- 戻り値には書いた値の配列を載せる
- `bulkUpsert` / `bulkUpdate` / `bulkUpdateByIds` / `bulkUpdateByQuery` / `replaceByQuery` は、集まりの値（`[]` を含む）が入っていれば DB を変える前に 400。無ければ今のまま
- 呼び出し元が tx を渡さなければ内部で TX を張る。従属の `hardDelete` が外したファイルは、従属の storage binding の動きのまま（外から tx を渡すので掃除 cron が片付ける）
- base を通らない書き込み（手書きのドメイン・fork の独自の保存）は単独関数 `syncCollection({ parentTable, parentId, collection, values }, tx?)` で同じ規則の同期ができる（主の行が無ければ 404）

### 最小件数（minItems）

`minItems`（非負の整数、省略 = 下限なし）を宣言した集まりは、下回る保存を 400（`<fieldName> は <minItems> 件以上必要です`）で断る。

- create: 項目の省略（または undefined）は `[]` とみなして検査する。`minItems` が 1 以上なら DB に触れる前に 400
- update: `[]` / 下限未満の配列は 400（DB に触れる前）。項目の省略は今までどおり触らない（維持）
- upsert: 渡した配列は同じく DB に触れる前に検査する。項目を省くと、新規か更新かは書くまで分からないので、主の書き込みの後に同じ TX で従属の件数を数え、下限未満なら 400 で巻き戻す（新規の行は残らない。下限を満たす既存の行への upsert は通る）
  - 呼び出し元が tx を渡したときは、その TX の中で throw する（巻き戻しは呼び出し元の TX）
- 単独関数 `syncCollection` も渡した値を同じく検査する
- 検査しないもの
  - 複製の内側の主の create（従属は 2 段目で複製元の件数のまま写す。複製元が下回っていても断らない）
  - `bulkUpsert` / `bulkUpdate*` / `replaceByQuery`（集まりの値を受け付けない。`bulkUpsert` / `replaceByQuery` は集まりなしで主の新規行を作れるので、必須の集まりがあるドメインでは使い方に注意）
  - 従属の API からの直接の書き込み・主の削除（従属の件数は lib が見張らない。次の主の保存で検査する）
- 宣言の検査（サービス生成時に throw）: 非負の整数・`maxItems` 以下・1 以上と `duplicate: false` の併用は不可（複製すると必ず下回るため）
- `minItems` を宣言しない（または 0 の）サービスは今のまま（TX もクエリも増えない）

### 読み出し

- 配列を載せる口: `get` / `getWithDeleted` / `list` / `listWithDeleted` / `search` / `searchWithDeleted` / `searchForSorting` と、create / update / upsert の戻り値
  - `restore` / `reorder` / `systemUpdate` / bulk 系の戻り値には載せない（その行を保存しても、省略 = 維持なので失わない）
- 件数で打ち切らない（`DEFAULT_HAS_MANY_LIMIT` や主のページの大きさに依らず全件）。従属が無ければ `[]`
- 並びは 並びの列 ASC NULLS LAST → id ASC。text の並びの列は `COLLATE "C"`（下の「並びの鍵の照合順序」）
- 集まりごとに呼び出し 1 回で 1 クエリ（主の id の IN）。呼び出し元の tx の外（`db`）で読む。複製の 1 段目の読み出しも同じ
- TS 側の先頭 1 件は配列の `[0]`
- 一覧の表示: `formatCollectionThumbnails(value)`（`@/lib/crud`。先頭 1 件のサムネイルと、残りがあれば `+N`。解決できない値は数えず、0 件は null）。生成の presenters は主の集まりの項目（`mediaCollection`）にこれを使う。旧来の複数メディア列（mediaUploaderMulti）は `formatMediaThumbnails`（先頭 3 件を重ねて `+N`）のまま

### 先頭 1 件の SQL

SQL の中で集まりの先頭 1 件（並び順の最初の従属の行）の値を使う。主の行ごとに 1 値のスカラー副問い合わせで、集まりが空なら NULL。select / where / orderBy にそのまま置け、`COALESCE` / `CASE` で包める。

```ts
import { firstInCollection, firstInCollectionForAlias } from "@/lib/crud/drizzle";

// 列の形: 主の id を列（表・alias の列）か SQL で渡す
db.select({ id: ProductTable.id, cover: firstInCollection(galleryCollection, ProductTable.id) }).from(ProductTable);

// 別名の形: 主の表の別名を文字列で渡す（手書きの sql`` / extraWhere / extraOrderBy 用）
sql`select p.id, coalesce(${firstInCollectionForAlias(galleryCollection, "p")}, '') as cover from products p`;
```

- 既定は値の列を返す。`{ select: <従属の列> }` で別の列（例: caption）を返す。別名の形は `{ parentIdColumn }` で主の id 列の名前を変えられる（既定 `"id"`）
- どちらも drizzle の SQL の断片（識別子だけで値の bind は無い）
- lib が作る SQL の断片は列を `"表名"."列名"` で修飾する（drizzle は 1 表の select の項目に置いた SQL の列を表名なしで書くため、副問い合わせの中で主と従属の列が混ざる）

### 複製（2 段）

`duplicate` は集まりの従属ごと 2 段で複製する。

1. TX の外: 複製元の主を読み、主と従属のファイルの列を各サービスの `duplicateStorageValues`（= storage binding の `duplicateValues`）で新しい ref に写す。1 件でも失敗すれば throw し、DB には何も書かない
2. 1 つの TX（呼び出し元の tx があればそれ）: 集まりの項目を外して主を作り（get が載せた配列を主の create に流さない）、従属を複製元の並び順に従属の `create` で作る（id・主への参照・並び・作成/更新日時以外の列と、写したファイルの値）。並びは同期と同じく振り直す

- 切り替えは宣言の `duplicate` だけ（呼び出しごとの切り替えは無い）。`false` の集まりは写さず、複製した主の集まりは空
- `duplicate()` の戻り値は今までどおり新しい主の行（集まりの配列つき）。旧→新の従属 id の対応表は `duplicateWithIdMap(id, options?, tx?)` → `{ record, idMaps: { [fieldName]: Map<旧 id, 新 id> } }`（集まりの無いサービスでは `idMaps` は `{}`）
- 単独関数 `duplicateWithCollections({ service, collections, id, options }, tx?)` は base の duplicate を通らない呼び出し（手書きのドメイン・fork）でも使える。`service` は `get` / `create`（と任意の `duplicateStorageValues`）を持てばよい
- 2 段目が巻き戻ると、1 段目で写したファイルは未紐付けのまま残り、掃除 cron（storage-sweep）が回収する
- ドメインの wrapper で `duplicate` を差し替えるなら、その中で `duplicateWithCollections` を呼ぶ（呼ばなければ集まりは写らない）。`duplicateWithIdMap` はドメインが差し替えた `duplicate` を通らない
- `duplicateStorageValues` は実際にファイルを写す（読み取り専用の宣言ではない）。複製以外の目的で呼ばない
- 従属の create の入力スキーマ（parseCreate）に無い列は写らない
- 仕組み: 集まりのあるサービスだけ、storage binding の外側で `duplicate` / `duplicateWithIdMap` を包む（主のファイルは主の binding で写して紐付き、主の create は storage binding → 集まりの層を通る）。storage だけのサービス・オプションの無いサービスの複製は変わらない

### 主の削除

- 主の論理削除: 従属はそのまま残る（掃除 cron の照合では「行がある」と数える）。restore で戻る
- 主の物理削除: 従属は DB の FK cascade で消える。従属のサービスは呼ばない（従属のファイルの紐付けは掃除 cron の照合が外す）

### CSV / ZIP（dataMigration）

- 集まりの項目は CSV / ZIP のデータ移行に対応しない。どれが集まりの項目かは `service.collectionFields` が正本
- 取り込み: CSV の見出し・行のキー・申告された項目のどれかに集まりの項目があれば、DB を変える前（メディアの写し・アップロードより前）に DomainError 400
  - チャンクの取り込み（画面）は各チャンクの先頭で調べる（チャンクは同じ見出しを持つので最初のチャンクで止まる）。ZIP 一括の取り込み（`importData`）は全チャンクを先に調べてから書く
- 書き出し: 選ばれていても集まりの項目は出さない（CSV の列・manifest の fields から外す。関連・hasMany のドメインも）

### 生成器からの配線

- domain.json の主の集まりの項目（`fieldType: "mediaCollection"`、[src/features/README.md](../../features/README.md)「主の集まりの項目（mediaCollection）」）から、`dc:generate` が従属の domain.json（無いときだけ）・主の `services/server/collections.ts`（`collections: CrudCollectionConfig[]`、毎回上書き）・主のスキーマ / モデル / フォームを生成する
  - `fieldName` = 項目名（domain.json に書いたまま）、`service` = 従属の `<child>Service` の遅延 import、`parentColumn` / `valueColumn` / `sortColumn` = 従属の主への参照列 / `file` 列 / `sortOrderField`、`maxItems` = `collection.maxItems`、`minItems` = required なら 1、`duplicate` = `collection.duplicate`
- 生成の drizzleBase.ts は `import { collections } from "./collections"` して `createCrudService` の options に `collections` を渡す
- drizzleBase.ts を手書きする主（`generateFiles.serverServices: false`）は、この 2 行を自分で足す（`dc:generate` が毎回案内する）
- 突き合わせ: `pnpm test:collection-wiring` が、全 domain.json の集まりの項目と、serviceRegistry から読み込んだ主のサービスの `collectionFields` を比べる（渡し忘れ・余分を主と項目で出す。DB 未設定でも走る）
- 生成器を使わないドメインは、手書きのサービスで `createCrudService` に `collections` を渡す（宣言の形は同じ `CrudCollectionConfig`）

### 既存の mediaUploaderMulti 列からの移行

既存の複数メディアの列（`mediaUploaderMulti` = 主の表の `text[]` 列）の値を、主の集まり（従属ドメインの 1 枚 1 行）へ移す手順。読み手は移行を行う fork の担当。SQL は形を示す例で、`<…>` を自分の名前に置き換えて使う。

#### 前提

- 基盤に移行の仕組み（移行ヘルパー・移行専用の書き込み口・台帳の付け替え関数）は無い。移行はそのドメインを持つリポが行う
- 一度きりのデータ移行では DB を直接クエリで操作してよい（領域ごとの規則より上位の原則）。サービスを通すと binding がファイルを消す経路に当たるので、値の移し替えは直接 SQL で行う（下の「やってはいけないこと」）
- 既存の multi 列は移行するまで今のまま動く。新しく足す項目は集まりにする（[src/features/README.md](../../features/README.md)「主の集まりの項目（mediaCollection）」）

使う名前（プレースホルダ）:

| 名前 | 意味 | 例（sample） |
|---|---|---|
| `<parent_table>` / `<ParentKey>` | 主の表 / 主の登録表キー（camelCase。台帳の record_type） | `samples` / `sample` |
| `<field>` | 元の multi 列（domain.json の項目名 = 列名） | `gallery_images` |
| `<child_table>` / `<ChildKey>` | 従属の表 / 従属の登録表キー | `sample_images` / `sampleImage` |
| `<parent>_id` | 従属の主への参照列（生成の雛形の名前） | `sample_id` |
| `<old_purpose>` | 元の列の用途 ID（`<ParentKey>.<field>`、ref の中に入っている） | `sample.gallery_images` |
| `<migration_log>` | 移行で作った従属の行の記録の表（手順 3 で作り、手順 5 の前に消す。戻し方はこの行だけに絞る） | `sample_images_migration_log` |

#### 中間の形（元の列を残して並べる）

- 主の domain.json に、元の multi の項目を残したまま集まりの項目を足し、`pnpm dc:generate <Parent> --yes` で従属を作る（従属の domain.json の書き出し・生成・配線まで。従属の表は `[user-run] pnpm db:push`）
- 前例: `src/features/sample/domain.json` の `gallery_images`（multi）と `images`（集まり、従属 `sampleImage`）
- 移行が終わるまで元の列と集まりは並んで在る。画面の切り替え（どちらを表示・入力するか）はドメインの事情で決める

#### 手順

0. 移行の前に数える（読み取りだけ。`pnpm db:query "<SQL>"` で流せる）

   ```sql
   -- 1 行の最大の要素数（62 を超えるなら下の「並びの鍵」の 63 件以上の方法を使う）
   SELECT max(cardinality(<field>)) FROM <parent_table>;
   -- 同じ値が 2 回入っている行（1 ファイルを 2 行に入れないよう、先に人が解消する）
   SELECT id FROM <parent_table>
   WHERE cardinality(<field>) <> (SELECT count(DISTINCT v) FROM unnest(<field>) AS v);
   -- 台帳で元の列を指している ready の件数（手順 6 で 0 になる）
   SELECT count(*) FROM storage_objects
   WHERE status = 'ready' AND record_type = '<ParentKey>' AND record_field = '<field>';
   -- 未紐付けの ready の件数（手順 6 で増えていないことを見る）
   SELECT count(*) FROM storage_objects WHERE status = 'ready' AND record_id IS NULL;
   ```

1. 旧用途を登録表の FORK ブロックへ写し、アップロードを閉じる
   - `src/registry/storagePurposeRegistry.ts` の AUTO ブロックにある `"<old_purpose>": { … }` を、`// --- FORK (手書き) ---` の下へそのまま写し、`upload: { allow: "none" }` にする（private なら `read: { allow: … }` も写す）
   - 理由: 移した後も従属の行の ref は `<old_purpose>` のまま（ref の purposeId は改名できない）。ファイルの読み取り・削除は台帳の行の purpose で登録表を引くので、元の項目を domain.json から外して AUTO から消えても FORK の登録が要る。新しいアップロードは従属の用途（`<ChildKey>.file`）で受けるので、旧用途は閉じる
2. 従属を作る（上の「中間の形」）。元の列は残す
3. 書き込みを止め、主 1 行ずつ同じ TX で従属の行を作り、台帳を付け替え、作った行を記録する
   - 止め方は運用で決める（メンテナンス表示など）。主と従属への保存・削除・replaceByQuery が走らない状態にする
   - 先に記録の表を作る。中間の形では画面が集まりを先に出すことがあり、移行の外で作られた従属の行（新しいアップロード）が在りうるので、戻すときに「移行で作った行」だけを選べるようにする

   ```sql
   -- parent_id の型は主の id の型に合わせる。登録表（schemaRegistry）に無い表なので、在る間に pnpm db:push を流すと
   -- この表の DROP を提案される（y/N で N にする。移行を終えて手順 5 の前に自分で消す）
   CREATE TABLE <migration_log> (child_id uuid PRIMARY KEY, parent_id uuid NOT NULL);
   ```

   - 主 1 行（`<parent_id>`）の例（62 件まで。並びの鍵は下の「並びの鍵」）:

   ```sql
   BEGIN;
   WITH src AS (
     SELECT e.value AS file, e.ord
     FROM <parent_table> AS p, unnest(p.<field>) WITH ORDINALITY AS e(value, ord)
     WHERE p.id = '<parent_id>'
   ), ins AS (
     INSERT INTO <child_table> (<parent>_id, file, sort_order)
     SELECT '<parent_id>', file,
            'a' || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', ord::int, 1)
     FROM src
     RETURNING id, file
   ), logged AS (
     -- 作った行を記録する（WITH の中の INSERT は本体が読まなくても必ず実行される）
     INSERT INTO <migration_log> (child_id, parent_id)
     SELECT id, '<parent_id>' FROM ins
   )
   -- 台帳を付け替える（台帳にある ref だけ。旧 URL は当たらない）。条件に元の主・元の列を入れ、別の行を指す台帳には触れない
   UPDATE storage_objects AS so
   SET record_type = '<ChildKey>', record_id = ins.id::text, record_field = 'file'
   FROM ins
   WHERE ins.file LIKE 'storage://%'
     AND so.id = substring(ins.file FROM '/([0-9a-f-]{36})\.[A-Za-z0-9]+$')::uuid
     AND so.status = 'ready'
     AND so.record_type = '<ParentKey>'
     AND so.record_id = '<parent_id>'
     AND so.record_field = '<field>'
   RETURNING so.id;
   -- 確かめ: UPDATE の件数 = その行の配列のうち storage:// の要素の数。合わなければ ROLLBACK してその行の台帳を調べる
   COMMIT;
   ```

   - UPDATE の件数が INSERT のうち台帳にある値（`storage://` の要素）の件数と合わなければ、その TX を巻き戻し（`ROLLBACK`）、その主の行の台帳（status・record_type・record_id・record_field）を調べてから流し直す。合わないまま進めない
4. 他の表が同じ値をコピーで持っていれば、従属の行への参照（FK、`ON DELETE SET NULL`）に張り替える
   - ref を別の表へコピーして持つことは禁止の形（台帳の 1 行は 1 つの業務行を指す）。移行のついでに、コピーの列を従属の行 id を指す FK に置き換える。どの表がコピーを持つかはドメインごとに調べる
5. 元の列を直接 SQL で空にするか、列ごと落とす（その前に記録の表を消す: `DROP TABLE <migration_log>;`。ここで戻せなくなるので、手順 6 を確かめてから）
   - 空にする: `UPDATE <parent_table> SET <field> = '{}';`（サービスの保存では空にしない）
   - 落とす: 主の domain.json から元の項目を外して `pnpm dc:generate <Parent> --yes`、`[user-run] pnpm db:push`（AUTO から旧用途の行が消えるが、手順 1 の FORK の登録が残る）
   - ここから先は戻せない。手順 6 の数え上げを、空にする・落とす前にも一度流す
6. 確かめる（読み取りの SQL の数え上げ）

   ```sql
   -- 移行で作った従属の行数 = 元の列の要素数の合計（空にする前に比べる。移行の外で作られた従属の行は数えない）
   SELECT (SELECT count(*) FROM <migration_log>) AS migrated_rows,
          (SELECT coalesce(sum(cardinality(<field>)), 0) FROM <parent_table>) AS source_items;
   -- 付け替えた台帳の件数（= 元の列の storage:// の要素数）
   SELECT count(*) FROM storage_objects
   WHERE status = 'ready' AND record_type = '<ChildKey>' AND record_field = 'file';
   -- 元の列を指したままの ready は 0
   SELECT count(*) FROM storage_objects
   WHERE status = 'ready' AND record_type = '<ParentKey>' AND record_field = '<field>';
   -- 未紐付けの ready は手順 0 から増えていない
   SELECT count(*) FROM storage_objects WHERE status = 'ready' AND record_id IS NULL;
   ```

   - 掃除（storage-sweep）に空実行は無い。`pnpm task storage-sweep` は本実行なので確かめには使わない。移行の後に掃除が走っても、台帳が従属の行を指していれば消さない（照合は record_type の登録表キーで従属の行の有無を見る）。台帳の紐付けが外れた ready（record_id が NULL）は、掃除が既定 24 時間後に実物ごと消す

#### 並びの鍵（sort_order）

- 従属の並び列は lib の fractional の鍵（`generateInitialSortKeys(n)`、`src/lib/crud/drizzle/fractionalSort`）。先頭から `"a0"`, `"a1"`, …, `"a9"`, `"aA"`, …, `"aZ"`, `"aa"`, …, `"az"`（62 件）で、読み出しは `COLLATE "C"` の昇順
- 62 件までは上の SQL の `'a' || substr('0-9A-Za-z の 62 文字', ord, 1)` で lib と同じ鍵になる。NULL で入れると並びが id 順（uuid = 不定）になるので入れない
- 63 件以上の主があるとき（手順 0 の最大の要素数で分かる）: 63 件目からは鍵の桁が変わる（`"b00"` …）ので SQL で組まない。Node のワンショットで `generateInitialSortKeys(<最大の要素数>)` を呼んで鍵の列を作り、その配列を添字で引く形で INSERT に渡す（例: 鍵の列を一時表に入れて `ord` で結合する）

#### やってはいけないこと

1. 台帳を付け替える前に、通常の保存（サービス経由）で元の列を空にする → storage binding が外れた ref の台帳を外し、実物をすぐに消す
2. 移行の間に主の replaceByQuery・物理削除をする → 新しい行に残らない ref の台帳を外し、旧 URL（自分の旧バケットのもの）は実物ごと消す
3. 従属のサービスの create で元の ref を書く → ref の purposeId（`<old_purpose>`）が従属の用途と違うので 400（旧 URL も 400）。従属の行は直接 INSERT で作る
4. 台帳の purpose を書き換える → ref の中の purposeId は改名できず、ファイルの読み取り・削除は台帳の purpose で登録表を引く。purpose は変えず、record_type / record_id / record_field だけを付け替える
5. 旧用途の登録を消す（FORK に写さずに元の項目を外す）→ 移した行のファイルが読めず、消せなくなる
6. 書き込みを止めずに流す → 移行の途中の保存が元の列や台帳を変え、件数が合わなくなる・台帳が外れる
7. 1 つのファイルを 2 行に入れる（同じ値を 2 回 INSERT する）→ 台帳の 1 行は 1 つの業務行だけを指す。先に手順 0 で重複を数えて解消する

#### 旧 URL（台帳に無い http の値）

- `http(s)://…` の値（凍結した旧 URL）は台帳に行が無いので、付け替えの対象外。従属の `file` にそのまま INSERT する（上の SQL は `storage://` の値だけ台帳を UPDATE する）
- 移した後、従属の行をサービスで物理削除すると、自分の旧バケットの旧 URL は実物ごと消える（主の物理削除のときと同じ扱い）

#### 移行の後の注意

- 従属の行の ref は旧用途（`<old_purpose>`）のまま。値を残す保存・外す保存・複製は通る（複製は従属の用途で新しい ref を作る）
- 従属の replaceByQuery の付け直し（rebind）は purpose の一致を条件にするので、旧用途の ref では 400。従属は主の集まり経由で保存する

#### 戻し方

- 手順 5（元の列を空にする・落とす）の前なら戻せる。戻すのは記録の表にある「移行で作った行」だけ（移行の外で作られた従属の行と、その台帳には触れない）。台帳を先に元へ戻し、その後に従属の行を直接 SQL で消す（逆の順だと、掃除が「業務行の無い台帳」として外して実物を消す）

  ```sql
  BEGIN;
  UPDATE storage_objects AS so
  SET record_type = '<ParentKey>', record_id = m.parent_id::text, record_field = '<field>'
  FROM <migration_log> AS m
  WHERE so.status = 'ready' AND so.record_type = '<ChildKey>' AND so.record_field = 'file'
    AND so.record_id = m.child_id::text;
  DELETE FROM <child_table> WHERE id IN (SELECT child_id FROM <migration_log>);
  DELETE FROM <migration_log>;
  COMMIT;
  ```

- 一部の主だけ戻すときは、記録の表を `parent_id` で絞って同じ形で流す

- 従属の行はサービスで消さない（binding が台帳を外して実物を消す）
- 手順 5 の後は戻せない。空にする・落とす前に手順 6 を確かめる

### 基盤に無いもの

- データ移行の補助・書き込みの経路（既存の行を集まりへ移す等）は持たない。一度きりの移行は DB を直接操作する（上の「既存の mediaUploaderMulti 列からの移行」）
- 論理削除の従属

### 後からの変更の規則

- 名前を変えるときは新しい名前を足し、古い名前を残す（消さない）
- 宣言の形（`CrudCollectionConfig`）は足すだけで広げる（新しい項目は省略できる形にする。`minItems` もこの規則で足した項目）

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

- ORDER BY 合成順: `searchRank` の句（searchQuery 指定時のみ）→ `extraOrderBy` → `orderBy`（未指定なら defaultOrderBy）→ `id`（`orderBy` に id が無い場合のみ）。合成は `composeSearchOrderBy`（`@/lib/crud/drizzle`）
- 未指定なら従来と完全に同じ並び順
- サーバー専用。SQL オブジェクトは HTTP で渡せないため `/api/[domain]/search` には出さない（ルートは受け付けるパラメータを個別に組み立てる許可リスト方式）
- `count` / `countWithDeleted` は並び順を持たないので受け付けない。`searchForSorting` は sort_order 専用のため対象外
- 式の中で Date を埋め込むときは下の落とし穴に従う

#### 落とし穴: `sql` テンプレートに Date を直接渡さない

`extraWhere` / `extraOrderBy` / `systemUpdate` の SQL 式など、`sql` テンプレートリテラル全般に共通（lint ガードなし、過去に複数回発生）。

- 症状: JS の `Date` を `${...}` に直接埋め込むと PostgreSQL 側でパースに失敗し 500 エラー
- 原因: `sql` 内のパラメータは `Date.toString()` 相当（`"Sun Mar 01 2026 23:59:59 GMT+0900 (...)"`）で渡り、`::timestamptz` キャストを付けても解析できない
- 対処: `.toISOString()` で文字列化してから渡す。Drizzle の組み込みオペレータ（`eq` / `gt` / `lt` / `gte` / `lte` / `between` 等）は Date を正しくシリアライズするので変換不要

```typescript
// NG
sql`CASE WHEN ${t.completedAt} >= ${range.dateFrom} THEN 'current' ELSE 'previous' END`
// OK
sql`CASE WHEN ${t.completedAt} >= ${range.dateFrom.toISOString()} THEN 'current' ELSE 'previous' END`
```

### テキスト検索（searchQuery）

- `searchFields` の各カラムに対して `ILIKE %query%` を OR で結合（結果集合・count はこれだけで決まる）
- 並び順: `searchRank` 指定時は後述の関連度ランキングを `extraOrderBy` / `orderBy` の前に置く。未指定なら `extraOrderBy`（あれば）→ `orderBy`
- SQL 片は `buildSearchWhere` / `buildSearchRankOrderBy`（`@/lib/crud/drizzle`）として公開。`base.query()` で独自 JOIN を組む wrapper からも同じ順位付けを再利用できる
- 並び順の最後は `withIdTiebreak(table, orderBy, clauses)`（`@/lib/crud/drizzle`）で閉じる。`orderBy` に id が無ければ `asc(id)` を末尾に足す（base `search()` と同じ規則）。wrapper で `buildOrderBy` の結果だけを使うと、同順位の行の並びが DB 任せになり、ページをまたいで入れ替わる・重複する。base と同じ合成順（rank → extraOrderBy → orderBy → id）でよければ `composeSearchOrderBy` を使う
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
//  未指定 / false = legacy 経路（従来どおり）

// サービス側（createCrudService オプション）— 「どう並べるか」の既定のみ。ON/OFF は呼び出し側が決める
defaultSearchRank?: { fields: [{ field: "name", weight: 3 }, "email"] }
// ビジネスドメインは domain.json の `searchRank` キーに同じ形で宣言 → dc:generate が drizzleBase に展開
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

### 並びの鍵の照合順序（COLLATE "C"）

鍵の生成（fractional-indexing）はバイト順（`0-9 < A-Z < a-z`）で前後を決める。DB や列の照合順序が C でないと（例: `en_US`・ICU）、`ORDER BY sort_order` が大文字小文字を混ぜて並べ、鍵の順と食い違う（鍵が 37 個を超えたり、`a0V` のような中間の鍵ができたりすると起きる）。そのため lib は text の並びの鍵を必ず `COLLATE "C"` で並べ・比べる。

- 式は `fractionalSort/sortKeyOrder.ts` の 1 か所: `sortKeyExpr` / `sortKeyAsc` / `sortKeyDesc` / `sortKeyGt`。text の列は `COLLATE "C"`、integer の列は何も足さない
- 使う所: create の採番・`reorder`（先頭・次の行の `>` の比較）・`initializeSortOrder`・`fractionalSort/server.ts`・集まりの並び、と `sortOrderColumn` を名指しする `orderBy` / `defaultOrderBy`（`search` / `searchWithDeleted` / `list` / `listWithDeleted` / `searchForSorting`。`buildOrderBy` の `sortKeyColumn`）
- 保存された鍵は書き換えない（並べ方と比べ方だけ）
- index: 並びの列の普通の index は `COLLATE "C"` の並べ方・比べ方に使われない（DB の既定が C.UTF-8 でも）。並びの列に自分で index を張るなら `CREATE INDEX ... (sort_order COLLATE "C")` で作るか、列を `text COLLATE "C"` で宣言する。生成器は並びの列に index を出さない
- 自前の SQL で並びの列を並べる・比べるときも `sortKeyExpr`（`@/lib/crud/drizzle/fractionalSort/sortKeyOrder`）を使う

---

## Firestore 版との差異

> **機能凍結**: Firestore アダプタは機能凍結済み。下表の制限は仕様として固定し、以後の機能拡張は行わない（理由: `docs/!must-read/バックエンド構成ドクトリン.md`）。

| 機能 | Drizzle | Firestore |
|------|---------|-----------|
| belongsToMany | 自動同期 + hydrate | 非対応 |
| relationWhere | 対応 | 非対応 |
| extraWhere | 対応 | 非対応 |
| extraOrderBy | 対応 | 非対応 |
| or 条件 | 対応 | 非対応（エラー） |
| 複数列 orderBy | 対応 | 単一列のみ |
| テキスト検索（searchQuery） | `searchFields` 全カラムに `ILIKE %q%` を OR | `searchFields` の **先頭 1 カラムのみ** 前方一致（`>= q` かつ `<= q + "\uf8ff"`） |
| searchRank | 対応 | 非対応（無視） |
| ページネーション | LIMIT/OFFSET + COUNT(*) | page*limit 件取得 → slice。`search` の `total` は取得件数（最大 page*limit）で実総数ではない（実総数は `count()`） |
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

## よくある失敗

- 中間テーブルを手で操作し、`belongsToMany` の管理と二重になる → `belongsToManyRelations` に任せる
- ページングを自前で実装し、`total` の仕様が汎用 search とずれる → `search()` / `base.query()` を使う
- 生成ファイルを直接編集し、次の `dc:generate` で上書きされる → `wrappers/` で拡張する
- Firestore で `or` を使って例外になる → 上の「Firestore 版との差異」を先に確認する

## ライブラリ拡張時の注意事項

1. **後方互換性の維持** — SearchParams 等の共通型への追加はオプショナルプロパティに限定する
2. **Firestore 側の考慮** — Drizzle 固有機能を追加した場合、Firestore 側では無視するかエラーにするか決める
3. **生成コードへの影響** — `hooks/` 配下は `dc:generate` で各ドメインに展開されるため、シグネチャ変更は全ドメインに波及する
4. **query/ 配下の純粋関数化** — クエリビルダーは DB アクセスを持たない純粋関数として実装する
