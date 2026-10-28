# ドメイン生成 CLI（dc:*）

> `src/features/<domain>/domain.json` を元に、ドメイン一式（entities / services / hooks / 管理画面 / レジストリ登録）を生成する CLI のリファレンスです。
> `domain.json` のスキーマ（キー・型・リレーション・generateFiles 等）は [`src/features/README.md`](../../src/features/README.md) が正です。

- 対象: `src/features/` 直下で `domain.json` を持つディレクトリ（ビジネスドメイン）。core ドメイン（`src/features/core/`）は対象外で、手で保守する
- 生成元テンプレート: `src/features/_template/`（ドメイン側）、`src/app/admin/_template/`（管理画面ルート）
- 実行はリポジトリのルートで行う

---

## コマンド

| コマンド | 実体 | 用途 |
|---|---|---|
| `pnpm dc:init` | `index.mjs --init` | 対話で `domain.json` を新規作成し、続けて生成するか確認する |
| `pnpm dc:generate <Domain>` | `index.mjs --generate` | 1 ドメインを生成・再生成する。`<Domain>` 省略時は一覧から選ぶ。`--yes` でプロンプトなし |
| `pnpm dc:generate:all` | `index.mjs --generate --all` | 選んだ複数ドメインを一括で再生成する。`--yes` でプロンプトなし（全ドメイン） |
| `pnpm dc:add <Domain>` | `add-field.mjs` | 既存 `domain.json` の `fields` 末尾に対話でフィールドを足す（生成はしない） |
| `pnpm dc:delete <Domain>` | `index.mjs --delete` | 生成物とレジストリ登録を削除する |
| `pnpm dc:generate:hook` / `:component` / `:service` | `generate-*.mjs` | カテゴリ内のファイルを個別に選んで生成する（複数ドメイン可） |

> **`--` は任意**: pnpm は `pnpm dc:generate -- Sample` の `--` をそのままスクリプトへ渡すが、スクリプト側（`cli/args.mjs`）が単独の `--` を捨てるので `pnpm dc:generate Sample` と同じ動きになる（`dc:add` / `dc:delete` も同じ）。
> `<Domain>` は snake_case / camelCase / PascalCase のどれでもよい（内部で正規化し、`src/features/<camelCase>/` を見る）。
> 失敗（`domain.json` が無い、検査で止まる、テンプレートが無い、登録表が作れないなど）は終了コード 1 になり、**何も書かない**（生成物は全部組み立て、書いた後の状態で `serviceRegistry.ts` が作れることまで確かめてから書く）。
> **フォルダ名 = `singular` の camelCase**（例: `name_pool_entry` → `src/features/namePoolEntry/`）が全ジェネレーターの前提。生成先・import・レジストリ登録・他ドメインからのリレーション import をすべてこの規則で組み立てるため、ずれているドメインがあると `dc:generate` / `dc:generate:all` は何も書かずに終了コード 1 で止まる（`checks/domainFolder.mjs`、`:all` は全件を事前検査）。直すときはフォルダを改名する（`singular` を変えるとテーブル名・FK 名が変わる）。

## 対話なし実行（`--yes`）

エージェント（/flux）や CI から生成するときに使う。

- `pnpm dc:generate <Domain> --yes` … 対話で「domain.json の設定に基づいて生成」を選び、上書き確認に Yes と答えたのと同じ結果になる（同じ分岐を通る）。`<Domain>` が必要で、省略するとエラー終了する
- `pnpm dc:generate:all --yes` … `domain.json` を持つ全ドメインを、それぞれの `generateFiles` で生成する
- 「すべてのファイルを生成」「手動選択」には対応しない。`generateFiles` を false にして手で編集しているファイルを、確認なしで上書きさせないため（必要なら対話で実行する）
- `dc:delete` / `dc:add` には `--yes` は無い（削除の名前入力は安全装置、フィールド追加は入力そのものが目的）
- `.notices` の再生成手順は `pnpm dc:generate <Domain> --yes` と書き、`[user-run]` を付けない。`--dry-run` を足せば書かずに対象だけ確かめられる

## 書かずに確かめる（`--dry-run`）

`pnpm dc:generate <Domain> --yes --dry-run` / `pnpm dc:generate:all --yes --dry-run --only registry` のように付けると、何も書かずに、書くはずのファイルごとの動作を一覧する（上書き確認も出ない）。

