# ドメイン生成 CLI（pnpm generate domain） — API

## Overview

- `README.md` の API の節を分けた文書(生成されるもの・上書きの扱い・出力の種類のデータ)

## API

### 生成されるもの

カテゴリと出力先（`<domain>` = camelCase 単数、`<domains>` = kebab-case 複数）。生成器は `render/<カテゴリ>/`。カテゴリの一覧は `spec/categories.mjs`。

| カテゴリ | 出力 |
|---|---|
| `entities` | Neon = 登録のフォルダ `entities/<domain>/{model,form,schema,drizzle}.ts`（登録名 = ドメイン名）+ それを集める入口 `entities/{model,form,schema,drizzle}.ts`（import の道は前と同じ）と `entities/index.ts`。Firestore = `entities/{model,form,firestore,schema,index}.ts`（登録のフォルダに分けない）。主の集まりの項目（mediaCollection）は列を出さず、スキーマ = `z.array(storageMediaValueSchema)`（required → `.min(1)`、`collection.maxItems` → `.max`）、モデル = `string[]`（省略可）。主は表の定義の後に `defineTableCollections(<Domain>Table, () => import(…/collections))` を出す |
| `components` | `components/Admin<Domain>{Create,Edit,List}/`、`components/common/{Create<Domain>Form,Edit<Domain>Form,<Domain>Form,<Domain>Fields}.tsx`。`useDetailModal` で `<Domain>DetailModal.tsx`、`sortOrderField` で `Admin<Domain>Sort/`（一覧は `render/components/catalog.mjs`）。`<Domain>Fields` は主の集まりの項目に、従属の `file` の用途・accept・上限サイズと集まりの件数を載せる |
| `hooks` | `hooks/use*<Domain>.ts`（どれが生成されるかは `render/hooks/catalog.mjs`、使い方は [`src/lib/crud/hooks/README.md`](../../../src/lib/crud/hooks/README.md)） |
| `clientServices` | `services/client/<domain>Client.ts` |
| `serverServices` | `services/server/drizzleBase.ts`（Firestore なら `firestoreBase.ts`）、`services/server/<domain>Service.ts`（無いときだけ）、`wrappers/`（無ければ作成）。メディア列・主の集まりの配線は表の下 |
| `fieldConstants` | `constants/field.ts` と `types/field.ts`（`options` を持つフィールドがあるときだけ） |
| `adminRoutes` | `src/app/admin/(protected)/<domains>/` の一覧・`new/`・`[id]/edit/`（`sortOrderField` で `sort/`） |
| `registry` | `services/server/domainEntry.ts`（`apiAccess` / `useImportExport` を `access` に展開し、`table` / `idColumn` を書く）、メディア列があれば `services/server/storagePurposes.ts`（毎回上書き）。主の集まりの項目があれば `services/server/collections.ts`（毎回上書き） |
| `presenters` | `presenters.ts`（一覧・詳細表示のフォーマッタ。答えは `src/lib/domain/fields/presenterFor.mjs`。メディア列は `formatMediaThumbnail(s)`） |

`serverServices` の配線:

- メディア列（mediaUploader）があれば drizzleBase に `storage: storageBindingFor(...)`（[src/lib/crud/storageIntegration/README.md](../../../src/lib/crud/storageIntegration/README.md)）。Firestore ドメインのメディア列は生成エラー
- 主の集まりの項目があれば drizzleBase が `collections` を import して options に渡す（`generate: false` の主は自分で足す。渡し忘れは `pnpm test scripts/structure/registry/collectionWiring/collectionWiring.test.mjs` が見つける）

生成される client の部品（`components` カテゴリ）は宣言（domain.json・entity.json）を import せず、主の登録の entity.json の写し `entities/display.ts` の `domainDisplay` を読む（`pnpm generate registry` が書く。写す項目: [`src/lib/domain/README.md`](../../../src/lib/domain/README.md)）。

#### 上書きの扱い

