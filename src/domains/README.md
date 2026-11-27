# domains/

## Overview

- ドメイン別の機能を格納するディレクトリ。各ドメインは宣言を持つ(D335):
  - `domain.json` = ドメインそのものの短い宣言(`domainConfigVersion` `"2.0"`・`label` = 管理の一覧・データ操作の一覧の名前)だけ
  - `entities/<登録名>/entity.json` = 表 1 つ = 登録 1 件ごとの宣言(表・項目・関連・権限・生成の旗 `generate` など、下の API のキー)。登録の一覧は entities/ の下のフォルダの並び(entity.json か drizzle/schema/form/model.ts を持つフォルダ)で、どこにも手で書かない
  - 表なしのドメインは登録 0、表 1 つのドメインは登録名 = ドメイン名。どの表にも属さない物(API の入力の形・複数の表をまとめた型・定数)は `types/`・`constants/`(D341)
  - 読み手は全員、読み込みの部品 `readDomain`(scripts、[src/lib/domain/README.md](../lib/domain/README.md) 宣言の形)か、登録の entity.json の import(server)だけを通す
- ドメイン = `src/domains/` と `src/domains/core/` の直下の `_` で始まらないフォルダで、地区(district)の 1 種(ほかは lib・枠・proxies)。名前はフォルダ名、core と業務で同名は失敗。一覧(宣言の有無・生成する登録があるかを含む)は地区の地図 `src/registry/district-map.jsonl`(`pnpm generate district-map`、地区の定義と欄: [src/lib/districtMap/README.md](../lib/districtMap/README.md))。
- entity.json の書き方(スキーマ)は 下の API、メディア・インデックス・汎用 API の権限のキーは 下の Extension。手で持つ表の形の鍵(table・primaryKey・foreignKeys・checks・enums・columns・fields[].column)と登録の鍵(registered・reason・requires・service・adminList)は [src/lib/domain/README.md](../lib/domain/README.md) 宣言の形

## Usage

### 関連コマンド

宣言(domain.json と entities/<登録名>/entity.json)を手で書いて `pnpm forge`（検査 → 生成 → 事後検査）。個別には `pnpm generate domain -- <Domain> [--only <categories>]` / `pnpm generate domain` / `pnpm generate domain -- --delete <Domain> --confirm <snake_name>`（既定は対話なし、`-i` で対話）。generate の旗・生成物と上書きの扱い・典型的な流れは [`scripts/structure/domain/README.md`](../../scripts/structure/domain/README.md)。

### サンプル

最小構成(`src/domains/category/domain.json` と `src/domains/category/entities/category/entity.json`):

```json
{ "domainConfigVersion": "2.0", "label": "カテゴリ" }
```

```json
{
  "singular": "category",
  "plural": "categories",
  "label": "カテゴリ",
  "dbEngine": "Neon",
  "idType": "uuid",
  "relations": [],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "fields": [
    {
      "name": "name",
      "label": "名前",
      "fieldType": "string",
      "formInput": "textInput",
      "required": true
    }
  ],
  "apiAccess": {
    "read": { "roleCategories": ["admin"] },
    "write": { "roleCategories": ["admin"] }
  }
}
```

全機能の実装例は `src/domains/sample/entities/sample/entity.json`(ドメインの宣言は `src/domains/sample/domain.json`)を参照。

### ドメインの運用コマンド・移行・シード

ドメインはデータと画面だけでなく、そのドメインを動かす道具も持つ。scripts/ には置かない(scripts/ は全ドメイン共通の道具だけ。`scripts/README.md`)。ランナーがドメインを走査して見つけるので、一覧に足す必要は無い。

| 置き場 | 何か | 呼び方 |
|---|---|---|
| `<domain>/scripts/tasks/<名前>.ts` | 運用コマンド(繰り返しの運用・機能を有効にするたびの導入) | `pnpm task <domain>:<名前>` |
| `<domain>/scripts/migrations/<名前>.ts` | notice が名指す 1 回きりの移行(notice と同じ commit で出し、済んだら消してよい) | `pnpm task <domain>:<名前>`(notice の `uses:`) |
| `<domain>/scripts/migrations/<名前>.local.ts` | git に入れない緊急のデータ修正(下流に流さない。同じ中身の dry-run の後に本実行) | `pnpm task <domain>:<名前>` |
| `<domain>/seed.ts` | シード(`defineSeed`、データだけ。そのドメインのサービスで入れる) | `pnpm ops db seed [--all]` |

- 書き方: タスク・移行 = `src/lib/task/README.md`、シード = `src/lib/seed/README.md`。名前は `<domain>:<ファイル名>`(kebab-case)
- 中身はそのドメインのサービスを呼ぶだけ(DB を直接書く部品は読まない、lint `tools-no-db-write`。直接の SQL が要る物は移行)。実行は毎回 `task_runs` に記録され、二度流すと困る物は止める鍵を宣言する
- core の運用コマンドの例: `pnpm task wallet:reverse-history`(取引の取り消し)・`pnpm task wallet:bulk-grant`(一括付与と補填)・`pnpm task user:bulk-change-status`(ステータスの一括変更)。詳細は各ドメインの README
- どのドメインにも同じ形で使う操作(書き出し・取り込み・一括更新・一括削除)はドメインに置かず `pnpm ops data <command> <domain>`(`scripts/operations/data/README.md`)。許可は entity.json の `apiAccess`(と `commands`。下の Extension)
- fork が core のドメインにタスク・シードを足す受け口は無い。fork の物は fork 自身のドメインに置く
- 新しいドメインには `pnpm generate domain` が `seed.ts` の雛形を一度だけ書く(write-once)

### エンティティとフォームスキーマ

- `entities/schema.ts`: サーバー処理の正規形（`XxxBaseSchema` / `XxxCreateSchema` / `XxxUpdateSchema`）。フォーム固有の都合を持ち込まない
- `entities/form.ts`: `schema.ts` を `z.infer` した型だけを公開する。追加のスキーマは書かない。フォーム側で足したい項目は、空の型との交差で広げる（`XxxCreateFields = z.infer<typeof XxxCreateSchema> & XxxCreateAdditional`）
- フォーム固有の入力（確認用パスワード、一時的に分けた入力欄など）は、そのフォームの隣の `formEntities.ts` に置く。使う範囲が限られるので短い名前でよい: `FormSchema`（resolver に渡す Zod スキーマ。`schema.ts` を拡張して作るのが基本）/ `FormValues`（`useForm` の型）/ `DefaultValues`
- 同じ構造のフォームが複数要るときは、スキーマではなくフォームコンポーネントを再利用する

生成する登録(`generate` が false でない)の `entities/<登録名>/` は `pnpm generate domain` が、集める入口 `entities/<種類>.ts` はどのドメインも `pnpm generate registry` が生成するので手で編集しない。上の規約は主に core ドメインと `formEntities.ts` を書くときに使う。

## API

### トップレベルプロパティ（entities/<登録名>/entity.json）