- 動作: `作成`（無いファイル）/ `上書き`（内容が変わる）/ `変更なし` / `保持`（write-once で既存を残す）/ `移行`（旧形式の page.tsx を 1 行スイッチへ）/ `スキップ`（レジストリのファイルが無い）。最後に `[dry-run] <domain>: 作成 N / 上書き N / ...` のまとめ
- `serviceRegistry.ts` の作り直しは実行時に行うので一覧には出ない（まとめに注記が付く）
- 使いどころ: `.notices` の再生成手順を実行する前に「この `--only` は何を触るか」を見る、テンプレートを変えた後に影響するドメインを数える

## カテゴリの絞り込み（`--only`）

`pnpm dc:generate <Domain> --only registry` / `pnpm dc:generate:all --yes --only registry,hooks` のように、今回生成するカテゴリ（`generateFiles` のキー）を絞る。

- `generateFiles` を**上書きしない**。true のカテゴリのうち `--only` に含まれるものだけを生成する（false のカテゴリは指定しても生成せず「スキップ」と表示）。どの組み合わせでも、指定なしより多くのファイルは書き換わらない
- 対話モード・`--yes`・`:all` のどれとも併用できる。不明なカテゴリ名は終了コード 1
- `--only registry` が書くのは `services/server/domainEntry.ts`（ドメイン内）と `src/registry/` の schemaRegistry / domainConfigRegistry / adminDataMenu / storagePurposeRegistry（AUTO ブロックだけ）。最後に `pnpm registry:generate` が serviceRegistry.ts を丸ごと作り直す（`dc:generate:all` は全ドメインの domainEntry.ts を書いた後に 1 回だけ。ドメインごとに作り直すと、まだ domainEntry.ts の無い他のドメインで検査が止まるため）
  - storagePurposeRegistry には、画像を含むメディア項目の `metadata`（`storage.metadata`、省略 = `"strip"`）が明示値で入る。strip の項目の accept にサーバーで描き直せない画像の型（`image/heic` など）があると生成エラー（直し方: [src/features/README.md](../../src/features/README.md)「ファイルの保存（storage）」）
  - private の用途の `read.allow` は `storage.read`（`"public"` も可）、無ければ apiAccess の get の規則。visibility を省いた項目の公開・非公開の導出も同じ規則を使う
- domainEntry.ts は毎回 domain.json から書き直す（domain.json の `apiAccess` / `useImportExport` が正。手で変えた access は消える。手で持ちたいなら `generateFiles.registry` を false）。`table` / `idColumn` も書く（表名は表の定義と同じ `domainTableName`、Firestore は `null`）
- `.notices` で再生成が要るときは、必要なカテゴリだけを `--only` で指定する（例: レジストリの書き換え → `pnpm dc:generate:all --yes --only registry`、フックだけ → `--only hooks`）。全カテゴリの再生成が避けられないときは、一時的な git worktree で実行して必要な差分だけを取り込むよう案内する

---

## `dc:init`

質問の順（`cli/init.mjs`、各質問は `questions/`）:

1. ドメイン名（snake_case）・複数形・表示名（`name.mjs`）
2. DB（Neon / Firestore）と ID の種類（`basics.mjs`）
3. リレーション（`relations.mjs`）
4. `createdAt` / `updatedAt` / ソフトデリートの有無（`base-fields.mjs`）
5. name フィールドの有無・必須（`name-field.mjs`）
6. フィールド定義（`fields/`。型ごとの入力種別は `spec/formInputs.mjs`。mediaUploader 系は `fields/media.mjs` がファイル種別・最大サイズも聞き、`storage.visibility` と `storage.metadata`（画像は既定で位置情報などを消す。原本を残すなら `"keep"`）の書き方を案内する）
   - 型の選択肢は `spec/formInputs.mjs` のキー順。複数のメディアは主の集まり `mediaCollection`（Neon のみ）。旧来の fieldType `mediaUploaderMulti`（1 列の text[]）は廃止したので選択肢に無い
   - `mediaCollection` を選ぶと `fields/collection.mjs` の問いに切り替わり、入力種別・ファイルの条件・選択肢・デフォルト値は聞かない（ファイルの条件は従属ドメインのメディア項目に書く）。従属のドメイン名（既定を提案、snake_case、空なら既定）→ 必須 → 最大件数（既定 10）→ 並べ替え（既定 true）→ 複製で写すか（必須なら聞かずに true）の順で、`{ name, label, fieldType: "mediaCollection", formInput: "mediaUploaderMulti", required, reorderable, collection: { domain, maxItems, duplicate } }` を書く。従属の domain.json は `dc:generate` が書き出す
   - 従属のドメイン名の既定（`spec/collectionField.mjs` の `defaultChildName`）: 項目名が s で終われば `<主の singular>_<項目名から末尾の s を 1 つ外したもの>`（plural = `<主の singular>_<項目名>`）、それ以外は `<主の singular>_<項目名>`（plural は推定）。例: sample + images → sample_image / sample_images、sample + gallery → sample_gallery
