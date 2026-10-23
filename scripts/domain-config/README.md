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

> **`--` は任意**: pnpm は `pnpm dc:generate -- Sample` の `--` をそのままスクリプトへ渡すが、スクリプト側（`utils/cliArgs.mjs`）が単独の `--` を捨てるので `pnpm dc:generate Sample` と同じ動きになる（`dc:add` / `dc:delete` も同じ）。
> `<Domain>` は snake_case / camelCase / PascalCase のどれでもよい（内部で正規化し、`src/features/<camelCase>/` を見る）。
> 失敗（`domain.json` が無い、個別ジェネレーターの異常終了など）は終了コード 1 になる。
> **フォルダ名 = `singular` の camelCase**（例: `name_pool_entry` → `src/features/namePoolEntry/`）が全ジェネレーターの前提。生成先・import・レジストリ登録・他ドメインからのリレーション import をすべてこの規則で組み立てるため、ずれているドメインがあると `dc:generate` / `dc:generate:all` は何も書かずに終了コード 1 で止まる（`utils/domainFolder.mjs`、`:all` は全件を事前検査）。直すときはフォルダを改名する（`singular` を変えるとテーブル名・FK 名が変わる）。

## 対話なし実行（`--yes`）

エージェント（/flux）や CI から生成するときに使う。

- `pnpm dc:generate <Domain> --yes` … 対話で「domain.json の設定に基づいて生成」を選び、上書き確認に Yes と答えたのと同じ結果になる（同じ分岐を通る）。`<Domain>` が必要で、省略するとエラー終了する
- `pnpm dc:generate:all --yes` … `domain.json` を持つ全ドメインを、それぞれの `generateFiles` で生成する
- 「すべてのファイルを生成」「手動選択」には対応しない。`generateFiles` を false にして手で編集しているファイルを、確認なしで上書きさせないため（必要なら対話で実行する）
- `dc:delete` / `dc:add` には `--yes` は無い（削除の名前入力は安全装置、フィールド追加は入力そのものが目的）
- `.notices` の再生成手順は `pnpm dc:generate <Domain> --yes` と書き、`[user-run]` を付けない

## カテゴリの絞り込み（`--only`）

`pnpm dc:generate <Domain> --only registry` / `pnpm dc:generate:all --yes --only registry,hooks` のように、今回生成するカテゴリ（`generateFiles` のキー）を絞る。

- `generateFiles` を**上書きしない**。true のカテゴリのうち `--only` に含まれるものだけを生成する（false のカテゴリは指定しても生成せず「スキップ」と表示）。どの組み合わせでも、指定なしより多くのファイルは書き換わらない
- 対話モード・`--yes`・`:all` のどれとも併用できる。不明なカテゴリ名は終了コード 1
- `--only registry` が書くのは `src/registry/` の serviceRegistry / schemaRegistry / domainConfigRegistry / adminDataMenu / storagePurposeRegistry（AUTO ブロックだけ）
- serviceRegistry の再生成で既存エントリの access の値（書き方ではなく中身）が変わるときは、変更前後を警告に出す（書き換えは止めない。domain.json の `apiAccess` が正）。fork 独自の定数など評価できない式は「比較できません」として警告する
- `.notices` で再生成が要るときは、必要なカテゴリだけを `--only` で指定する（例: レジストリの書き換え → `pnpm dc:generate:all --yes --only registry`）。全カテゴリの再生成が避けられないときは、一時的な git worktree で実行して必要な差分だけを取り込むよう案内する

---

## `dc:init`

質問の順（`init.mjs`、各質問は `questions/`）:

1. ドメイン名（snake_case）・複数形・表示名（`name.mjs`）
2. DB（Neon / Firestore）と ID の種類（`basics.mjs`）
3. リレーション（`relations.mjs`）
4. `createdAt` / `updatedAt` / ソフトデリートの有無（`base-fields.mjs`）
5. name フィールドの有無・必須（`name-field.mjs`）
6. フィールド定義（`fields.mjs`。mediaUploader 系は保存パス・ファイル種別・最大サイズも聞く）
7. 複合ユニーク（`composite-uniques.mjs`）
8. 一覧・管理画面の設定: 検索対象、並び順、表示列、詳細モーダル、複製ボタン、インポート/エクスポート、データ管理メニュー追加、オートセーブ（`view-config.mjs`）
9. 汎用 API の読み取り / 書き込みの公開範囲（`api-access.mjs` → `apiAccess`）
10. 生成カテゴリ（`generate-files.mjs` → `generateFiles`）

`src/features/<camelCase>/domain.json` を書き出したあと「今すぐファイルを生成しますか?」（既定 Yes）で `dc:generate` に進む。

## `dc:generate <Domain>`