ドメインの `domain.json` は `domainConfigVersion`(`"2.0"`)・`label`・`$comment` だけを持つ。下は登録の entity.json の鍵。

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| singular | string | 🟢 Yes | ドメイン名単数形（snake_case、例: `sample_category`）。ドメインフォルダ名はこの camelCase（例: `sampleCategory/`）でなければならず、ずれていると pnpm generate domain が止まる |
| plural | string | 🟢 Yes | ドメイン名複数形（snake_case、例: `sample_categories`）。テーブル名とルートになる。無いと pnpm generate domain が止まる |
| label | string | 🟢 Yes | 管理画面での表示名（日本語可） |
| dbEngine | `"Neon"` \| `"Firestore"` | 🟢 Yes | 使用するDB。原則 `"Neon"`。`"Firestore"` はリアルタイム配信が本質要件のドメインのみ（`docs/!must-read/バックエンド構成ドクトリン.md`） |
| idType | `"uuid"` \| `"string"` \| `"number"` | 🟢 Yes | 主キーの型 |
| relations | Relation[] | 🟢 Yes | リレーション定義（空配列可） |
| useCreatedAt | boolean | 🟢 Yes | createdAt カラムの有無 |
| useUpdatedAt | boolean | 🟢 Yes | updatedAt カラムの有無 |
| useSoftDelete | boolean | ⚪ No | 論理削除の有無（deletedAt カラム） |
| sortOrderField | string | ⚪ No | 並び順の列（fractional の鍵を入れる text の列）のフィールド名。fields に同名の項目（`fieldType: "string"`、`formInput: "hidden"`）を置く。管理画面の並べ替え（sort/）と reorder / searchForSorting のフックを生成する |
| fields | Field[] | 🟢 Yes | フィールド定義 |
| fieldGroups | FieldGroup[] | ⚪ No | 管理画面フォームのセクション分け（後述） |
| searchFields | string[] | ⚪ No | 検索対象フィールド名の配列 |
| searchRank | `{ fields: (string \| { field: string; weight?: number })[] }` | ⚪ No | 関連度ランキング（`searchRank: true` 時のフィールド重み、Neon のみ）。未宣言なら `searchFields` 等重みで「完全 > 前置 > 語頭 > 部分」一致順になる。例: `{ "fields": [{ "field": "name", "weight": 3 }, "email"] }`。詳細: `src/lib/crud/README.md` の searchRank 節 |
| defaultOrderBy | [string, "ASC" \| "DESC"][] | ⚪ No | デフォルトソート順 |
| tableFields | string[] | ⚪ No | 管理画面テーブルに表示するフィールド |
| useDetailModal | boolean | ⚪ No | 詳細モーダルの有無 |
| addToAdminDataMenu | boolean | ⚪ No | 管理メニュー「データ管理」(出どころ `dataMenu`)に出す。管理一覧の画面があるドメインだけ(`src/registry/adminDomains.ts`) |
| useDuplicateButton | boolean | ⚪ No | 複製ボタンの有無 |
| useImportExport | boolean | ⚪ No | データ入出力機能の有無（CSV/ZIP形式）。`true` のときだけ管理者に export / import を開く。省略・`false` = 閉じる（サーバー側のインポート処理も拒否する） |
| useAutoSave | boolean | ⚪ No | 編集フォームでオートセーブを使用するか |
| indexes | Index[] | ⚪ No | 検索/集計用インデックスとユニーク制約（`unique: true`。複数の列のユニークもこれ。Neon のみ） |
| systemColumns | string[] | ⚪ No | `systemUpdate` / `systemBulkUpdateByQuery`（特権書き込み）で書き込みを許可するカラムの allowlist（Neon のみ）。Zod スキーマ外のシステム管理カラム（`ended_at` 等）をサービス層から正規経路で書き込むための宣言。**未宣言時は system 系メソッドは常に throw（fail-closed）**。詳細: `src/lib/crud/README.md` |
| hiddenColumns | string[] | ⚪ No | 秘匿カラム（APIキー・トークン等「DB には保持するがレスポンスに決して含めない」カラム、Neon のみ）。プロパティ名（camelCase）で指定すると `pnpm generate domain` が `entities/drizzle.ts` に `defineHiddenColumns()` を出力し、サービスの**全戻り値**・他ドメインの **withRelations 展開**から該当カラムが null 置換される。秘匿値をサーバー内部で読む場合は `services/server/` に直接 drizzle の専用ファインダーを作ること（例: user の `findByIdWithSecrets`）。詳細: `src/lib/crud/README.md` の hiddenColumns 節 |
| audit | object | ⚪ No | 監査ログ（`createCrudService` の `audit` のうち JSON で書ける部分。`targetType`・`actionPrefix` は `enabled: false` 以外で必須、`trackedFields` は camelCase の列名、recorder は生成器が渡す、Neon のみ）。`generate: false` のドメインでは効かないので `<登録名>Base.ts` に手で書く |
| cache | object | ⚪ No | この登録の共有の読みのキャッシュの宣言（下の「cache（共有の読みのキャッシュの宣言）」）。主でない登録も自分の entity.json に書く(ドメインの既定は無い)。`generate: false` の登録にも効く（検査は `pnpm check domain`）、Neon のみ |
| closable | — | — | 無い。書くと生成器が止める。機能として閉じるには `src/featureGate/rules/<名前>.ts` に規則を書き `domains` にこのドメインを入れる。どの規則にも載せず常に開くなら、ドメインの `extensionPoints.ts` に常設の宣言 `export const alwaysOpen = true`(どちらも無いと `pnpm generate district-map` が止める、注文 35) |
| apiAccess | ApiAccess | ⚪ No | 汎用 API（`/api/[domain]/**`）のアクセス制御（Extension の「ApiAccess（汎用 API アクセス制御）」）。**未宣言時は admin カテゴリのみ許可（fail-closed）** |
| generate | boolean | ⚪ No | 生成するか（登録ごと、既定 true、D337）。true = `pnpm forge` / `pnpm generate domain` がその登録の生成物を全部作り直す（登録ごと。登録の多いドメインも生成する登録ごとに一式）（手の実装は wrappers/ 等に置いて載せ替える）、false = 手で管理し、生成器は何も書かない（README.md の Internals「生成カテゴリ」）。区分ごとの `generateFiles` は廃止（書いてあると生成が止まる）。fork が true / false を決めるときは `pnpm check domain -- --compare`（手の変更・新しい入口・表の書き直しを出す。`scripts/structure/domain/README.md`「generate の旗を決める」） |
| $comment | string \| string[] | ⚪ No | 開発者のメモ（JSON にはコメントが無いため）。トップレベル・Relation・Field・collection・FieldGroup のどこにでも書ける（下の「開発者のメモ（$comment）」） |

#### cache（共有の読みのキャッシュの宣言）

- 何を書くか: この登録のどの読みを要求をまたぐ共有のキャッシュにするか・書き込みで消すか時間で切れるか・寿命・他のどのドメインの書き込みでも消すか。包んだ読みの関数は生成器が出す（手で `"use cache: remote"` を書かない）
- 置き場(読みの持ち主の宣言、D353): 登録の標準の読み(get・list・名前付きの読み)はその登録の `entities/<登録名>/entity.json` の `"cache"`(どの登録も、ドメインの既定を継がない)。登録をまたぐ読みは `domain.json` の `"cache".reads`(その語彙は cache の議会が決める、まだ書けない)。`<domain>/cache.json` は廃止(あれば検査が止める)。fork は登録の隣の `entity.override.ts` の `cache` で丸ごと差し替える。`generate` の値に関わらず効く
- `mode`（必須）: `"tagged"` = 書き込みでキャッシュタグ（`cacheTagOf(domain)`・`cacheTagOf(domain, id)`、`src/lib/cacheTags`）を消す / `"ttl"` = 書き込みで消さず短い寿命で切れる
- `life`（必須、寿命は必ず有限）: cacheLife の preset 名（`minutes` / `hours` / `days` / `weeks` / `max`、`default` は寿命が無限・`seconds` は覚えないので不可）か `{ stale?, revalidate?, expire }`（秒、`expire` 必須、stale ≤ revalidate ≤ expire）
  - 上限: `tagged` は 30 日（`weeks` まで、書き忘れた読むドメインの分の古さを受ける上限）、`ttl` は 1 時間（`minutes` まで）