7. 複合ユニーク（`composite-uniques.mjs`）
8. 一覧・管理画面の設定: 検索対象、並び順、表示列、詳細モーダル、複製ボタン、インポート/エクスポート、データ管理メニュー追加、オートセーブ（`view-config.mjs`）
9. 汎用 API の読み取り / 書き込みの公開範囲（`api-access.mjs` → `apiAccess`）
10. 生成カテゴリ（`generate-files.mjs` → `generateFiles`）

`src/features/<camelCase>/domain.json` を書き出したあと「今すぐファイルを生成しますか?」（既定 Yes）で `dc:generate` に進む。

## `dc:generate <Domain>`

1. 生成方法を選ぶ（`cli/generate.mjs`）
   - `domain.json の設定に基づいて生成`（既定）… `generateFiles` で true のカテゴリだけ
   - `生成カテゴリを手動で選択` … 今回だけカテゴリを選ぶ。選択を `domain.json` に保存するかも聞かれる
   - `すべてのファイルを生成` … 全カテゴリ
2. 「既存の関係ファイルはすべて上書きされます。生成を実行しますか？」で Yes
3. 生成（`pipeline/generate.mjs`）: 読む → 検査 → 全カテゴリの生成物を組み立てる（主の集まりの項目 `mediaCollection` があれば、従属の domain.json を無いときだけ書き出す Output も足す。`render/collections/`。雛形の形と権限の写し: [src/features/README.md](../../src/features/README.md)「主の集まりの項目（mediaCollection）」）
   - 主と従属の組（`pipeline/pairs.mjs`）: 生成の前に全 domain.json から「集まりの項目 → 従属、従属 → 所有する主」を一度だけ解く。主・従属のどちらを指定しても組の全員を「従属 → 主」の順に生成する（この実行で書き出す従属は、書き出す中身でそのまま生成する）。指定したドメインの生成方法の選択はそのドメインだけに効き、組の他の員は自分の `generateFiles`（`--only` で絞る）
   - 組の誤りは、生成方法の選択より前・何も書く前に全件を並べて止まる（`--yes` でも同じ）。1 ドメインの生成では、指定したドメインの組に関わる誤りだけを見る。道具は domain.json を書き換えず、直す場所を出す。組を解く段（`pipeline/pairs.mjs`）が見るもの: 集まりの項目に `collection.domain` が無い・1 つの従属を 2 つ以上の主が宣言。組ごとの検査（`checks/pairs.mjs`。従属はこの実行で書き出すなら書き出す中身で見る）:
     - 主の集まりの項目にファイルの条件（slug・accept・mediaTypePreset・validationRule・storage）がある（従属の `file` に書く）
     - 従属の主への belongsTo が 1 本でない・required でない・onDelete が CASCADE でない / 従属が `useSoftDelete: true`
     - 従属のメディア項目（mediaUploader）がちょうど 1 つでない・mediaCollection を持つ
     - 並び列（主の項目が reorderable のとき）: `sortOrderField` が無い・その項目が無い・`systemColumns` に無い
     - 主から埋められない必須の項目（主への参照・メディア・並び以外で required かつ defaultValue なし）
     - 権限: 従属の `file` の upload が主の create・update の和より狭い / read が主の get より狭い（従属が public なら見ない）。主の規則が写せない形（none・知らない値・`generateFiles.registry: false`）なら見ない。広さは public ⊇ authenticated ⊇ ロールの規則 ⊇ none、ロールは role.json のカテゴリに解いて比べる（`checks/accessRules.mjs`）
     - 63 字: 従属の表名、主への FK の短い名前も超えるとき / 名前の衝突: 従属の singular・表名が他のドメインと重なる、主の集まりの項目名が主の他の項目・関係の fieldName と重なる
     - required の集まりに `collection.duplicate: false`
     - 知らせるだけ（止めない）: 従属の upload が主より広い、従属の汎用 API（apiAccess）が開いている
   - 組では全員の生成物を組み立ててから登録表の事前検査をまとめて行い、`serviceRegistry.ts` の作り直しは最後に 1 回。最後に 3 行の一覧を出す: 書き出した domain.json / `db:push` が要る表（この実行で新しく書き出した従属の表だけ）/ コミットに含めるもの（書き出した従属のフォルダと、登録表を生成したなら `src/registry/`）。`--dry-run` では「書き出す予定」として同じ一覧。組に関わらない生成では出さない → 書いた後の状態で `serviceRegistry.ts` が作れるか確かめる → 書く → `serviceRegistry.ts` を作り直す。登録表が作れない状態（手書きの行が残っている、他のドメインに `domainEntry.ts` が無い）なら何も書かずに止まる

