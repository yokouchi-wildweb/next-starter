# features/ — Extension(domain.json の仕組みのキー)

## Overview

- `domain.json` のうち、メディア・インデックス・汎用 API の権限を足すキー。基本の形は [API.md](./API.md)、入口は [README.md](./README.md)

## Extension

### 主の集まりの項目（mediaCollection）

主の 1 行に属する従属ドメインの行の並び（例: 商品のギャラリー画像）。主の表に列は持たず、lib の collections オプション（[src/lib/crud/README.md](../lib/crud/README.md)「ドメイン集約」）で読み書きする。Neon のみ。

- 1 つのレコードに複数のメディアを持たせる方法はこれだけ（1 枚ずつ従属のドメインの行に保存）。旧来の fieldType `mediaUploaderMulti`（1 列の text[]）は廃止した
- 例: `src/features/sample/domain.json` の `images`（従属 `sampleImage`）
- 廃止前の mediaUploaderMulti 列を集まりへ移す: [src/lib/crud/README.md](../lib/crud/README.md)「既存の mediaUploaderMulti 列からの移行」（手順・やってはいけないこと・確かめ方・戻し方）

```json
{ "name": "gallery_images", "label": "ギャラリー", "fieldType": "mediaCollection", "formInput": "mediaUploaderMulti",
  "required": true, "reorderable": true, "collection": { "domain": "product_image", "maxItems": 10, "duplicate": true } }
```

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| collection.domain | string | 🟢 Yes | 従属ドメインの singular（snake_case） |
| collection.maxItems | number（1 以上の整数） | ⚪ No | 最大件数。省略 = 上限なし |
| collection.duplicate | boolean | ⚪ No | 主の複製で従属も写すか。省略 = true |

- 必須 = `required`、並べ替え = `reorderable`（既存のキー。省略 = true）
- ファイルの条件（slug・mediaTypePreset・accept・validationRule・storage）は主に書かず、従属ドメインのメディア項目に書く
- 語彙の検査（`[domain.json]` の警告）は collection の下位キーの型を見る
- pnpm generate domain は、従属ドメインの domain.json（`src/features/<collection.domain の camelCase>/domain.json`）が**無いときだけ**書き出す（既にあれば触らない。`--only` でも、dry-run では「作成 / 保持」と出すだけ）。書き出す雛形:
  - singular = `collection.domain`、plural = 既定の名前のままなら `<主>_<項目名>`（項目名が s で終わるとき）、それ以外は singular の複数形、label = 主の項目の label、Neon、idType = 主と同じ（外部キーの型は idType number なら integer）
  - relations = 主への belongsTo（`<主>_id`、必須、onDelete CASCADE）。主の relations には足さない
  - fields = メディア項目 `file`（mediaUploader、images / `image/*`、10MB、slug = 主の項目名の camelCase）と並び列 `sort_order`（hidden、`sortOrderField` と `systemColumns` に宣言）。useSoftDelete false
  - 汎用 API は閉じる（`apiAccess: { read: "none", write: "none" }` = INTERNAL_ONLY）、addToAdminDataMenu false。従属の生成カテゴリは生成器が決める: entities / serverServices / registry / fieldConstants / presenters だけ（管理画面・フック・クライアントは主の画面から使う。domain.json には書かない）
  - `file` の storage は主の汎用 API の規則から写す: upload = 主の create と update の和、read = 主の get、visibility = read が `"public"` なら public、それ以外は private。写せるのは `"public"` / `"authenticated"` / ロールの規則だけで、主が閉じている（`"none"`）・知らない値・主が `generate: false`（domainEntry.ts が手書き）なら管理者のみを書き、直す場所を出力する
  - ファイルの条件（preset・accept・上限）は雛形の既定なので、従属の domain.json で直す