- `get`（既定 true）: `base.get(id)` を包む（行のキャッシュタグ `<domain>:<id>`）
- `list`: `{ limit }` = 上限つきの list を包む（`limit` は 1〜1000）
- `reads`: 条件を宣言で固めた名前付きの読み `[{ name, where?, orderBy?, limit, mode?, life? }]`（`base.search` の固定の引数、引数を取らない）
  - `name` = 小文字で始まる英数字、重複なし、`get` / `list` は不可 | `where` = crud の WhereExpr（`{ field, op, value }`・`{ and: [...] }`・`{ or: [...] }`、`field` は camelCase の列名）| `orderBy` = `[[列, "ASC"|"DESC", ("FIRST"|"LAST")?], ...]` | `limit` 必須（1〜1000）| `mode` / `life` は頭の値を継ぎ、上書きもできる
  - 利用者の打った語など鍵の数に上限の無い search と、wrappers/ の手書きの読み（actor で絞る等）は宣言しない（包まない）
- `readsDomains`: この読みが読む他のドメイン（地区の地図の名前、camelCase）。そのドメインの書き込みのキャッシュタグでも消える。自分は書かない（自分のキャッシュタグは必ず付く）
- 例:

```json
"cache": {
  "mode": "tagged",
  "life": "days",
  "list": { "limit": 100 },
  "reads": [
    { "name": "published", "where": { "field": "isPublished", "op": "eq", "value": true }, "orderBy": [["createdAt", "DESC"]], "limit": 20 }
  ],
  "readsDomains": ["user"]
}
```

- 置き場が止まった時: 生成した読みは `readThrough`(`@/lib/cacheTags/server`)で包まれ、置き場(cacheHandlers の remote)が投げたら DB を直に読んで返す(記録の 1 行 `cache read fell back to the database`)。Next は handler の `get` の失敗を包まず描画の失敗にする(確かめ: 投げる handler で包まない読みは 500、包んだ読みは 200)。fork が自分の handler を書く時も、中の失敗は拾って `undefined`(取りこぼし)を返す
- 覚える値の大きさ(Vercel の Runtime Cache、地域ごと): 1 項目 2 MB まで・8 KB 単位で読み書きの課金・1 項目のキャッシュタグは 128 まで(readsDomains は 100 個まで)・Hobby は月に読み 1M / 書き 200K で止まる(チーム 1 つで共有)
  - list と名前付きの読みの limit は 1000 まで: 1 行 2 KB なら 1000 行で 2 MB に届く。大きな列(本文・JSON)を持つ表は limit を小さく、一覧に要る列だけの名前付きの読みにはしない(列は選べない: base の行が丸ごと入る)
  - `life` の `seconds`(revalidate 1 秒)は読むたびに作り直すのと同じで覚えない(確かめ、検査が止める)。短い寿命は `{ revalidate, expire }` の秒か `minutes`
  - 他の地域への消しの届き方は未測(地域は入れない)。書き込みの直後の読みは同じ地域では新しい値(確かめ: preview の 3 つのインスタンス)
- 生成: `pnpm generate cache` が登録ごとに `<domain>/services/server/<登録名>CachedReads.ts`（`<登録名>CachedReads` の get・list・名前付きの読み）を書く。宣言のある登録の `<登録名>Base.ts` の base は `cacheTags: { domain: "<登録名>" }` を持つ（`generate: true` は `pnpm generate domain` が書く、手で管理する登録は手で書く。無いと生成器が止まる）。読み方: `scripts/structure/cache/README.md`
- 検査: `pnpm check domain`（全ドメイン、`scripts/structure/domain/checks/cache.mjs`）| 型: `src/lib/domain/types/cache.ts` の `DomainCacheDeclaration` | 既定を埋めた形: `scripts/structure/domain/spec/cache.mjs` の `normalizeCacheDeclaration`

#### 開発者のメモ（$comment）

- `"$comment"` = 開発者向けのメモ（JSON Schema の注記と同じ名前）。値は文字列か文字列の配列（複数行）。トップレベル・`relations[]`・`fields[]`・`fields[].collection`・`fieldGroups[]` のどこにでも書ける
- 動作には効かない: 生成器は読まず（あっても無くても生成物は同じ）、client の写し（`entities/display.ts`）にも出ない。画面に出す説明文は `helperText` に書く（`$comment` は画面に出ない）
- メモを別のキー（`description` など）に書くと、知らないキーとして警告される（同じキーはドメインごとに 1 行にまとまる）

> ⚠️ **オプショナルフィールドを追加する場合**: `src/lib/domain/types/domainConfigOptionals.ts` の `DomainConfigOptionals` にも同じフィールドを追加すること。省略すると、そのフィールドを持たないドメインが存在するだけで DomainConfig の union 型が壊れてビルドエラーになる。

### Relation（リレーション定義）

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| domain | string | 🟢 Yes | 関連先ドメイン名（snake_case） |
| label | string | 🟢 Yes | 表示名 |
| fieldName | string | 条件付き | フィールド名。relationType により意味が異なる（後述） |
| fieldType | `"uuid"` \| `"string"` \| `"integer"`（Firestore は `"string"` \| `"number"` \| `"reference"`） | 条件付き | 外部キーの型（belongsTo / belongsToMany で必須、hasMany では不要。省略 = 主の idType。数値の ID は `integer`、`number` は Neon では使えない） |
| relationType | RelationType | 🟢 Yes | リレーション種別 |
| required | boolean | ⚪ No | 必須かどうか（belongsTo のみ有効） |
| onDelete | `"RESTRICT"` \| `"CASCADE"` \| `"SET_NULL"` | ⚪ No | 削除時の挙動（belongsTo のみ） |
| includeRelationTable | boolean | ⚪ No | 中間テーブル定義を含めるか（belongsToMany のみ。省略 = true） |
| labelField | string | ⚪ No | セレクトボックスのラベルに使うフィールド（デフォルト: `name`） |
| formInput | RelationFormInput | ⚪ No | フォーム入力種別（省略時はデフォルト値） |

#### RelationType

| 値 | 説明 | Neon | Firestore |
|----|------|------|-----------|
| belongsTo | N:1 参照 | ○ | ○ |
| hasMany | 1:N 子リスト（withRelations で子レコード配列を展開） | ○ | × |
| hasOne | 1:1 | ○ | ○ |
| belongsToMany | M:N 多対多 | ○ | × |

#### fieldName の意味（relationType 別）

| relationType | fieldName の意味 | 例 |
|---|---|---|
| belongsTo | 自テーブルの外部キーカラム名 | `"category_id"` |
| belongsToMany | 自テーブルの配列フィールド名 | `"tag_ids"` |
| hasMany | 管理用の識別名（**子テーブルの FK 生成には使われない**） | `"sample_id"` 等 |

> ⚠️ **hasMany の FK 生成ルール**: 子テーブル側の外部キーカラム名は `親のsingular + "_id"` で自動決定される。例: 親が `gacha_machine` なら子テーブルの FK は `gacha_machine_id`。fieldName の値は直接使われない。

#### onDelete（削除時の挙動）

belongsTo の外部キーに付く参照先削除時の挙動。`pnpm generate domain` が `entities/drizzle.ts` の `.references()` 第2引数（FK 名が 63 文字を超える場合は短縮名の `foreignKey(...).onDelete()`）に出力する（`scripts/structure/domain/domain/relations.mjs` の `getOnDeleteBehavior` / `buildOnDeleteOption`、出力は `render/entities/drizzle/foreignKeys.mjs`）。

| 値 | 参照先が削除されたとき | 生成される Drizzle 設定 |
|---|---|---|
| `RESTRICT`（既定） | 参照があれば削除を拒否（エラー → トランザクション全体がロールバック） | `onDelete: "restrict"` |
| `CASCADE` | このレコードも削除 | `onDelete: "cascade"` |
| `SET_NULL` | 外部キーを NULL にする | `onDelete: "set null"` |