1. 生成方法を選ぶ（`generate.mjs`）
   - `domain.json の設定に基づいて生成`（既定）… `generateFiles` で true のカテゴリだけ
   - `生成カテゴリを手動で選択` … 今回だけカテゴリを選ぶ。選択を `domain.json` に保存するかも聞かれる
   - `すべてのファイルを生成` … 全カテゴリ
2. 「既存の関係ファイルはすべて上書きされます。生成を実行しますか？」で Yes
3. カテゴリごとのジェネレーター（`generator/`）が順に走る

## `dc:generate:all`

ドメインを複数選び（既定は全件）、各 `domain.json` の `generateFiles` で生成する。途中で「ファイル種別を手動で選択しますか？」に Yes と答えると、選んだカテゴリを全ドメインに適用する（`domain.json` には保存しない）。テンプレートを変えたあとの一括反映に使う。

## `dc:add <Domain>`

`dc:init` のフィールド質問だけを走らせ、既存の `fields` の末尾に追記する。ファイルは生成しないので、続けて `dc:generate` を実行する。

## `dc:delete <Domain>`

1. 確認のためドメイン名（snake_case）を入力する。一致しなければ中止
2. `src/app/` 配下で名前が一致する追加ディレクトリがあれば、削除するものを選ぶ
3. `domain.json` も消すか選ぶ（既定 No = `domain.json` だけ残してドメインディレクトリの中身を消す）
4. 削除対象の一覧を確認して実行

削除するもの: `src/features/<domain>/`、`src/app/admin/(protected)/<domains>/`（`_components/` 含むルートごと）、選んだ追加ディレクトリ。レジストリからは `adminDataMenu.ts` / `schemaRegistry.ts` / `serviceRegistry.ts` / `domainConfigRegistry.ts` の該当行を消す。DB のテーブルは消さない。

- `serviceRegistry` / `domainConfigMap` のエントリは、オブジェクト直下のキーが完全一致するものだけを複数行ごと消す（`removeObjectEntry`。`tag` を消しても core の `user_tag` は残る）。キーは実在したドメインディレクトリ名から決める。消した後、`serviceRegistry.ts` のプリセット import を dc:generate と同じく使用中の名前に揃える
- レジストリの更新に失敗してもディレクトリ削除は済んでいるため止めず、最後に手で直すファイルを表示して終了コード 1 で終わる

---

## 生成されるもの

`generateFiles` のカテゴリと出力先（`<domain>` = camelCase 単数、`<domains>` = kebab-case 複数）。

| カテゴリ | 出力 |
|---|---|
| `entities` | `entities/{model,form,schema,index}.ts` + `drizzle.ts`（Firestore なら `firestore.ts`） |
| `components` | `components/Admin<Domain>{Create,Edit,List}/`、`components/common/{Create<Domain>Form,Edit<Domain>Form,<Domain>Form,<Domain>Fields}.tsx`。`useDetailModal` で `<Domain>DetailModal.tsx`、`sortOrderField` で `Admin<Domain>Sort/` |
| `hooks` | `hooks/use*<Domain>.ts`（どれが生成されるかは [`src/lib/crud/hooks/README.md`](../../src/lib/crud/hooks/README.md)） |
| `clientServices` | `services/client/<domain>Client.ts` |
| `serverServices` | `services/server/drizzleBase.ts`（Firestore なら `firestoreBase.ts`）、`services/server/<domain>Service.ts`（無いときだけ）、`wrappers/`（無ければ作成）。mediaUploader フィールドがあれば `wrappers/duplicate.ts` |
| `fieldConstants` | `constants/field.ts` と `types/field.ts`（`options` を持つフィールドがあるときだけ） |
| `adminRoutes` | `src/app/admin/(protected)/<domains>/` の一覧・`new/`・`[id]/edit/`（`sortOrderField` で `sort/`） |
| `registry` | `src/registry/` の `domainConfigRegistry.ts` / `serviceRegistry.ts`（`apiAccess` を `access` に展開）/ `schemaRegistry.ts`（Firestore は登録しない）。`addToAdminDataMenu` なら `adminDataMenu.ts` |
| `presenters` | `presenters.ts`（ドメイン直下。一覧・詳細表示のフォーマッタ） |

### 上書きの扱い