- 従属が守ること（pnpm generate domain が書く前に検査し、1 つでも外れれば全件を並べて何も書かずに止まる。一覧と判定: [scripts/structure/domain/README.md](../../scripts/structure/domain/README.md)「pnpm generate domain」）
  - 主への belongsTo はちょうど 1 本・required・onDelete CASCADE、`useSoftDelete` は false
  - メディア項目（mediaUploader）はちょうど 1 つ。mediaCollection は持たない。ファイルの条件はここに書く（主の項目には書かない）
  - `sortOrderField` とその項目を持ち、`systemColumns` に入れる（集まりの並びを持つ列。主の項目が reorderable: false でも要る）
  - 主の画面から埋められない必須の項目（主への参照・メディア・並び以外で required かつ defaultValue なし）を持たない
  - `file` の upload は主の create・update の和より狭くしない、read は主の get より狭くしない（public の従属は見ない）。広い upload と、開いた汎用 API は知らせるだけ
  - 表名・主への FK 名は 63 字以内、singular・表名は他のドメインと重ねない。required の集まりは `collection.duplicate: false` にしない

### MediaUploader フィールド追加プロパティ

保存先は項目ごとに自動で決まる用途 `<domain>.<field>`（purpose）で決まる。保存先パスの指定（旧 `uploadPath`）は無い。

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| slug | string | 🟢 Yes | ハンドラ識別子（camelCase） |
| mediaTypePreset | `"images"` \| `"videos"` \| `"imagesAndVideos"` \| `"all"` | 🟢 Yes | 許可ファイル種別 |
| accept | string | 🟢 Yes | accept 属性値（例: `image/*,video/*`）。受け付ける型を必ず列挙する（`"all"` の preset でも空にしない。空だと pnpm generate domain が止まる。lib は `*/*` を受けない）。preset の目安: images = `image/*`、videos = `video/*`、imagesAndVideos = `image/*,video/*` |
| validationRule | object | ⚪ No | バリデーション設定 |
| validationRule.maxSizeBytes | number | ⚪ No | 最大ファイルサイズ（バイト） |
| helperText | string | ⚪ No | 欄の説明文。フィールドの枠がラベルの下に描く（メディア以外の欄でも同じ。`src/components/Form/README.md`「設定駆動フィールドの使い分け」） |
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

pnpm generate domain は、メディア項目ごとにファイル用途（`<domain>.<field>`）を ドメインの `services/server/storagePurposes.ts` に書く（`--only registry` でも書く。`pnpm generate registry` がその一覧 `src/registry/storagePurposeRegistry.ts` を作る）。登録表に無い用途は、アップロードも読み取りも拒否される。用途の型と規則は [src/lib/storage/README.md](../lib/storage/README.md)、台帳は [core/storageObject/README.md](core/storageObject/README.md) を参照。

- 用途 ID は `<domain>.<field>`。ref とオブジェクトのパスに入るため、使い始めた後はドメイン名・項目名を変えない
- contentTypes は accept から作る
- metadata は `storage.metadata`（省略 = `"strip"`）。画像を含む項目（accept に `image/` で始まる型がある）には明示値で書き出す。画像の無い項目には書き出さない（効果が無いため）
  - strip（省略を含む）の項目は、画像を jpeg / png / webp / gif / avif だけ受け付ける（`image/*` はこの 5 型に読み替え）。端末の写真選択も 5 型に絞られ、iOS は HEIC を JPEG にして渡す
  - **生成エラー**: strip（省略を含む）の accept にサーバーで描き直せない画像の型（`image/heic`・`image/svg+xml`・`image/tiff` など）がある / 画像の型が無い項目に `"strip"` を明示した。直し方 = `"storage": { "metadata": "keep" }` を書くか、accept を 5 型か `image/*` にする
  - strip の約束の範囲（動画・keep・導入前のファイルは対象外）と公開文書に書いてよい表現: [src/lib/storage/README.md](../lib/storage/README.md)「位置情報の約束」