## `dc:generate:all`

ドメインを複数選び（既定は全件）、各 `domain.json` の `generateFiles` で生成する。選んだドメインの組の全員（この実行で書き出す従属・選んだ従属の主）を加え、従属を所有する主の直前に並べる（それ以外の順は変えない）。組の前提の誤りは、どのドメインのものでも何も書く前に止まる。組が関わるときは最後に 1 ドメインと同じ一覧を出す。途中で「ファイル種別を手動で選択しますか？」に Yes と答えると、選んだカテゴリを全ドメインに適用する（`domain.json` には保存しない）。テンプレートを変えたあとの一括反映に使う。全ドメインの生成物を先に組み立て、登録表が作れることを確かめてから書き始めるので、途中のドメインで止まって半端に残ることはない。

## `dc:add <Domain>`

`dc:init` のフィールド質問（主の集まり `mediaCollection` の問いを含む）だけを走らせ、既存の `fields` の末尾に追記する。ファイルは生成しないので、続けて `dc:generate` を実行する。

## `dc:delete <Domain>`

0. 主と従属の組（主の集まりの項目 `mediaCollection` → 従属）を壊す削除は、何も聞かずにエラーで止まり、何も消さない（`pipeline/remove/pairStop.mjs`。`--force` は無い）
   - 主: domain.json が残っている従属があれば止まる。消す順 = 主の集まりの項目を外す → 従属を `dc:delete` → 主を `dc:delete`
   - 従属: 主が集まりの項目を宣言している間は止まる（残すと次の `dc:generate` で雛形がまた書き出される）。先に主の項目を外す
   - 集まりでない belongsTo で指されているだけなら止めない
1. 確認のためドメイン名（snake_case）を入力する。一致しなければ中止
2. `src/app/` 配下で名前が一致する追加ディレクトリがあれば、削除するものを選ぶ
3. `domain.json` も消すか選ぶ（既定 No = `domain.json` だけ残してドメインディレクトリの中身を消す）
4. 削除対象の一覧を確認して実行

削除するもの: `src/features/<domain>/`（`domainEntry.ts` ごと）、`src/app/admin/(protected)/<domains>/`（`_components/` 含むルートごと）、選んだ追加ディレクトリ。レジストリからは `adminDataMenu.ts` / `schemaRegistry.ts` / `domainConfigRegistry.ts` の該当行を消し、`serviceRegistry.ts` は残った domainEntry.ts から `pnpm registry:generate` で作り直す。DB のテーブルは消さない。

- `domainConfigMap` のエントリは、オブジェクト直下のキーが完全一致するものだけを複数行ごと消す（`text/objectEntry.mjs` の `removeObjectEntry`。`tag` を消しても core の `user_tag` は残る）。キーは実在したドメインディレクトリ名から決める
- レジストリの更新に失敗してもディレクトリ削除は済んでいるため止めず、最後に手で直すファイルを表示して終了コード 1 で終わる

---

## 生成されるもの

`generateFiles` のカテゴリと出力先（`<domain>` = camelCase 単数、`<domains>` = kebab-case 複数）。生成器は `render/<カテゴリ>/`。