- 適用対象は belongsTo のみ（FK が自テーブルにあるため）。hasOne / hasMany は FK が相手側なので設定しない。belongsToMany の中間テーブルは両側 CASCADE 固定
- 解決順: `onDelete` があればそれ → 旧形式 `onDeleteCascade: true` なら CASCADE → それ以外（`onDeleteCascade: false` / 未指定）は RESTRICT
- 既定を RESTRICT にしているのは、意図しない連鎖削除を防ぎ、CASCADE / SET_NULL を明示的な選択にするため
- `SET_NULL` と `required: true` は矛盾する（NOT NULL 列を NULL にできない）ため、`pnpm generate domain` がエラー終了する
- FK 制約が働くのは物理削除のみ。ソフトデリート（`deleted_at` 設定）では onDelete は発火しない

#### hasMany と withRelations

hasMany リレーションを定義すると、`pnpm generate domain` 時に `<登録名>Base.ts` へ `hasManyRelations` 設定が自動生成される。これにより `withRelations: 1` で子レコード配列が親に展開される。

- 親あたりのデフォルト取得上限: 100件
- 呼び出し側で `hasManyLimit` を指定してオーバーライド可能（例: `search({ withRelations: 1, hasManyLimit: 20 })`）
- `withRelations` の depth 上限は 3（`resolveRelationDepth` で制限）
- hasMany はエンティティ・スキーマ・フォームには影響しない（サーバーサービスの読み取り時のみ）

#### RelationFormInput

リレーションフィールドのフォーム入力種別。省略時は relationType に応じたデフォルト値が使われる。hasMany / hasOne にはフォーム入力は適用されない。

| relationType | デフォルト | 指定可能な値 |
|---|---|---|
| belongsTo | `select` | `select`, `combobox`, `asyncCombobox`, `custom` |
| belongsToMany | `checkbox` | `checkbox`, `multiSelect`, `asyncMultiSelect`, `custom` |

- `select` / `checkbox`: 初回に全件取得して選択肢を表示（少量データ向け）
- `combobox` / `multiSelect`: 全件取得 + 検索フィルタ付き（中量データ向け）
- `asyncCombobox` / `asyncMultiSelect`: ユーザー入力時に非同期検索（大量データ向け）
- `custom`: UI は自分で実装。スキーマには含まれるが、自動 UI 描画なし

`asyncCombobox` / `asyncMultiSelect` を指定した場合、リレーション先の `searchFields`（entity.json）が自動的に検索対象として使用される。
全件取得する関連（`async*` と `custom` 以外。省略時の `select` / `checkbox` を含む）は、生成された管理画面（追加・編集）がサーバーで先読みして SWR の fallback に渡す。`async` / `custom` の関連と `includeRelationTable: false` の belongsToMany（逆側）は先読みしない。判定は `src/lib/domain/relations/relationOptions.mjs` に集約（`useRelationOptions` / 管理画面の取得本体 `fetchAdminRelationOptions` / 生成器が共有）。

`custom` を指定した場合、データ取得は行われず FieldConfig のみ生成される。
`beforeField` / `afterField` で独自コンポーネントを注入する（通常フィールドの `custom` と同じ仕組み）。

#### リレーション定義例

```json
{
  "relations": [
    {
      "domain": "user",
      "label": "担当者",
      "fieldName": "user_id",
      "fieldType": "uuid",
      "relationType": "belongsTo",
      "formInput": "asyncCombobox"
    },
    {
      "domain": "tag",
      "label": "タグ",
      "fieldName": "tag_ids",
      "fieldType": "uuid",
      "relationType": "belongsToMany"
    },
    {
      "domain": "order_item",
      "label": "注文明細",
      "fieldName": "order_item_id",
      "relationType": "hasMany"
    }
  ]
}
```

custom リレーションの UI 実装例:
```tsx
<SampleFields
  methods={methods}
  beforeField={{
    project_id: (
      <ControlledField
        control={control}
        name="project_id"
        label="プロジェクト"
        renderInput={(field) => <MyProjectSelector {...field} />}
      />
    )
  }}
/>
```

### Field（フィールド定義）

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| name | string | 🟢 Yes | フィールド名（snake_case） |
| label | string | 🟢 Yes | 表示名 |
| fieldType | NeonFieldType / FirestoreFieldType | 🟢 Yes | データ型（型は `@/lib/domain`、名前は表から導く） |
| formInput | FormInput | 🟢 Yes | フォーム入力種別 |
| required | boolean | ⚪ No | 必須かどうか（配列の型では「空配列を既定にする」の意味で、1 件以上の意味ではない） |
| readonly | boolean | ⚪ No | 読み取り専用（テキスト系は readOnly、選択系は disabled として適用） |
| defaultValue | any | ⚪ No | デフォルト値（型に合う値。enum は options の value のどれか。timestamp・jsonb・配列・メディア・集まりの型は持てない） |
| options | Option[] | ⚪ No | 選択肢（enum では必須。select, radio, 配列の checkbox, multiSelect で使用し、無いと警告）。boolean に書くと初期値が未選択になる（radio のときは書く） |
| displayType | `"standard"` \| `"bookmark"` | ⚪ No | radio/checkbox の表示スタイル |
| placeholder | string | ⚪ No | プレースホルダー（textInput, numberInput, textarea, select, multiSelect, emailInput, passwordInput で使用） |
| collection | Collection | ⚪ No | 主の集まりの宣言（fieldType `mediaCollection` の項目。Extension の「主の集まりの項目（mediaCollection）」） |

- リレーションのラベルの既定は関連先の `name` 項目（labelField の既定）なので、選ばれる側のドメインには `{ "name": "name", "fieldType": "string", "formInput": "textInput" }` の項目を置くとよい
- 型と入力欄の組は `src/lib/domain/fields/fieldFormInputs.mjs` の表（表に無い組は警告）

#### NeonFieldType（Neon）

| 値 | 説明 |
|---|---|
| string | 文字列 |
| integer | 整数 |
| float | 浮動小数 |
| boolean | 真偽値 |
| enum | 列挙型 |
| date | 日付 |
| time | 時刻 |
| timestamp With Time Zone | タイムゾーン付き日時 |
| email | メールアドレス |
| password | パスワード |
| bigint | 64bit整数 |
| numeric(10,2) | 固定小数（精度10、スケール2） |
| uuid | UUID |
| Point | 座標点 |
| jsonb | JSONオブジェクト |
| array | 配列 |
| mediaUploader | メディアアップロード用 |
| mediaCollection | 主の集まり（同じドメインの従属の登録のメディアの行の並び。列を持たない。formInput は `mediaUploaderMulti`） |

`mediaUploaderMulti`（1 列の text[] に複数のメディアを持つ型）は廃止した。entity.json に残っていると pnpm generate domain が集まりへの移行を案内するエラーで止まる。複数のメディアは mediaCollection で持つ（formInput の `mediaUploaderMulti` は集まりの入力欄の名前として残る）

#### FirestoreFieldType（Firestore）

| 値 | 説明 |
|---|---|
| string | 文字列 |
| number | 数値 |
| boolean | 真偽値 |
| timestamp | 日時 |
| email | メールアドレス |
| password | パスワード |
| array | 配列 |
| geopoint | 緯度経度 |
| reference | ドキュメント参照 |
| map | オブジェクト |
| null | null値 |

#### FormInput

組み込みの名前の正は `src/lib/domain/fields/formInputs.mjs`。独自の部品は自分のドメインか lib の `plugs/formInputs/` に登録すると名前を書ける（`src/lib/formSuite/README.md` Extension。描画だけで、初期値・Zod・列は fieldType が決める）。組み込みにも登録にも無い名前は生成の前に止まる（fields・relations。`generate: false` は検査の外で、手書きの FieldConfig は TS が止める）。