- image は `storage.image` を明示値で書き出す（省略 = 書き出さない = 縮めない）。縮小の指定はこの用途に 1 か所で、validationRule・FieldConfig には書かない。ブラウザが送る前に縮め、サーバーが描き直しで守らせる（[src/lib/storage/README.md](../lib/storage/README.md)「画像の縮小の指定」）
  - **生成エラー**: 形・範囲の誤り（maxDimension は 1 以上の整数、quality は 1〜100 の整数、ほかのキーは書けない）/ 画像の型が accept に無い / `storage.metadata: "keep"`（keep はサーバーが描き直さず守らせられない）
  - 写真の集まり（collection）の写真は、主の項目ではなく従属のドメインの `file` 項目の `storage.image` に書く（集まりを作るときに主の項目から写す口は無い）
  - 利用者への案内は欄の `helperText` に書く（フィールドの枠が描く。部品の中には案内を足さない）。例: `"helperText": "大きな写真は長い辺 2048px まで自動で縮小してから送ります"`。数値は `storage.image.maxDimension` と揃える
- maxBytes は `validationRule.maxSizeBytes` を使う。無ければ `src/features/core/storageObject/config.ts` の `storageObjectConfig.defaultMaxBytesByPreset.<mediaTypePreset>` を参照する式を書き、警告を出す
- upload.allow は `storage.upload` を使う。無ければ apiAccess の create と update の許可者の和にする
  - どちらかが `"public"` か `"authenticated"` なら `"authenticated"`（アップロードは常にログインが要る）
  - ロールの規則どうしは roles / roleCategories を合わせる。`"none"` は数えない
- visibility は `storage.visibility` を使う。無いときは次のとおり
  - **一般利用者（admin 以外のカテゴリ）がアップロードできる項目 → 生成エラー**（公開か非公開かを人が決めるため）
  - 管理者だけがアップロードできる項目 → 読める人（`storage.read`、無ければ apiAccess の get）が `"public"` なら public、それ以外は private
- private の用途には read.allow として読める人（`storage.read`、無ければ apiAccess の get の規則）を付ける。`storage.read` の `"public"` も書ける（visibility を private と明示した項目でもそのまま出す）
- 同じ ID が項目(`src/features/core/storageObject/purposes/`)にもあると、用途表を合成するときに例外になる（`purposeSource.ts`）。AUTO から外したい用途は項目へ移す。手書きの定義（check 関数付きなど）が優先される
- 項目を消して再生成すると、そのファイルから消える（メディア項目が 1 つも無くなるとファイルは書かれず、前の版が残るので手で消す）。pnpm generate domain -- --delete はフォルダごと消す
- core ドメインの domain.json（notification / coupon など）は、手で管理（`generate: false`）の間は `src/features/core/storageObject/purposes/` に手で書く。`generate: true` にすると同じ ID は重複の例外になるので、そちらからは消す。`pnpm test scripts/structure/registry/check-storage-purposes.test.mjs` が、全 domain.json のメディア項目に用途があるかと、手書き（CORE / FORK）の用途の metadata の規則（上の生成エラーと同じ規則、`user.avatar` を keep にしない）を確かめる

### indexes（非ユニーク検索/集計用インデックス）

**Neon (PostgreSQL/Drizzle) 専用機能**。Firestore では利用不可。

検索・集計頻度が高いカラム（WHERE フィルタ、期間絞り込み、JOIN キー等）にインデックスを宣言する場合に使用。`compositeUniques` がユニーク制約を強制するのに対し、`indexes` は**ユニーク制約なしの検索高速化用**。

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
| fields | string[] | 🟢 Yes | インデックス対象カラム（先頭から複合キー）。生成後の `entities/drizzle.ts` に現れるプロパティ名で指定する。業務フィールドは domain.json の `name` そのまま（例: `name_kana`。`nameKana` は存在せず型エラー）、システム列は `createdAt` / `updatedAt` / `deletedAt` |
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

#### compositeUniques との使い分け

| 用途 | フィールド |
|---|---|
| 一意性を強制したい (DB レベルの制約) | `compositeUniques` |
| 検索/集計を高速化したい (ユニーク強制なし) | `indexes` |

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