| 扱い | 対象 |
|---|---|
| 毎回上書き（編集しない） | 上表のうち、そのカテゴリが有効なときのファイル全部（`<domain>Service.ts` を除く）。`drizzleBase.ts`・`presenters.ts`・`constants/field.ts`・`<Domain>Fields.tsx` も含む |
| 初回だけ生成（write-once） | 管理画面ルートの `page.tsx`（1 行スイッチ）。既存なら保持し、旧形式（本体を直接持つ）なら一度だけスイッチ形へ移行する |
| 初回だけ生成（write-once） | `services/server/<domain>Service.ts`（`base` にラッパー・独自処理を組み込む手書きの場所）。`serverServices` が有効でも既存なら触らない（`drizzleBase.ts` は毎回作り直す）。mediaUploader フィールドがあるのに既存ファイルが `wrappers/duplicate` を組み込んでいなければ警告する。`dc:generate:service` で `xxxService.ts` を明示的に選んだときだけ上書きする。テスト: `pnpm test:dc-server-service` |
| 毎回再生成 | 管理画面ルートの `_screen/Admin<Domain>{List,Create,Edit,Sort}Screen.tsx` |
| 触らない（fork 所有） | 管理画面ルートの `_components/`、`wrappers/` に自分で置いたファイル、`hooks/` に自分で置いた生成名と異なるファイル |
| 未登録なら追記 | `src/registry/` の各ファイル（引用符・空白違いの既存行も登録済みとみなす）。ただし `serviceRegistry.ts` の該当ドメインのエントリは毎回 `apiAccess` から 1 行で書き直す（手で変えた `access` や複数行の整形は消える。`apiAccess` がプリセット（`ADMIN_ONLY` / `PUBLIC_READ` / `ADMIN_OR_DEBUGGER`）と一致すればプリセット名、一致しなければ JSON リテラルで書く。`apiAccess` 未宣言なら fail-closed = `ADMIN_ONLY` で登録し、初回登録時だけ警告） |

`serviceRegistry.ts` の書き直しは `serviceRegistry` オブジェクト直下のキーだけを見て、複数行のエントリも `{` から対応する `}` まで丸ごと置き換える（`generator/registry/utils/objectEntry.mjs`）。`AUTO-GENERATED` ブロック外に置いた直下エントリも置き換え、無ければ `AUTO-GENERATED-END` の直前に追加する。Prettier で整形しても壊れないが、再生成で 1 行に戻る。書き直しの後、`@/config/app/domain-api-access.config` からの import 行をファイル内で使われている名前だけに揃える（使われなくなった名前は外し、要る名前は足す。fork が手で足した名前も使われている限り残す。集合が変わらなければ行に触れない。`generator/registry/utils/presetAccess.mjs`）。プリセットの値は `domain-api-access.config.ts` の写しで、一致はテストが検証する（プリセットを変えたら写しも変える）。テスト: `pnpm test:dc-registry`。

管理画面ルートの構造（`page.tsx` / `_screen/` / 共有 loader）は [`src/lib/screens/README.md`](../../src/lib/screens/README.md) §12。

### 生成物を変えたいとき（生成ファイルは編集しない）

- **項目・選択肢・表示列など** → `domain.json` を直して再生成する（`fieldGroups` などもここ）
- **フォームに独自項目・差し込み UI** → 生成された `<Domain>Form` / `<Domain>Fields` は FieldRenderer の props（`fieldPatches` / `insertBefore` / `insertAfter` / `fieldGroups` / `beforeField` 等）を受け取る。fork 所有の `_components/` に置いたフォーム・画面から渡す（[`src/components/Form/FieldRenderer/README.md`](../../src/components/Form/FieldRenderer/README.md)）。MediaUploader の commit/reset は `<Domain>Form` の `onMediaStateChange` で受ける
- **管理画面のレイアウト** → `_screen/` を同じルートの `_components/` にコピーして `page.tsx` を向ける（以後の再生成は `_screen/` だけを更新する）
- **CRUD の振る舞い** → `services/server/wrappers/` に置く。ただし `<domain>Service.ts` は `serverServices` 再生成で上書きされるので、そこに足した import / 上書きは再生成後に `git diff` で確認して戻す
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

サンプルの陳腐化検査: `pnpm test:dc-sample-drift` は `sample` / `sampleCategory` / `sampleTag` を一時ディレクトリへ複製したうえで再生成し、コミット済みの生成物と 1 バイトでも違えば落ちる（作業ツリーは書き換えない）。fork が手本にするサンプルを、テンプレートの変更に追従させるための検査。生成物（`serviceRegistry.ts` の `AUTO-GENERATED` ブロックを含む）を手で整形すると落ちる。存在しないサンプルドメインは対象から外し、全部無ければスキップする（サンプルを消した fork では何もしない）。

## よくある失敗

- `domain.json` が壊れている（JSON として読めない） → 直してから再実行
- `テンプレートのトークンが置換されていません` → 管理画面テンプレートに未対応のトークンが残っている。テンプレートを直す
- MediaUploader の追加質問が出ない → フォーム入力の種類を `mediaUploader` / `mediaUploaderMulti` にしたフィールドでだけ出る