| カテゴリ | 出力 |
|---|---|
| `entities` | `entities/{model,form,schema,index}.ts` + `drizzle.ts`（Firestore なら `firestore.ts`）。主の集まりの項目（mediaCollection）は列を出さず、スキーマ = `z.array(storageMediaValueSchema)`（required → `.min(1)`、`collection.maxItems` → `.max`）、モデル = `string[]`（省略可）。主は表の定義の後に `defineTableCollections(<Domain>Table, () => import(…/collections))` を出す（他ドメインの withRelations の埋め込みにも集まりを載せるための表の登録） |
| `components` | `components/Admin<Domain>{Create,Edit,List}/`、`components/common/{Create<Domain>Form,Edit<Domain>Form,<Domain>Form,<Domain>Fields}.tsx`。`useDetailModal` で `<Domain>DetailModal.tsx`、`sortOrderField` で `Admin<Domain>Sort/`（一覧は `render/components/catalog.mjs`）。`<Domain>Fields` は主の集まりの項目に、従属の `file` の用途（`<従属>.file`）・accept・上限サイズと集まりの件数（maxItems / required → minItems 1）を載せる（従属の domain.json から。この実行で書き出す従属は書き出す中身） |
| `hooks` | `hooks/use*<Domain>.ts`（どれが生成されるかは `render/hooks/catalog.mjs`、使い方は [`src/lib/crud/hooks/README.md`](../../src/lib/crud/hooks/README.md)） |
| `clientServices` | `services/client/<domain>Client.ts` |
| `serverServices` | `services/server/drizzleBase.ts`（Firestore なら `firestoreBase.ts`）、`services/server/<domain>Service.ts`（無いときだけ）、`wrappers/`（無ければ作成）。メディア列（mediaUploader）があれば drizzleBase に `storage: storageBindingFor("<domain>", [{ name, purpose: "<domain>.<field>", multi: false }])`（ファイル台帳との連動。複製・物理削除のファイル処理もここ。[src/lib/crud/README.md](../../src/lib/crud/README.md)「storage オプション」）。Firestore ドメインのメディア列は生成エラー。主の集まりの項目（mediaCollection）があれば drizzleBase が `import { collections } from "./collections"` して options に `collections` を渡す（集まりの無いドメインの drizzleBase は変わらない）。`serverServices: false`（drizzleBase.ts が手書き）の主には、この 2 行を足すよう生成のたびに案内する |
| `fieldConstants` | `constants/field.ts` と `types/field.ts`（`options` を持つフィールドがあるときだけ） |
| `adminRoutes` | `src/app/admin/(protected)/<domains>/` の一覧・`new/`・`[id]/edit/`（`sortOrderField` で `sort/`） |
| `registry` | `services/server/domainEntry.ts`（`apiAccess` / `useImportExport` を `access` に展開し、`table` / `idColumn` を書く。`src/registry/serviceRegistry.ts` はここから `registry:generate` が生成）、`src/registry/` の `domainConfigRegistry.ts` / `schemaRegistry.ts`（Firestore は登録しない）。`addToAdminDataMenu` なら `adminDataMenu.ts`。メディア列があれば `storagePurposeRegistry.ts` の AUTO ブロック。主の集まりの項目（mediaCollection）があれば `services/server/collections.ts`（毎回上書き。createCrudService の `collections` の宣言 = 従属のサービス・主への参照列・値の列・並び列・件数・複製。従属の domain.json から） |
| `presenters` | `presenters.ts`（ドメイン直下。一覧・詳細表示のフォーマッタ。メディア列は `formatMediaThumbnail(s)` で ref を表示用 URL に解決） |

### 上書きの扱い

| 扱い | 対象 |
|---|---|
| 毎回上書き（編集しない） | 上表のうち、そのカテゴリが有効なときのファイル全部（`<domain>Service.ts` を除く）。`drizzleBase.ts`・`presenters.ts`・`constants/field.ts`・`<Domain>Fields.tsx` も含む |
| 初回だけ生成（write-once） | 管理画面ルートの `page.tsx`（1 行スイッチ）。既存なら保持し、旧形式（本体を直接持つ）なら一度だけスイッチ形へ移行する |
| 初回だけ生成（write-once） | `services/server/<domain>Service.ts`（`base` にラッパー・独自処理を組み込む手書きの場所）。`serverServices` が有効でも既存なら触らない（`drizzleBase.ts` は毎回作り直す）。既存ファイルが旧 `wrappers/duplicate`（旧ファイル複製）を組み込んでいれば、外すよう警告する（複製は binding が行い、旧ラッパーが複製した旧 URL は binding に拒否される）。`dc:generate:service` で `xxxService.ts` を明示的に選んだときだけ上書きする。テスト: `pnpm test:dc-server-service` |
| 毎回再生成 | 管理画面ルートの `_screen/Admin<Domain>{List,Create,Edit,Sort}Screen.tsx` |
| 触らない（fork 所有） | 管理画面ルートの `_components/`、`wrappers/` に自分で置いたファイル、`hooks/` に自分で置いた生成名と異なるファイル |
| 未登録なら追記 | `src/registry/` の schemaRegistry / domainConfigRegistry / adminDataMenu / storagePurposeRegistry（引用符・空白違いの既存行も登録済みとみなす） |
| 毎回上書き（生成物） | `services/server/domainEntry.ts`（domain.json の `apiAccess`（無ければ fail-closed = `...ADMIN_ONLY`、初回は警告）と `useImportExport`（偽なら `export` / `import` を `"none"`）から書く。read / write がプリセットと一致すれば `...PUBLIC_READ` のように spread で、一致しなければリテラルで書く。`table` = `domain/names.mjs` の `domainTableName`（表の定義の生成器 `render/entities/drizzle/` と共有。`plural`、無ければドメイン名の snake_case）、`idColumn` = `"id"`、dbEngine が Firestore なら両方 `null`）。`src/registry/serviceRegistry.ts`（全 domainEntry.ts から `pnpm registry:generate` が丸ごと生成。dc:generate の最後に自動で走り、手書き行が残っていれば失敗して移し先を出す。`scripts/registry/serviceRegistry/`、仕組みは `src/lib/domain/README.md`） |