| 値 | 説明 |
|---|---|
| textInput | 1行テキスト |
| numberInput | 数値入力 |
| textarea | 複数行テキスト |
| select | 単一選択セレクト |
| multiSelect | 複数選択セレクト |
| radio | ラジオボタン |
| checkbox | チェックボックス |
| stepperInput | 数値ステッパー |
| switchInput | スイッチ |
| dateInput | 日付入力 |
| timeInput | 時刻入力 |
| datetimeInput | 日時入力 |
| emailInput | メール入力 |
| passwordInput | パスワード入力 |
| colorInput | カラーピッカー + hexコード入力 |
| mediaUploader | メディアアップロード |
| hidden | 非表示入力 |
| none | 入力なし（フォームに出さない、スキーマからも除外） |
| custom | カスタムUI（スキーマには含める、UIは自分で実装） |

#### hidden vs custom vs none の違い

| 項目 | hidden | custom | none |
|------|--------|--------|------|
| Zodスキーマ | 含める | 含める | **除外** |
| フォームデータ | 含む | 含む | **含まない** |
| UI描画 | なし | なし（自分で実装） | なし |
| 用途 | プログラマティックに値を設定するフィールド | 独自UIで入力するフィールド | DBのみで使うフィールド（API経由で設定） |

⚠️ **よくある間違い**: プログラマティックに値を設定したい場合は `hidden`（または独自UIがあれば `custom`）を使う。`none` はスキーマから除外されるため、フォームから値を送信できない。

#### custom の使い方

`formInput: "custom"` を指定したフィールドは、FieldRenderer では何も描画されない。
代わりに `beforeField` / `afterField` props で独自コンポーネントを挿入する。

**推奨: `ControlledField` を使う**

統一感を保つため、`ControlledField`(`@/lib/formSuite`) を使用する。
以下が自動で統一される:
- ラベル・必須マーク
- エラーメッセージ表示
- 説明テキスト
- レイアウト（vertical/horizontal）
- オートセーブ対応

```tsx
// entity.json
{ "name": "custom_field", "fieldType": "string", "formInput": "custom" }

// フォームコンポーネント
import { ControlledField } from "@/lib/formSuite";

<FieldRenderer
  control={control}
  methods={methods}
  baseFields={fields}
  beforeField={{
    custom_field: (
      <ControlledField
        control={control}
        name="custom_field"
        label="カスタムフィールド"
        required
        renderInput={(field, inputClassName) => (
          <MyCustomInput {...field} className={inputClassName} />
        )}
      />
    )
  }}
/>
```

**Field層の構成**

| 層 | パス | 用途 |
|----|------|------|
| Configured | `Form/Field/Configured/` | FieldConfigベース（生成コード向け） |
| Controlled | `Form/Field/Controlled/` | control + renderInput（**custom で推奨**） |
| Manual | `Form/Field/Manual/` | controlなし（完全手動） |

#### Option

```json
{ "value": "apple", "label": "りんご" }
```

- value: 保存される値（string, number, boolean）
- label: 表示テキスト

### FieldGroup（フィールドグループ）

管理画面フォームのフィールドをセクション（`<fieldset>` + legend）に分けて表示する。生成された `XxxFields` が写し（`entities/display.ts`）の `fieldGroups` を自動で読み込む（props の `fieldGroups` 指定で上書きも可能）。

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| key | string | 🟢 Yes | グループキー（一意識別子。`beforeGroup` / `afterGroup` のキーにもなる） |
| label | string | 🟢 Yes | セクションの表示ラベル |
| fields | string[] | 🟢 Yes | グループに含むフィールド名 |
| collapsible | boolean | ⚪ No | 折りたたみ可能か（デフォルト: false） |
| defaultCollapsed | boolean | ⚪ No | 初期状態で折りたたむか（デフォルト: false） |
| bgColor | string | ⚪ No | 背景色（CSSカラーコード、例: `"#f0f7ff"`） |

```json
{
  "fieldGroups": [
    {
      "key": "basic",
      "label": "基本情報",
      "fields": ["name", "description"],
      "bgColor": "#f0f7ff"
    },
    {
      "key": "datetime",
      "label": "日時設定",
      "collapsible": true,
      "defaultCollapsed": true,
      "fields": ["sale_start_at", "date"]
    }
  ]
}
```

- どのグループにも属さないフィールドは、全グループの後ろに「グループ外枠」としてまとめて描画される
- セクションへのUI差し込み（オーバーライド警告等）は `beforeGroup` / `afterGroup` props で行う
- 描画仕様・カスタマイズの詳細: `src/lib/formSuite/FieldRenderer/README.md`

### 複数の列のユニーク制約

**Neon (PostgreSQL/Drizzle) 専用機能**。`indexes` の 1 件に `"unique": true` を書く（ユニークはこの形だけ。今の entity.json に `compositeUniques` は無い）。

```json
{
  "indexes": [
    { "fields": ["name", "type", "category_id"], "unique": true, "name": "things_name_type_category_unique" },
    { "fields": ["email", "organization_id"], "unique": true, "where": "deleted_at IS NULL" }
  ]
}
```

- ソフトデリートの表で生きている行だけに効かせるなら `where` に `deleted_at IS NULL` を書く
- CRUD 操作時に制約違反があると 409 エラーを返す

## Extension

### 主の集まりの項目（mediaCollection）

主の登録の 1 行に属する、同じドメインの中の従属の登録の行の並び（例: 商品のギャラリー画像）。従属はドメインではなく主のドメインの中の登録（`entities/<従属>/`）で、主と一緒に開け閉めする。主の表に列は持たず、lib の collections オプション（[src/lib/crud/collections/README.md](../lib/crud/collections/README.md)）で読み書きする。Neon のみ。

- 1 つのレコードに複数のメディアを持たせる方法はこれだけ（1 枚ずつ従属の登録の行に保存）。旧来の fieldType `mediaUploaderMulti`（1 列の text[]）は廃止した
- 例: `src/domains/sample/entities/sample/entity.json` の `images`（従属の登録 `src/domains/sample/entities/sampleImage/`）
- 所有の印は書かない: 主の集まりの項目が名指し、同じドメインにあり、主への必須の CASCADE の belongsTo を持つことから読む
- 廃止前の mediaUploaderMulti 列を集まりへ移す: [src/lib/crud/collections/Usage.md](../lib/crud/collections/Usage.md)「既存の mediaUploaderMulti 列からの移行」（手順・やってはいけないこと・確かめ方・戻し方）

```json
{ "name": "gallery_images", "label": "ギャラリー", "fieldType": "mediaCollection", "formInput": "mediaUploaderMulti",
  "required": true, "reorderable": true, "collection": { "registration": "product_image", "maxItems": 10, "duplicate": true } }
```

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| collection.registration | string | 🟢 Yes | 従属の登録の singular（snake_case。主と同じドメインの中の登録） |
| collection.maxItems | number（1 以上の整数） | ⚪ No | 最大件数。省略 = 上限なし |
| collection.duplicate | boolean | ⚪ No | 主の複製で従属も写すか。省略 = true |