core ドメイン (`src/features/core/<domain>/domain.json`) も pnpm generate domain が business と同じに扱う（違いはフォルダだけ。`scripts/structure/domain/README.md`）。今ある core の domain.json は `generate: false`（手で管理）なので、`indexes` を追加・変更する場合は以下のいずれかで反映する:

1. **手書きで `entities/drizzle.ts` を直接編集** (推奨、変更が小さい場合)
   - `domain.json` の `indexes` 宣言も同時に更新する (将来の整合性のため)
   - 手書きの形式は generator 出力と完全一致させる
2. **一時的に `generate` を true にして `pnpm generate domain -- <domain> --only entities` で entities だけ書き、false に戻す**（false のままでは名指ししても書かない）
   - 手で直していた entities/ の差分を git diff で確かめ、要る手書きを戻してからコミットする。true の間は生成前の検査が掛かる（落ちれば直してから）

### ApiAccess（汎用 API アクセス制御）

`/api/[domain]/**` の汎用 CRUD ルートに対するロールベースのアクセス制御。
判定は `createDomainRoute`（`src/lib/routeFactory`）が一元的に行う。

> **実行時ソースは serviceRegistry**: domain.json の `apiAccess` は editing source で、
> `pnpm generate domain` が `services/server/domainEntry.ts` のエントリの `access` に展開し（`{ service, access, table, idColumn }`、型必須）、
> `src/registry/serviceRegistry.ts` はそこから生成される。実行時の認可は registry の access を参照する。
> コアドメインは domainEntry.ts に直接 access を書く。管理データ操作（`truncateAll` / `export` / `import`）は
> `operations` に明示したときだけ開く（pnpm generate domain が truncateAll = 管理者、export / import = `useImportExport` から書く）。
> エントリは表の物理名と主キー列名（`table` / `idColumn`、型必須）も持ち、pnpm generate domain が書く（`generate: false` で
> 手書きしている domainEntry.ts は自分で書く。Firestore は `null`）。
> 詳細: `src/lib/routeFactory/README.md`「アクセスポリシー（domainEntry.ts の `access`）」、`src/lib/domain/README.md`

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

`list` `get` `search` `count` `create` `update` `remove` `upsert` `duplicate` `restore` `hardDelete` `reorder` `searchForSorting` `bulkUpsert` `bulkUpdate` `bulkUpdateByIds` `bulkAddRelation` `bulkRemoveRelation` `bulkDeleteByIds` `bulkDeleteByQuery` `replaceByQuery`

管理データ操作（汎用ルートではなく管理画面の専用ルートが評価する。未指定 = `"none"`）: `truncateAll` `export` `import`。domain.json では書かない（pnpm generate domain が `useImportExport` から domainEntry.ts に書く）

#### フォールバック（fail-closed）

- domainEntry.ts の `access` は型必須のため、登録時に宣言を省略できない（書き忘れはコンパイルエラー）
- `read` / `write` / `operations` が当該操作をカバーしない（部分宣言・空 `{}`）場合、既定（`src/lib/domain/accessPresets.ts` の `DEFAULT_ACCESS_RULE`、admin カテゴリのみ。上書きできる設定ではない）が適用される
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

`pnpm ops data export|import|update|delete <domain>` は、上の規則で何かしらのロールに許した操作を許す(export / import は `useImportExport`)。API とコマンドで範囲を変えたい時だけ `"commands": { "delete": "deny", "export": "allow" }` のように書く(`"allow"` / `"deny"`)。`pnpm generate domain` が `domainEntry.ts` の `access.commands` に写す。詳細: `src/lib/domain/README.md`「データ操作のコマンド(pnpm ops data)の許可」

#### ⚠️ オーナーシップ制御は対象外

ロールガードのみで「自分のレコードだけ」という制御はできない。ユーザー所有データ
（wallet, notification 等）の汎用 API は admin 限定にし、ユーザー向けアクセスは
`createMeRoute`（`/api/me/**`）で所有者スコープを強制すること。`"read": "authenticated"` を
設定すると汎用 API では**他ユーザーのレコードも読める**点に注意。
