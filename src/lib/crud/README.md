# crud

## Overview

- `createCrudService` を中心とした汎用 CRUD ライブラリ。Drizzle (Neon/PostgreSQL) 実装と、機能凍結した Firestore 実装を持つ
- 閉じた lib。入口は 2 つ: `@/lib/crud` = 画面側(汎用 hooks・CRUD ボタンと一括操作の作成関数 `bulk*Action`・HTTP の client `createApiClient` / `domainClient`・一覧の列 presenters・共通型・`toOrderBySpec`。client でも server でも読める。server からは型だけ) / `@/lib/crud/server` = 保存側(Drizzle の `createCrudService` と `CrudServiceOptions`・Firestore の `createFirestoreCrudService`・集まり・ストレージ連動・秘匿カラム・SQL の部品・並びの鍵・`omitUndefined`)。中のファイルを外から読まない
- 差し込み口(画面側): `setApiErrorHandler`(HTTP の失敗の扱い)・`registerCrudEventHandler`(CRUD の出来事の通知)
- ドメインの定義と欄の物(主キーの論理名 `CRUD_ID_FIELD`・日時の schema `nullableDatetime` / `requiredDatetime`・値の表示 `format*` / `FieldPresenter`・管理画面のパス `getAdminPaths` / `AdminPaths`)は `@/lib/domain`、戻り先の検証は `@/lib/url` の `sanitizeRedirectPath`
- 拡張は次の順で、手前で足りるならそこで止める: ① 提供メソッド → ② `relationWhere` → ③ `extraWhere` / `extraOrderBy` → ④ `base.query()` + `wrappers/` → ⑤ 独自サービス（core/services.md extension）
- 使う時・直す時の決まりは札 .claude/rules/items/lib/crud.md にある
- 部分ごとの説明は下のフォルダの README（Related）

## Usage

### よくある失敗

- 中間テーブルを手で操作し、`belongsToMany` の管理と二重になる → `belongsToManyRelations` に任せる
- ページングを自前で実装し、`total` の仕様が汎用 search とずれる → `search()` / `base.query()` を使う
- 生成ファイルを直接編集し、次の `pnpm generate domain` で上書きされる → `wrappers/` で拡張する
- Firestore で `or` を使って例外になる → `firestore/README.md` の「Drizzle 版との差異」を先に確認する

## API

### createCrudService のオプション

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
  defaultSearchRank?: SearchRankSpec,          // 関連度ランキングの重み既定（`drizzle/query/README.md` の searchRank）
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

  // 共有の読みのキャッシュタグを書き込みで積む（既定: 積まない、Drizzle のみ、後述）
  cacheTags?: { domain: string },

  // ファイル台帳との連動（Drizzle のみ、`storageIntegration/README.md`）
  storage?: CrudStorageBinding,

  // ドメイン集約（Drizzle のみ、`collections/README.md`）
  collections?: CrudCollectionConfig[],
})
```

### 型パラメーター（TCreate / DefaultInsert）と upsert の要求型

- `TCreate` = サービスが受け取る作成データ型。省略時は `DefaultInsert<TTable>`
  （= `InferInsertModel<TTable>` から `id` / `createdAt` / `updatedAt` を除いた型、`drizzle/service/index.ts`）。
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

- 全書き込みメソッド（update / delete / bulkUpdate 等）は完了時にメモを自動破棄する
  → 同一リクエスト内の read-your-writes は維持される（呼び忘れが構造的に起きない）
- `createCrudService` を経由しない生SQL書き込み（`db.update(Table)` 等）だけはメモが残るので、直後に `service.invalidateRequestMemo()` を呼ぶ（core/services.md raw_sql）
- リクエストスコープ外（cron / CLI）では自動的に素通しになる
- 対象基準: identity-stable かつ高 fan-in な行（例: user のセッションユーザー行、
  setting のグローバル設定）のみ。list / search はメモ化されない
- 詳細・注意点: `src/lib/requestMemo/README.md`

### cacheTags（共有の読みのキャッシュタグを書き込みで積む）

`cacheTags: { domain }` にすると、書き込みのメソッド（requestMemo と同じ一覧）が終わり（成功でも throw でも）に、そのドメインのキャッシュタグを積む（`src/lib/cacheTags`）。積んだキャッシュタグは入口（routeFactory・cron）が要求の終わりにまとめて消す。

- domain = 地区の地図のドメイン名。cache の宣言（主の登録の entity.json の `"cache"` / `cache.json`）を持つドメインに付ける
- id の分かる書き込み（create・upsert・duplicate は戻り値、update・systemUpdate・delete・restore・hardDelete は引数、`bulk*ByIds`・bulkUpdate・bulkUpsert は一括の id）= ドメインのキャッシュタグ `<domain>` + 行のキャッシュタグ `<domain>:<id>`
- id の分からない書き込み（`*ByQuery`・replaceByQuery・reorder・initializeSortOrder・searchForSorting・関係の一括・truncateAll）と、戻り値から id を取る書き込みの throw = ドメインのキャッシュタグ + 行の全部のキャッシュタグ `<domain>:*`（get の覚えが全部消える）
- `createCrudService` を経由しない生 SQL の書き込みの後は `service.markCacheTags(ids?)`（ids 無し = 行の全部のキャッシュタグ）。option の無いサービスでは何もしない
- 積むのはメソッドの return の時点、消すのは要求の終わり（ロールバックした分は余分に消すだけ）。範囲の外（pnpm task・seed）では消せず、記録の 1 行（`src/lib/cacheTags/README.md`）

### systemColumns と特権書き込み（systemUpdate / systemBulkUpdateByQuery）

Create/Update Zod スキーマから意図的に除外したシステム管理カラム（`ended_at`,
`sort_order`, `sold_out_at` 等）は、通常の `update()` に渡しても parseUpdate で
strip される。`systemColumns` は、これらの列を audit 自動記録・requestMemo 自動 invalidate などの横断フックを通る正規経路で書くための宣言（Drizzle のみ）。

```typescript
// 宣言（<登録名>Base / 登録の entity.json）
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