| 扱い | 対象 |
|---|---|
| 毎回上書き（編集しない） | 上表のファイル全部（write-once を除く）。`drizzleBase.ts`・`presenters.ts`・`constants/field.ts`・`<Domain>Fields.tsx` も含む。`components` は一括操作の項目の型 `types/adminBulkAction.ts` も書く（点 adminBulkActions は core/admin の 1 点なので宣言は書かない。自分の点が要るドメインは自分の `extensionPoints.ts` を手で持つ）。項目の `plugs/adminBulkActions/` は触らない |
| 初回だけ生成（write-once） | 管理画面ルートの `page.tsx`（1 行スイッチ。旧形式なら一度だけスイッチ形へ移行）、`services/server/<domain>Service.ts`（`base` にラッパー・独自処理を組み込む手書きの場所。既存の旧 `wrappers/duplicate` の組み込みは警告。テスト: `pnpm test scripts/structure/domain/tests/serverServiceWriteOnce.test.mjs`）。作り直すときはファイルを消してから生成する |
| 毎回再生成 | 管理画面ルートの `_screen/Admin<Domain>{List,Create,Edit,Sort}Screen.tsx` |
| 触らない（fork 所有） | 管理画面ルートの `_components/`、`wrappers/` に自分で置いたファイル、`hooks/` に自分で置いた生成名と異なるファイル |
| 作らない（`pnpm generate registry`） | `src/registry/` の schemaRegistry / domainConfigRegistry / storagePurposeRegistry / adminDomains（走査で丸ごと） |
| 毎回上書き（生成物） | `services/server/domainEntry.ts`（`apiAccess` が無ければ fail-closed = `...ADMIN_ONLY`、`useImportExport: true` のときだけ export / import を開く。`table` = `domain/names.mjs` の `domainTableName`、`idColumn` = `"id"`、Firestore は両方 `null`）。`src/registry/serviceRegistry.ts`（全 domainEntry.ts から `pnpm generate registry` が丸ごと生成。仕組みは `src/lib/domain/README.md`） |

管理画面ルートの構造（`page.tsx` / `_screen/` の Screen と loader.ts）は [`src/lib/screens/README.md`](../../../src/lib/screens/README.md)「生成される管理画面ルート（pnpm generate domain）」。

#### 出力の種類のデータ（`phase.json` の `outputs`）

- 上の表のうち、ファイルごとの種類（`every-run` = 毎回書き直す / `write-once` = 無いときだけ書く）の唯一の元は [`phase.json`](phase.json) の `outputs`。1 行 = `{ glob, kind, source? }`
  - `glob` はリポジトリ直下からの glob。`{dir}` = ドメインのフォルダ・`{camel}` = フォルダ名・`{Pascal}` = その PascalCase・`{route}` = 管理画面のルートのフォルダ（複数形の kebab-case、決まりの元は `src/lib/districtMap/domainNames.mjs`）。`[id]` の `[` `]` は字そのもの
  - `source` = その生成物を変えたいときに直す物（`{dir}/entities/{camel}/entity.json`・`{dir}/services/server/wrappers/`・`{dir}/plugs/`）
- 受け口の一覧の generated の行にはならない（行になるのは `every-run` でドメインの置き換えを持たない glob だけ。`src/lib/districtMap/domainOutputs.mjs` の `intakeOutputGlobs`）
- 読み手: `pnpm workflow ownership who`（`every-run` = 型 generated で直す元を案内、`write-once` と `"generate": false` のドメインは持ち主で own か none。`src/lib/forkOwnership/README.md`「型の答え(`explain.mjs`)」）。当て方は `src/lib/districtMap/domainOutputs.mjs`
- 照合: `pnpm test scripts/structure/domain/tests/outputs.test.mjs` が、このリポの全ドメイン（`generate: false` を除く）を全カテゴリで組み立て（何も書かない）、`file` の Output は `every-run` の行に、`writeOnce` は `write-once` の行に当たり、どの行もどれかの出力に当たることを見る。生成器が書くファイルを足したら、この行も同じコミットで足す

- 印: 毎回上書きの出力（`file` の Output）で注釈を持てる形式（.ts .tsx .mts .mjs .js .css）は、先頭の `// <パス>` の行の次（無ければ先頭）に生成物の印の 1 行が入る（`render/output.mjs` の `file()` = 1 か所）。`pnpm check rules`（`scripts/workflow/rules/generated.mjs`）が先頭 5 行に印があるかを見る。雛形を変えるのは `src/domains/_template/`（生成物は直さない）