- 必須 = `required`、並べ替え = `reorderable`（既存のキー。省略 = true）
- ファイルの条件（slug・mediaTypePreset・accept・validationRule・storage）は主に書かず、従属の登録のメディア項目に書く
- 語彙の検査（宣言の語彙の警告）は collection の下位キーの型を見る
- pnpm generate domain は、従属の登録の宣言（主のドメインの `entities/<collection.registration の camelCase>/entity.json`。domain.json は書かない）が**無いときだけ**書き出し、主のドメインの生成の単位に足す（既にあれば触らない。`--only` でも、dry-run では「作成 / 保持」と出すだけ）。書き出す雛形:
  - singular = `collection.registration`、plural = 既定の名前のままなら `<主>_<項目名>`（項目名が s で終わるとき）、それ以外は singular の複数形、label = 主の項目の label、Neon、idType = 主と同じ（外部キーの型は idType number なら integer）
  - relations = 主への belongsTo（`<主>_id`、必須、onDelete CASCADE）。主の relations には足さない
  - fields = メディア項目 `file`（mediaUploader、images / `image/*`、10MB、slug = 主の項目名の camelCase）と並び列 `sort_order`（hidden、`sortOrderField` と `systemColumns` に宣言）。useSoftDelete false
  - 汎用 API は閉じる（`apiAccess: { read: "none", write: "none" }` = INTERNAL_ONLY）、addToAdminDataMenu false。従属の生成カテゴリは生成器が決める: entities / serverServices / registry / fieldConstants / presenters だけ（管理画面・フック・クライアントは主の画面から使う。entity.json には書かない）
  - `file` の storage は主の汎用 API の規則から写す: upload = 主の create と update の和、read = 主の get、visibility = read が `"public"` なら public、それ以外は private。写せるのは `"public"` / `"authenticated"` / ロールの規則だけで、主が閉じている（`"none"`）・知らない値・主が `generate: false`（apiAccess が生成の既定を重ねない登録表の値そのもの）なら管理者のみを書き、直す場所を出力する
  - ファイルの条件（preset・accept・上限）は雛形の既定なので、従属の entity.json で直す
- 従属が守ること（pnpm generate domain が書く前に検査し、1 つでも外れれば全件を並べて何も書かずに止まる。一覧と判定: [scripts/structure/domain/README.md](../../scripts/structure/domain/README.md)「pnpm generate domain」）
  - 主への belongsTo はちょうど 1 本・required・onDelete CASCADE、`useSoftDelete` は false
  - メディア項目（mediaUploader）はちょうど 1 つ。mediaCollection は持たない。ファイルの条件はここに書く（主の項目には書かない）
  - `sortOrderField` とその項目を持ち、`systemColumns` に入れる（集まりの並びを持つ列。主の項目が reorderable: false でも要る）
  - 主の画面から埋められない必須の項目（主への参照・メディア・並び以外で required かつ defaultValue なし）を持たない
  - `file` の upload は主の create・update の和より狭くしない、read は主の get より狭くしない（public の従属は見ない）。広い upload と、開いた汎用 API は知らせるだけ
  - 表名・主への FK 名は 63 字以内、singular・表名は他の登録と重ねない。従属の登録が主と別のドメインにあれば止まる（主のドメインの中へ移す）。required の集まりは `collection.duplicate: false` にしない

### MediaUploader フィールド追加プロパティ

保存先は項目ごとに自動で決まる用途 `<domain>.<field>`（purpose）で決まる。保存先パスの指定（旧 `uploadPath`）は無い。

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| slug | string | 🟢 Yes | ハンドラ識別子（camelCase） |
| mediaTypePreset | `"images"` \| `"videos"` \| `"imagesAndVideos"` \| `"all"` | 🟢 Yes | 許可ファイル種別 |
| accept | string | 🟢 Yes | accept 属性値（例: `image/*,video/*`）。受け付ける型を必ず列挙する（`"all"` の preset でも空にしない。空だと pnpm generate domain が止まる。lib は `*/*` を受けない）。preset の目安: images = `image/*`、videos = `video/*`、imagesAndVideos = `image/*,video/*` |
| validationRule | object | ⚪ No | バリデーション設定 |
| validationRule.maxSizeBytes | number | ⚪ No | 最大ファイルサイズ（バイト） |
| helperText | string | ⚪ No | 欄の説明文。フィールドの枠がラベルの下に描く（メディア以外の欄でも同じ。`src/lib/formSuite/README.md`「説明文と読み上げ」） |
| metadataBinding | object | ⚪ No | メタデータを別フィールドに保存 |
| storage | object | ⚪ No | ファイル用途の設定（下の「ファイルの保存（storage）」） |
| storage.visibility | `"public"` \| `"private"` | ⚪ No | 公開・非公開。**一般利用者がアップロードできる項目では必須**（省略すると pnpm generate domain がエラーで止まる） |
| storage.upload | アクセスルール（`"public"` 以外） | ⚪ No | アップロードしてよい人。省略時は apiAccess の create と update の許可者の和 |
| storage.read | アクセスルール（`"public"` を含む） | ⚪ No | 読んでよい人。省略時は apiAccess の get の規則 |
| storage.metadata | `"strip"` \| `"keep"` | ⚪ No | 画像の位置情報などのメタデータの扱い。省略 = `"strip"`（サーバーが描き直して消す）。原本のまま残す項目（書類・明細など）だけ `"keep"` |
| storage.image | `{ "maxDimension": number, "quality"?: number }` | ⚪ No | 画像の縮小の指定。長い辺が `maxDimension`（px）を超える画像を縮める。`quality` = 1〜100（省略 = `storage.config` の `imageStrip.quality`）。省略 = 縮めない。strip の画像の項目だけ（下の「ファイルの保存（storage）」） |

#### metadataBinding キー

```
sizeBytes, width, height, aspectRatio, orientation,
mimeType, src, durationSec, durationFormatted
```

#### ファイルの保存（storage）

pnpm generate domain は、メディア項目ごとにファイル用途（`<domain>.<field>`）を ドメインの `services/server/<登録名>StoragePurposes.ts` に書く（`--only registry` でも書く。`pnpm generate registry` がその一覧 `src/registry/storagePurposeRegistry.ts` を作る）。登録表に無い用途は、アップロードも読み取りも拒否される。用途の型と規則は [src/lib/storage/README.md](../lib/storage/README.md)、台帳は [core/storageObject/README.md](core/storageObject/README.md) を参照。

- 用途 ID は `<domain>.<field>`。ref とオブジェクトのパスに入るため、使い始めた後はドメイン名・項目名を変えない
- contentTypes は accept から作る
- metadata は `storage.metadata`（省略 = `"strip"`）。画像を含む項目（accept に `image/` で始まる型がある）には明示値で書き出す。画像の無い項目には書き出さない（効果が無いため）
  - strip（省略を含む）の項目は、画像を jpeg / png / webp / gif / avif だけ受け付ける（`image/*` はこの 5 型に読み替え）。端末の写真選択も 5 型に絞られ、iOS は HEIC を JPEG にして渡す
  - **生成エラー**: strip（省略を含む）の accept にサーバーで描き直せない画像の型（`image/heic`・`image/svg+xml`・`image/tiff` など）がある / 画像の型が無い項目に `"strip"` を明示した。直し方 = `"storage": { "metadata": "keep" }` を書くか、accept を 5 型か `image/*` にする
  - strip の約束の範囲（動画・keep・導入前のファイルは対象外）と公開文書に書いてよい表現: [src/lib/storage/README.md](../lib/storage/README.md)「位置情報の約束」
- image は `storage.image` を明示値で書き出す（省略 = 書き出さない = 縮めない）。縮小の指定はこの用途に 1 か所で、validationRule・FieldConfig には書かない。ブラウザが送る前に縮め、サーバーが描き直しで守らせる（[src/lib/storage/README.md](../lib/storage/README.md)「画像の縮小の指定」）
  - **生成エラー**: 形・範囲の誤り（maxDimension は 1 以上の整数、quality は 1〜100 の整数、ほかのキーは書けない）/ 画像の型が accept に無い / `storage.metadata: "keep"`（keep はサーバーが描き直さず守らせられない）
  - 写真の集まり（collection）の写真は、主の項目ではなく従属の登録の `file` 項目の `storage.image` に書く（集まりを作るときに主の項目から写す口は無い）
  - 利用者への案内は欄の `helperText` に書く（フィールドの枠が描く。部品の中には案内を足さない）。例: `"helperText": "大きな写真は長い辺 2048px まで自動で縮小してから送ります"`。数値は `storage.image.maxDimension` と揃える