挙動:

- **fail-closed**: `systemColumns` 未宣言のサービスでは system 系メソッドは常に throw。
  宣言外のキーを渡した呼び出しも throw する（Zod との二重管理はせず宣言＝自己文書化。
  通常カラムを同一アトミック書き込みに含めたい場合はそのカラムも明示宣言する）
- 宣言はプロパティ名・DB カラム名のどちらでも可。存在しないカラム名はサービス生成時に
  throw（typo の fail-fast）
- 値には drizzle の `sql\`\`` 式を渡せる（アトミックインクリメント・CASE・COALESCE 採番等）。
  通常の `update()` は SQL 式を受け付けない
- updatedAt 付与・audit 記録・requestMemo 自動 invalidate・制約エラー変換は
  `update()` / `bulkUpdateByIds()` と同一挙動。追加クエリなし（ホットパス安全）
- belongsToMany リレーション同期は対象外
- サービス層限定の特権。汎用 HTTP ルート（`/api/[domain]/**`）には配線していない（core/services.md system_write）。HTTP 入力の安全網は従来どおり Zod strip
- business ドメインは登録の entity.json の `systemColumns` に宣言して `pnpm generate domain` で反映、
  core ドメインは `<登録名>Base` の `createCrudService` オプションに直接宣言する

### hiddenColumns（秘匿カラム — サービス境界の外に出さない）

パスワードハッシュ等「DB には保持するがサービスの戻り値に決して含めてはならない」
カラムをテーブル定義レベルで宣言する仕組み（Drizzle のみ）。宣言はサービスオプション
ではなく **entities/drizzle.ts のテーブル定義直後** に置く。テーブルオブジェクトを
参照するあらゆるコードから import 順序に依存せず参照できるようにするため。