管理画面ルートの構造（`page.tsx` / `_screen/` / 共有 loader）は [`src/lib/screens/README.md`](../../src/lib/screens/README.md) §12。

### 生成物を変えたいとき（生成ファイルは編集しない）

- **項目・選択肢・表示列など** → `domain.json` を直して再生成する（`fieldGroups` などもここ）
- **フォームに独自項目・差し込み UI** → 生成された `<Domain>Form` / `<Domain>Fields` は FieldRenderer の props（`fieldPatches` / `insertBefore` / `insertAfter` / `fieldGroups` / `beforeField` 等）を受け取る。fork 所有の `_components/` に置いたフォーム・画面から渡す（[`src/components/Form/FieldRenderer/README.md`](../../src/components/Form/FieldRenderer/README.md)）。MediaUploader の commit/reset は `<Domain>Form` の `onMediaStateChange` で受ける
- **管理画面のレイアウト** → `_screen/` を同じルートの `_components/` にコピーして `page.tsx` を向ける（以後の再生成は `_screen/` だけを更新する）
- **CRUD の振る舞い** → `services/server/wrappers/` に置き、write-once の `<domain>Service.ts` で組み込む
- 手を入れたカテゴリを再生成から外したいときは `domain.json` の `generateFiles` でそのカテゴリを false にする

---

## 典型的な流れ

新規ドメイン:

1. `pnpm dc:init` → 質問に答え、そのまま生成
2. `git status` / `git diff` で生成物を確認
3. Neon ドメインはテーブル作成のため `pnpm db:push`（index を足したら `pnpm db:push:check` で差分ゼロを確認。CLAUDE.md DOMAINS push_roundtrip）

フィールド追加:

1. `pnpm dc:add <Domain>`（または `domain.json` を直接編集）
2. `pnpm dc:generate <Domain>` → 通常は `domain.json の設定に基づいて生成`
3. 差分を確認し、Neon なら `pnpm db:push`

テンプレート（`_template/`）や生成器を変えたとき: `pnpm dc:generate:all --yes` で全ドメインへ反映し、差分を確認してサンプルの再生成結果も一緒にコミットする。

## よくある失敗

- `[domain.json] <domain>: ...` の警告が出る → 綴り違いのキー、古いキー（`version` → `domainConfigVersion`、`onDeleteCascade` → `onDelete`）、その DB に無い `fieldType`、知らない `formInput`、主の集まりの項目の `collection` の下位キー（`domain` / `maxItems` / `duplicate`）の型を `checks/vocabulary.mjs` が [src/features/README.md](../../src/features/README.md) の語彙（`spec/domainJson.mjs`）と照らして出す。生成は止まらないが、未知の `fieldType` は列名としてそのまま出力され、未知の `formInput` はフォームに出ないので直す
- `domain.json` が壊れている（JSON として読めない） → 直してから再実行
- `テンプレートのトークンが置換されていません` → 管理画面テンプレートに未対応のトークンが残っている。テンプレートを直す
- MediaUploader の追加質問が出ない → フォーム入力の種類を `mediaUploader` にしたフィールドでだけ出る（集まりのファイルの条件は従属ドメインのメディア項目で聞く）

---

## 生成器の構造（直す人向け）