- maxBytes は `validationRule.maxSizeBytes` を使う。無ければ `src/domains/core/storageObject/config.ts` の `storageObjectConfig.defaultMaxBytesByPreset.<mediaTypePreset>` を参照する式を書き、警告を出す
- upload.allow は `storage.upload` を使う。無ければ apiAccess の create と update の許可者の和にする
  - どちらかが `"public"` か `"authenticated"` なら `"authenticated"`（アップロードは常にログインが要る）
  - ロールの規則どうしは roles / roleCategories を合わせる。`"none"` は数えない
- visibility は `storage.visibility` を使う。無いときは次のとおり
  - **一般利用者（admin 以外のカテゴリ）がアップロードできる項目 → 生成エラー**（公開か非公開かを人が決めるため）
  - 管理者だけがアップロードできる項目 → 読める人（`storage.read`、無ければ apiAccess の get）が `"public"` なら public、それ以外は private
- private の用途には read.allow として読める人（`storage.read`、無ければ apiAccess の get の規則）を付ける。`storage.read` の `"public"` も書ける（visibility を private と明示した項目でもそのまま出す）
- 同じ ID が項目(`<ドメイン>/plugs/storageObjectPurposes/`)にもあると、用途表を合成するときに例外になる（`purposeSource.ts`）。AUTO から外したい用途は項目へ移す。手書きの定義（check 関数付きなど）が優先される
- 項目を消して再生成すると、そのファイルから消える（メディア項目が 1 つも無くなるとファイルは書かれず、前の版が残るので手で消す）。pnpm generate domain -- --delete はフォルダごと消す
- core ドメインの宣言（notification / coupon など）は、手で管理（`generate: false`）の間は `<ドメイン>/plugs/storageObjectPurposes/` に手で書く。`generate: true` にすると同じ ID は重複の例外になるので、そちらからは消す。`pnpm test scripts/structure/registry/check-storage-purposes.test.mjs` が、全 domain.json のメディア項目に用途があるかと、手書き（CORE / FORK）の用途の metadata の規則（上の生成エラーと同じ規則、`user.avatar` を keep にしない）を確かめる

### indexes（検索/集計用インデックスとユニーク制約）

**Neon (PostgreSQL/Drizzle) 専用機能**。Firestore では利用不可。

検索・集計頻度が高いカラム（WHERE フィルタ、期間絞り込み、JOIN キー等）にインデックスを宣言する場合に使用。`unique: true` を書けばユニーク制約（上の節）、書かなければ**ユニーク制約なしの検索高速化用**。

```json
{
  "indexes": [
    { "fields": ["status"] },
    { "fields": ["status", "fulfilled_at"] },
    { "fields": ["status"], "where": "deleted_at IS NULL" },
    { "fields": ["external_id"], "name": "custom_short_idx" },
    { "fields": ["title"], "using": "gin", "opclass": { "title": "gin_trgm_ops" } },
    { "fields": ["metadata"], "using": "gin", "opclass": { "metadata": "jsonb_path_ops" } }
  ]
}
```

#### プロパティ

| プロパティ | 型 | 必須 | 説明 |
|---|---|---|---|
| fields | string[] | 🟢 Yes | インデックス対象カラム（先頭から複合キー）。生成後の `entities/<登録名>/drizzle.ts` に現れるプロパティ名で指定する。業務フィールドは domain.json の `name` そのまま（例: `name_kana`。`nameKana` は存在せず型エラー）、システム列は `createdAt` / `updatedAt` / `deletedAt` |
| where | string | ⚪ No | 部分インデックスの WHERE 句（SQL リテラル）。例: `"deleted_at IS NULL"` |
| name | string | ⚪ No | インデックス名のオーバーライド。省略時は `{テーブル名}_{col1}_{col2}_..._idx` で自動命名 |
| using | string | ⚪ No | インデックス方式（`gin` / `gist` / `brin` / `hash` など）。省略・`"btree"` は従来どおり `.on(...)`、それ以外は `.using("<方式>", ...)` を出力する |
| opclass | `{ [field]: string }` | ⚪ No | 列ごとの演算子クラス。キーは `fields` に含まれる列（含まれなければ生成エラー）。例: `{ "title": "gin_trgm_ops" }` → `table.title.op("gin_trgm_ops")`。btree の演算子クラス（`text_pattern_ops` 等）にも使える |

`using` / `opclass` の値は生成コードにそのまま入るため、識別子の形（`^[a-z_][a-z0-9_]*$`）以外は生成エラーになる。

#### 名前の自動命名規則

省略時: `{テーブル名}_{col1}_{col2}_..._idx`
例: `indexes: [{ "fields": ["status", "fulfilled_at"] }]` → `referral_rewards_status_fulfilled_at_idx`

`using` が btree 以外のとき: `{テーブル名}_{col1}_..._{using}_idx`（同じ列に btree と GIN を両方張っても衝突しない）。例: `games_title_gin_idx`。既存の名前を保ちたいときは `name` で指定する

PostgreSQL の識別子上限 (63 文字) を超える場合は generator がエラーで停止する。その場合は `name` で短縮指定する。

#### using / opclass を使うときの注意

- **拡張機能は前提**: `gin_trgm_ops` は `pg_trgm`、ベクトル系は `vector` などの拡張が DB に入っている必要がある。pnpm generate domain / db:push は拡張を作らないので、先にユーザーが `pnpm ops db inspect query "CREATE EXTENSION IF NOT EXISTS pg_trgm"` を実行する（無いと push が失敗する）
- **演算子クラスは push で比較されない**: drizzle-kit の index 比較キーに opclass は含まれない（`using` = 方式は含まれる。`scripts/structure/registry/README.md` の round-trip 節）。宣言済みの opclass を後から変えても DB は作り直されないので、変えるときは `name` も変えて別 index として作り直す
- 典型例: 部分一致検索（`ILIKE '%…%'`）= `gin` + `gin_trgm_ops` | jsonb の包含検索（`@>`）= `gin` + `jsonb_path_ops`（既定の `jsonb_ops` なら opclass 不要） | 前方一致（`LIKE 'abc%'`、C 以外の照合順序）= btree + `text_pattern_ops`

#### ユニークとの使い分け

| 用途 | 書き方 |
|---|---|
| 一意性を強制したい (DB レベルの制約) | `indexes` の 1 件に `"unique": true` |
| 検索/集計を高速化したい (ユニーク強制なし) | `indexes` の 1 件(`unique` なし) |

#### ⚠️ DB への反映が必須

`indexes` を追加・変更しても、それだけでは実 DB にインデックスは作成されない。Drizzle スキーマ定義 (`entities/drizzle.ts`) に反映後、必ず以下を実行する:

```bash
pnpm db:push
```

詳細手順は [scripts/structure/registry/README.md の「スキーマ変更を DB に反映する（push）」](../../scripts/structure/registry/README.md) を参照。push を忘れると、コード上は index 定義があってもクエリは全表スキャンのままで、本機能の目的 (検索/集計の高速化) を達成できない。

#### ⚠️ push round-trip の確認（index を書いたら必須）