```typescript
// entities/drizzle.ts（テーブル定義の直後）
import { defineHiddenColumns } from "@/lib/crud/server";

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

挙動:

- プロパティ名（camelCase）で宣言。存在しないカラム名は定義時に即 throw（fail-fast）
- 値は「キー削除」ではなく「null 置換」。エンティティ型を nullable にしておけば
  型と実態が一致する
- サーバー内部で秘匿値を読む正規経路は、`createCrudService` を経由しない専用
  ファインダー（`services/server/finders/` に直接 drizzle 読み取り）のみ。
  例: `user/services/server/finders/findByIdWithSecrets.ts`。
  ファインダーの戻り値は HTTP レスポンスに乗せない（core/services.md hiddenColumns）
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
  import { getPublicColumns } from "@/lib/crud/server";

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
- テスト: `pnpm test eslint-rules/hidden-columns.test.mjs`

### 一覧の列(presenters の buildDomainColumns)

- `buildDomainColumns({ config, formatDate, truncate, presenters?, actionColumn?, sortableFields?, truncateLength? })`: `config` = domain の `domainDisplay`(または登録の entity.json の設定)。`tableFields` の順に列を作り、`presenters` の無い列は `presenterFor`(`src/lib/domain/fields/presenterFor.mjs`)と同じ答えで描く
- `formatDate`・`truncate` は必須: 日付の書き方と切り詰めはアプリのもので、lib は持たない。呼び手が `@/utils/date` の `formatDateJa` と `@/utils/string` の `truncateJapanese` を渡す(`buildDomainColumns<Sample>({ config: domainDisplay, formatDate: formatDateJa, truncate: truncateJapanese })`)。lib は日時・createdAt / updatedAt に `"YYYY/MM/DD HH:mm"`、日付に `"YYYY/MM/DD"` を、`fallback: null` と一緒に渡す
- 読む項目のキーは `name`・`label`・`formInput`・`fieldType`・`options` だけ。型は lib/domain の `DomainField` から取る(crud に項目の型は持たない)。`name` 以外は省ける
- 関連は `fieldName`・`label`(`DomainDisplayRelation` から、label は省ける)、`tableFields` は `DomainDisplay` の型
- `toOrderBySpec(sort)`: 表の並びの状態(`@/lib/tableSuite` の `SortState`)を `search` の `orderBy`(`OrderBySpec`)に直す(`{ field: "name", direction: "asc" }` → `[["name", "ASC"]]`)。表は並びを見せるだけで、並べるのは一覧を取る側なので crud が持つ。純粋な関数で、page.tsx・loader と client の一覧の両方から呼べる

### 提供メソッド一覧

#### 基本 CRUD

| メソッド | 引数 | 戻り値 | 備考 |
|----------|------|--------|------|
| `create(data, tx?)` | Insert | Select | M2M 自動同期、sortOrder 自動割当 |
| `get(id, options?)` | string | Select \| undefined | withRelations / withCount 対応 |
| `list(options?)` | WithOptions | Select[] | 全件取得（上限 100）。フィルタ不要な場合のみ |
| `update(id, data, tx?)` | string, Partial | Select | M2M 差分同期 |
| `systemUpdate(id, data, tx?)` | string, Record | Select | 特権更新（systemColumns 必須・SQL 式可・サーバー専用） |
| `delete(id, tx?)` | string | void | useSoftDelete 時は論理削除 |

#### 検索・クエリ・カウント

| メソッド | 引数 | 戻り値 | 備考 |
|----------|------|--------|------|
| `search(params)` | BoundedSearchParams & WithOptions & ExtraWhereClause & ExtraOrderByClause | PaginatedResult | メインの検索メソッド。`limit` 必須(下) |
| `searchWithDeleted(params)` | 同上 | PaginatedResult | 論理削除レコードも含む |
| `count(params?)` | CountParams & ExtraWhereClause | CountResult | 件数のみ取得（レコード不要時に最適） |
| `countWithDeleted(params?)` | 同上 | CountResult | 論理削除レコードも含めた件数 |
| `query(baseQuery, options?, countQuery?)` | カスタム SELECT | PaginatedResult | サーバー専用。JOIN 等の自由なクエリ |
| `searchForSorting(params)` | BoundedSearchParams & ExtraWhereClause | PaginatedResult | sort_order NULL を自動初期化 |

- search の `limit` は必須(`BoundedSearchParams = SearchParams & { limit: number }`)。省いた呼び出しは型で止まり、型を通らない呼び出し(any・登録表から引いたサービス)は実行時に 500。今までの既定 100 で黙って行が落ちることは無い
- 外(HTTP の要求)から来る limit は `resolveSearchLimit(limit, { fallback?, max? })`(`@/lib/crud`、既定 100・上限 1000、上限を超えれば 400。切り詰めない)で解いてから渡す。汎用の search の route はそうしている
- 1 件を見る読みは `limit: 1`、件数だけは `count`、行の全部が要る読みは明示の上限(例: 1 人 1 通貨 1 行の財布 = 通貨の数)と上限を超えた時の扱いを書く
- client の `search`(HTTP)の `SearchParams` の limit は任意のまま(server が既定で解く)

#### バルク操作

| メソッド | 引数 | 戻り値 | 備考 |
|----------|------|--------|------|
| `upsert(data, options?, tx?)` | Insert | Select | M2M 同期あり |
| `bulkUpsert(records, options?, tx?)` | Insert[] | BulkUpsertResult | M2M 非対応（警告ログ） |
| `bulkUpdate(records, tx?)` | BulkUpdateRecord[] | BulkUpdateResult | CASE WHEN + M2M グループ同期 |
| `bulkUpdateByIds(ids, data, tx?)` | string[], Partial | { count } | 全 ID に同じ値を適用 |
| `bulkAddRelation(fieldName, ids, targetIds, tx?)` | string, string[], string[] | BulkRelationResult | M2M に足す（既存は残す、再追加は何もしない。上限 1000 × 50。存在しない id は飛ばして返す。Drizzle のみ） |
| `bulkRemoveRelation(fieldName, ids, targetIds, tx?)` | string, string[], string[] | BulkRelationResult | M2M から指定の関連先だけ外す（他は残す。Drizzle のみ） |
| `bulkUpdateByQuery(where, data, tx?)` | WhereExpr, Partial | { count } | 条件一致に同じ値を適用（parseUpdate 経路・M2M 非対応） |
| `systemBulkUpdateByQuery(where, data, tx?)` | WhereExpr, Record | { count } | 特権一括更新（systemColumns 必須・SQL 式可・サーバー専用） |
| `bulkDeleteByIds(ids, tx?)` | string[] | void | ソフト/ハード自動判定 |
| `bulkHardDeleteByIds(ids, tx?)` | string[] | void | 物理削除 |
| `bulkDeleteByQuery(where, tx?)` | WhereExpr | void | 条件一致を削除 |
| `replaceByQuery(where, records, options?, tx?)` | WhereExpr, Insert[], ReplaceByQueryOptions | Select[] | 条件一致行の全削除 + records 挿入を単一 tx で（詳細は下記） |
| `duplicate(id, options?, tx?)` | string, DuplicateOptions | Select | `options.name` 指定時はそれを採用、未指定時は name に「_コピー」付与 |

#### replaceByQuery（条件一致行のアトミック全置換）

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
  制約エラー変換を行う。storage オプション付きのサービスでは台帳も連動する（`storageIntegration/README.md` Internals の replaceByQuery）。
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

#### ソフトデリート専用

| メソッド | 条件 | 備考 |
|----------|------|------|
| `restore(id, tx?)` | useSoftDelete | deletedAt を NULL に戻す |
| `hardDelete(id, tx?)` | useSoftDelete | 物理削除 |
| `listWithDeleted(options?)` | useSoftDelete | 削除済み含む全件 |
| `getWithDeleted(id, options?)` | useSoftDelete | 削除済み含む取得 |

#### 並び替え専用

| メソッド | 条件 | 備考 |
|----------|------|------|
| `reorder(id, afterItemId, tx?)` | sortOrderColumn | Fractional Indexing で再配置 |
| `initializeSortOrder(ids, tx?)` | sortOrderColumn | 一括初期化 |

#### ユーティリティ

| メソッド | 備考 |
|----------|------|
| `truncateAll()` | TRUNCATE CASCADE（中間テーブル含む） |
| `getTruncateAffectedTables()` | 影響テーブル名のみ取得 |
| `getTableName()` | テーブル名を返す |
| `duplicateWithIdMap(id, options?, tx?)` | duplicate と同じ複製をし、集まりの旧→新の従属 id の対応表も返す（集まりが無ければ `idMaps` は `{}`。`collections/README.md`「複製（2 段）」） |

## Extension

### 差し込み口（画面側、`@/lib/crud`）

- `setApiErrorHandler((error: HttpError) => void)`: `createApiClient` の HTTP の失敗を受ける関数を 1 つ差し替える(既定は 500 以上を console.error)。呼んだ後も error は呼び手へ投げ直す
- `registerCrudEventHandler((event: CrudEvent) => void)`: client の操作ごとの出来事 `{ action, payload?, success, error? }` を受ける関数を 1 つ置く(`action` = `CrudAction`: `get` / `create` / `delete` / `search` …)
- どちらも 1 つだけ持つ(後から置いた物が勝つ)。アプリ全体のログ送信・監視に使い、UI には書かない(docs/!must-read/エラーハンドリング方針.md)

## Internals

### サービスの組み立て（drizzle/service/・firestore/）

- `createCrudService` は共有の状態(context: 関係の設定・論理削除の列・特権書き込みの検査・リレーション展開・監査)を 1 つ作り、操作の群(read / write / bulk / upsert / table / sort)を 1 つのサービスにまとめてから、集まり → ストレージ連動 → 集まりの複製 → リクエストメモ → キャッシュタグ → 秘匿カラムの順に包む
- 自分の他のメソッドを `this` で呼ぶ物(duplicate・duplicateWithIdMap・searchForSorting)は組み立ての中に置く。`this` は呼ばれたサービス(包みの後)なので、複製の create もストレージ連動と集まりを通る
- `createFirestoreCrudService` も同じ形(context + read / write / bulk、duplicate は組み立て)

### 汎用フック（hooks/）の mutation 契約

- 生成フックごとの使い方は `hooks/README.md`

`useCreateDomain` / `useUpdateDomain` / `useDeleteDomain` / `useUpsertDomain` / `useBulk*Domain` / `useDuplicateDomain` / `useRestoreDomain` / `useHardDeleteDomain` / `useReorderDomain` / `useReplaceByQueryDomain` は全て `hooks/internal/useDomainMutation.ts` の薄いラッパー。戻り値は `{ trigger, isMutating, isLoading, error }`（bulkUpdate 系は `data` も）。

**同一インスタンスでの並列 trigger は安全**（`Promise.all(rows.map((r) => update.trigger(...)))` のような一括保存を想定）:

- 失敗した trigger は必ずその error で reject する（並列数に依存しない）
- 成功した trigger は必ず結果 T で resolve する（undefined は返さない）
- `isMutating` は 1 件でも in-flight がある間 true、全件 settle で false
- `error` / `data` は「直近に settle した trigger の結果」（逐次利用なら useSWRMutation と同じ）
- 成功した trigger ごとに `revalidateRelatedCaches(revalidateKey)` を await してから resolve する。再検証自体の失敗は書き込み成功を reject に変えない（握って `console.error`）
- `mutate(key, promise, { populateCache: false, throwOnError: true })` 経由なので、完了後の `key` 自身の再検証と SWR の mutation ウィンドウ（競合する revalidate の破棄）は従来どおり

**useSWRMutation を使わない理由**: swr/mutation は「最後に開始した trigger」以外の結果を捨てる（`ditchMutationsUntilRef`）。並列時に先行分が成功でも失敗でも state 更新・onSuccess・throw を行わず undefined で resolve するため、一括保存の途中失敗が「全件成功」に見える無言のデータ欠損を起こす。

**テスト**: `pnpm test src/lib/crud/hooks/internal/*.test.mjs`（node:test + Node 組み込みの TypeScript type stripping、追加依存なし）。React 非依存の中核 `concurrentMutation.ts` を検証する。

**独自 mutation フックの作り方**: `useDomainMutation(key, fn, revalidateKey?)` を `@/lib/crud` から import して包む（core の useChangeUserRole / useAdjustWallet / useProfileUpsert / useAdminSetup 等が実例）。`useSWRMutation` を直接使わない理由は上のとおり（決まりは .claude/rules/core/client.md hooks）。

### トランザクション

- すべての書き込みメソッドは `tx?: DbTransaction` を受け付ける
- 外部トランザクション: `db.transaction(async (tx) => { await service.create(data, tx); })`
- 内部トランザクション: belongsToMany 同期時、tx が未指定なら内部で自動生成
- `query()` はトランザクション非対応（読み取り専用）

### エラーハンドリング

PostgreSQL 制約違反を `DomainError` に変換:

| コード | 制約 | ステータス | メッセージ |
|--------|------|-----------|-----------|
| 23503 | 外部キー | 409 | 関連レコードが存在（delete 時）/ 参照先が不在（write 時） |
| 23502 | NOT NULL | 409 | 必須フィールドが未入力 |
| 23505 | UNIQUE | 409 | 値が重複 |

## Related

- `hooks/README.md`: 生成フックの使い方
- `components/Buttons/README.md`: CRUD ボタン
- `storageIntegration/README.md`: storage オプション（ファイル台帳との連動）
- `collections/README.md`: ドメイン集約（collections オプション）、移行の手順は `collections/Usage.md`
- `drizzle/query/README.md`: search() / count() の詳細仕様
- `drizzle/relations/README.md`: belongsToMany と withRelations / withCount
- `drizzle/fractionalSort/README.md`: 並び替え（Fractional Indexing）
- `firestore/README.md`: Firestore 版との差異