生成は 1 本の流れで、層ごとに責務が分かれている。**render/ はファイルに触らず、書き込む内容（Output）を返す**。pipeline が全カテゴリの Output を集めてから書くので、途中の検査で止まっても書きかけが残らない。

```
cli/ → pipeline/ → render/ → domain/ → spec/          （依存は左から右への一方向）
```

| 層 | 役目 | 置いてよいもの |
|---|---|---|
| `index.mjs` `add-field.mjs` `generate-*.mjs` | `pnpm dc:*` の入口（package.json が指す。中身は 1 行） | |
| `cli/` | 引数の解釈（`args.mjs`）、対話（`prompts.mjs`、`init` / `generate` / `generateAll` / `delete` / `addField`、`pick/` = 個別選択）、`process.exit` | inquirer、process.exit、domain.json の書き出し |
| `questions/` | `dc:init` / `dc:add` の質問。`fields/` は 1 項目の質問（`media.mjs` / `options.mjs` / `defaultValue.mjs`） | inquirer |
| `pipeline/` | `generate.mjs`（1 ドメイン: 読む → 検査 → plan → 登録表の事前検査 → apply → serviceRegistry。組なら `generateWithPairs` が組の全員を従属 → 主で）、`pairs.mjs`（主と従属の組の解決・誤りの検査・並び・最後の一覧）、`serviceRegistry.mjs`（書く前の検査 = これから書くファイルを重ねた見え方で scripts/registry の検査を呼ぶ）、`generateAll.mjs`、`plan.mjs`（カテゴリ順に render を呼ぶ）、`apply.mjs`（**唯一の書き込み点**。write-once / 旧形式の移行 / 変更なし / レジストリの部分書き換え）、`dryRun.mjs`（apply と同じ判定を読むだけで行い一覧する）、`remove/`（dc:delete の本体） | fs（apply / remove が書く、dryRun は読むだけ） |
| `render/<カテゴリ>/` | 生成物の文字列を組む純関数（`render/collections/` だけはカテゴリではなく、主の集まりの項目から従属の domain.json を組む。`--only` に関わらず plan の先頭に入る）。`(ctx, workspace) → Output[]`（`output.mjs`: `file` / `writeOnce` / `dir` / `patch` / `log`）。`tokens.mjs` = `__domain__` 系の置換 | 読み取りは workspace 経由のみ |
| `checks/` | 生成前の検査（フォルダ名、廃止した型、Firestore のメディア列）。エラー文か null を返す。`pairs.mjs` = 主と従属の組の書く前の検査（誤りを全件返す）、`accessRules.mjs` = アクセスルールの広さの比べ方 | |
| `domain/` | `workspace.mjs`（rootDir からのパスと読み取り。**fs を読むのはここだけ**）、`context.mjs`（DomainContext = 名前の全形 + domain.json。名前の導出はここだけ）、`names.mjs`（表名・FK 名・63 字）、`relations.mjs`、`fieldName.mjs`、`roles.mjs` | |
| `spec/` | domain.json の語彙: `categories.mjs`（generateFiles のキー）、`fieldTypes.mjs`（項目種別の述語。列を持たない主の集まりの型 `mediaCollection` = `isCollectionFieldType`）、`domainJson.mjs`（キーの集合。`collection` の下位キー = `COLLECTION_KEYS`）、`collectionField.mjs`（主の集まりの項目の純関数: 従属の既定の名前・項目の組み立て・型の選択肢の並び）、`formInputs.mjs`、`format.mjs`（整形）、`version.mjs` | 定数と純関数のみ |
| `text/` | TS ソースの部分編集（`objectEntry.mjs`。scripts/registry も使う） | |
| `tests/` | 全テスト（`structure.test.mjs` が下の規則を機械で検査する） | |

規則（`pnpm test:dc-structure`）: 1 ファイル 200 行以内（テスト 320）| `spec/` `domain/`（workspace 以外）`checks/` `render/` `text/` は fs・child_process・inquirer・process.exit を使わない | fs は `domain/workspace.mjs` `pipeline/apply.mjs` `pipeline/dryRun.mjs` `pipeline/remove/` `cli/` だけ | inquirer は `cli/` と `questions/` だけ、process.exit は `cli/` だけ | `render/` は `pipeline/` `cli/` を import しない。

よくある変更の置き場:

- **項目の種類を足す**（例: 新しい fieldType） → `spec/fieldTypes.mjs` に述語、`spec/formInputs.mjs` に入力種別、`questions/fields/` に質問（メディア系なら `media.mjs` の隣に）、各 `render/` は述語で分岐。フォーム側の手書き（`src/components/Form/FieldRenderer/defaultValueBuilder.ts` の既定値、`Field/Configured/checkGroupFieldTypes.ts`、`Field/types.ts` の型の名前）も足す（ずれは `pnpm test:form-defaults` と typecheck が検知する）
- **生成ファイルを足す** → そのカテゴリの `render/<カテゴリ>/` に `(ctx, workspace) → Output` を足し、カテゴリの `index.mjs` の配列に並べる（hooks / components は `catalog.mjs` に 1 行）。別のドメインの `domain.json` を書く場合も `writeOnce` の Output にする
- **生成前の検査を足す** → `checks/` に「エラー文か null」を返す関数を足し、`checks/index.mjs` に並べる。生成の途中でしか分からない検査は render 内で例外を投げる（書く前なので書きかけは残らない）
- **drizzleBase に配線を足す** → `render/serverServices/`（テンプレートのトークンに差し込む）か、別ファイルとして `Output` を 1 つ足す。どちらも `index.mjs` の `outputs` に並べるだけ
- **複数ドメインの生成順** → `pipeline/generateAll.mjs`（対象の並び）と `domain/`（全 domain.json を読む関数は `workspace.listDomains` + `readConfig`）

テスト: `pnpm test:dc-structure` `test:dc-registry` `test:dc-domain-folder` `test:dc-only` `test:dc-server-service` `test:dc-drizzle-indexes` `test:dc-storage-output` `test:dc-sample-drift` `test:dc-collection-field` `test:dc-child-domain` `test:dc-pair-generate` `test:dc-pair-checks` `test:dc-delete-stop` `test:dc-parent-outputs`（`tests/`。生成器は関数なので一時ディレクトリに domain.json を置いて直接呼ぶ）。

### 前後比較（`pnpm dc:parity <git-ref>`）

生成器を変えたら、変える前のコミットの生成器と作業ツリーの生成器を**同じ fixture に流して**、生成物・終了コード・出力行が同じかを見る（`tests/parity.mjs`）。「生成物を変えないつもりの変更」はこれが空になるまで直す。生成物を変える変更では、差分が意図したものだけかを目で確かめる。

- fixture: `samples`（このリポの src/ そのまま）、`synthetic` / `synthetic-bad`（`tests/fixtures/parity/<name>/<domain>/domain.json`。Firestore・hiddenColumns・63 字超の FK・空スキーマ・入れ子リレーション・メディア列・旧形式のキーと、検査で止まる失敗系。主の集まりの項目の組 = `showcase`（生成の drizzleBase）と `atelier`（`serverServices: false` の主 = 手書きの drizzleBase への案内））。`--repo <path>` で fork のリポを足せる（`src/features/*/domain.json` を重ねる。`existing` は domain フォルダ・管理画面ルート・registry も写して write-once の経路を通す）
- mode: `each`（1 ドメインずつ `--yes`）、`all`、`all2`（2 回 = 冪等性）、`only-registry`、`only-entities-hooks`。`--modes` / `--variants` / `--fixtures` で絞る、`--keep` で作業ディレクトリを残す
- 失敗系は両版が同じ exit code・同じエラー文で止まることを見る。差分の詳細は FAIL 行の report（JSON）に出る
- 対話の経路（`dc:init` / `dc:add` / `dc:delete` / 生成方法の選択）は対象外。質問の順や文言を変えたときは手で確かめる
- 新しい形の domain.json（新しい fieldType、リレーションの組み合わせ）を生成器が受けるようになったら、`tests/fixtures/parity/synthetic/` にその例を 1 つ足す

サンプルの陳腐化検査: `pnpm test:dc-sample-drift` は `sample` / `sampleCategory` / `sampleTag` / `sampleImage` を一時ディレクトリへ複製したうえで再生成し、コミット済みの生成物と 1 バイトでも違えば落ちる（作業ツリーは書き換えない）。fork が手本にするサンプルを、テンプレートの変更に追従させるための検査。サンプルの複数メディア: `sample.images` = 主の集まりの項目（mediaCollection）の例で、従属 `sampleImage`（`dc:generate` が書き出した domain.json と生成物、`sample/services/server/collections.ts`）を持つ。生成物（`serviceRegistry.ts` の `AUTO-GENERATED` ブロックを含む）を手で整形すると落ちる。存在しないサンプルドメインは対象から外し、全部無ければスキップする（サンプルを消した fork では何もしない）。