drizzle-kit は特定の書き方の index を DB から正しく読み戻せず、**DB が既にスキーマどおりでも push のたびに DROP + CREATE する**（本番の大規模テーブルでは書き込みロック）。index を追加・変更したら `pnpm db:push` のあと `pnpm db:push:check` を実行し、差分ゼロを確認してからコミットする。

手書き drizzle.ts での禁止事項: `sql\`${table.col} DESC\``（`.desc()` を使う）、通常列と SQL 式の混在（全列を `sql\`${table.col}\`` にする）。詳細なルールと理由: [scripts/structure/registry/README.md](../../scripts/structure/registry/README.md)

### core ドメインへの indexes 反映について

core ドメイン (`src/domains/core/<domain>/` の宣言) も pnpm generate domain が business と同じに扱う（違いはフォルダだけ。`scripts/structure/domain/README.md`）。今ある core の domain.json は `generate: false`（手で管理）なので、`indexes` を追加・変更する場合は以下のいずれかで反映する:

1. **手書きで `entities/drizzle.ts` を直接編集** (推奨、変更が小さい場合)
   - entity.json の `indexes` 宣言も同時に更新する (将来の整合性のため)
   - 手書きの形式は generator 出力と完全一致させる
2. **一時的に `generate` を true にして `pnpm generate domain -- <domain> --only entities` で entities だけ書き、false に戻す**（false のままでは名指ししても書かない）
   - 手で直していた entities/ の差分を git diff で確かめ、要る手書きを戻してからコミットする。true の間は生成前の検査が掛かる（落ちれば直してから）

### ApiAccess（汎用 API アクセス制御）

`/api/[domain]/**` の汎用 CRUD ルートに対するロールベースのアクセス制御。
判定は `createDomainRoute`（`src/lib/routeFactory`）が一元的に行う。

> **実行時ソースは serviceRegistry**: 登録の entity.json の `apiAccess` は editing source で、
> `pnpm generate registry` が `src/registry/serviceRegistry.ts` のその登録の行の `access` に組む（行 = `{ service, table, idColumn, access, requires? }`）。
> 実行時の認可は registry の access を参照する。管理データ操作（`truncateAll` / `export` / `import`）は
> `operations` に明示したときだけ開く（生成する登録は truncateAll = 管理者、export / import = `useImportExport` から既定を組む。
> 手で持つ登録 `generate: false` は `apiAccess` をそのまま使い、既定を重ねない）。表の物理名と主キー列名（`table` / `idColumn`）も
> 宣言から組む（Firestore は `null`）。fork が core の access を変えるときは `entities/<登録名>/entity.override.ts`。
> 詳細: `src/lib/routeFactory/README.md`「`createDomainRoute` / `createDomainIdRoute` - 汎用CRUDファクトリー」、`src/lib/domain/README.md`「登録表の行の出どころ」

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| read | AccessRule | ⚪ No | 読み取り操作（list, get, search, count）の既定ルール |
| write | AccessRule | ⚪ No | 書き込み操作（create, update, remove, upsert 等）の既定ルール |
| operations | Record<Operation, AccessRule> | ⚪ No | 操作単位の上書き（read/write より優先） |

#### AccessRule

| 値 | 説明 |
|----|------|
| `"public"` | 未認証でもアクセス可 |
| `"authenticated"` | ログイン済み（利用可能ステータス）なら誰でも可 |
| `"none"` | 汎用 API を無効化（404）。専用ルートのみ公開したいドメイン用 |
| `{ "roles": [...], "roleCategories": [...] }` | 指定ロール ID / ロールカテゴリのみ可（OR 条件） |

#### Operation（operations のキー）

`list` `get` `search` `count` `create` `update` `delete` `upsert` `duplicate` `restore` `hardDelete` `reorder` `searchForSorting` `bulkUpsert` `bulkUpdate` `bulkUpdateByIds` `bulkAddRelation` `bulkRemoveRelation` `bulkDeleteByIds` `bulkDeleteByQuery` `replaceByQuery`

管理データ操作（汎用ルートではなく管理画面の専用ルートが評価する。未指定 = `"none"`）: `truncateAll` `export` `import`。生成する登録は entity.json に書かなくてよい（`pnpm generate registry` が `useImportExport` から既定を組む。手で持つ登録は `apiAccess.operations` に書く）

#### フォールバック（fail-closed）

- 登録表の行の `access` は型必須で、`apiAccess` を書かない登録は fail-closed（ADMIN_ONLY）の既定になる
- `read` / `write` / `operations` が当該操作をカバーしない（部分宣言・空 `{}`）場合、既定（`src/lib/domainAccess/accessPresets.ts` の `DEFAULT_ACCESS_RULE`、admin カテゴリのみ。上書きできる設定ではない）が適用される
- **書き忘れても安全側（admin-only）に倒れる**

#### 例

```json
"apiAccess": {
  "read": "public",
  "write": { "roleCategories": ["admin"] },
  "operations": { "hardDelete": "none" }
}
```

#### commands(データ操作のコマンドの上書き、省略可)

`pnpm ops data export|import|update|delete <domain>` は、上の規則で何かしらのロールに許した操作を許す(export / import は `useImportExport`)。API とコマンドで範囲を変えたい時だけ `"commands": { "delete": "deny", "export": "allow" }` のように書く(`"allow"` / `"deny"`)。`pnpm generate registry` が登録表の `access.commands` に写す。詳細: `src/lib/domain/README.md`「データ操作のコマンド(pnpm ops data)の許可」

#### ⚠️ オーナーシップ制御は対象外

ロールガードのみで「自分のレコードだけ」という制御はできない。ユーザー所有データ
（wallet, notification 等）の汎用 API は admin 限定にし、ユーザー向けアクセスは
`createMeRoute`（`/api/me/**`）で所有者スコープを強制すること。`"read": "authenticated"` を
設定すると汎用 API では**他ユーザーのレコードも読める**点に注意。

## Internals

### 生成カテゴリ（generate: true のとき作るもの）

`generate`（登録ごと、既定 true）の登録は、下の全カテゴリを毎回作り直す（集まりの従属は entities / serverServices / registry / fieldConstants / presenters だけ）。`generate: false` は何も書かない（serviceRegistry.ts の行は `pnpm generate registry` がその entity.json から作るので載り続ける）。`generate: false` のドメインはどんな実行でも生成器を通さない（`--only`・`-i` でも書かず、生成前の検査もしない）。今回だけ一部のカテゴリに絞るときは `--only`（`scripts/structure/domain/README.md`）。

| カテゴリ | - | 説明 |
|-----------|-----|------|
| entities | - | エンティティ（`entities/<登録名>/{schema,form,model}.ts` と Neon は `drizzle.ts`・Firestore は `firestore.ts`（`<登録名>CollectionPath`）。集める入口 `entities/<種類>.ts` は `pnpm generate registry`） |
| components | - | 管理画面コンポーネント |
| hooks | - | CRUD フック |
| clientServices | - | axios クライアント |
| serverServices | - | サーバーサービス（`<登録名>Base.ts` は毎回生成、`<登録名>Service.ts` とシードの雛形 `seed.ts`（Drizzle のドメインだけ。書き方 `src/lib/seed/README.md`）は無いときだけ生成） |
| adminRoutes | - | 管理画面ルート（page.tsx 1 行スイッチ + `_screen/`（Screen と loader.ts）の構造で生成。page.tsx は初回のみ生成、`_screen/` は毎回再生成。詳細: `src/lib/screens/README.md` の Internals「生成される管理画面」） |
| registry | - | services/server の `<登録名>Collections.ts`・`<登録名>StoragePurposes.ts`。最後に serviceRegistry.ts を作り直す（登録表の行は entity.json から `pnpm generate registry` が組む） |
| fieldConstants | - | options を持つフィールドの定数/型 |
| presenters | - | テーブル表示用フォーマッタ |
