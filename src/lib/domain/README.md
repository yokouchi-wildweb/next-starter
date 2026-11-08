# src/lib/domain — domain.json の読み取りと、ドメイン名からサービス・表・主キーを引く仕組み

`domain.json` の写しと設定（フィールド・リレーション・中間表）を読む純関数群と、**登録表（serviceRegistry）からドメイン名でサービス・表・主キーを引く正式な仕組み**の汎用部分を持つ。ここの関数は登録表を import せず引数で受ける（lib から新しく登録表を import しない。既存の例外と規則は `src/wiring/README.md`）。登録表を結んだそのまま使える関数は `src/wiring/adminScreenParts.ts`。

## 登録表（serviceRegistry）とは

`src/registry/serviceRegistry.ts` = ドメイン名（camelCase のキー）→ `{ service, access, table, idColumn }` の表。**ドメインを 1 つ作ると 1 行増える一覧**で、下流が中身を足す「登録口」ではない。Drizzle はモデルの登録簿を持たないので、アプリ側でここに 1 か所用意する。**新しい用途（台帳の照合・管理ツール・一括処理など）で「ドメイン名 → 表 / サービス」の独自の対応表を作らず、この表を引く。**

| 入口 | 何が決まるか |
|---|---|
| 汎用 CRUD API `/api/<key>/**`（`createDomainRoute`） | 登録されていれば到達。操作ごとの認可は `access`（read / write / operations） |
| 全件削除（`GET /api/admin/domains`・`POST /api/admin/domains/truncate`） | `truncateAll` を持ち、`access.operations.truncateAll` が許可した行だけ |
| データ移行（`/api/data-migration/*`） | `access.operations.export` / `import` が許可した行だけ |
| サーバー内部（`getService` 系・`findDomainByTable` / `getDomainTable`） | 登録されていれば引ける（access は見ない） |

`table` / `idColumn` = 表の物理名と主キー列の物理名（サービスの `getTableName()` / `getIdColumnName()` と同じ値）。サービスを読み込まずに表 ↔ ドメインを引くために、登録の行そのものが持つ。`null` は表を持たない Firestore 版のドメイン（core の chatRoom）だけ。1 つの表は 1 つのキーにしか登録できない（表 → ドメインが一意に決まる）。

### 定義ファイル: `services/server/domainEntry.ts`

登録表に載る全ドメイン（core・業務・fork が core パスに作るドメイン）は `src/features/**/services/server/domainEntry.ts` を 1 ファイル持つ。名前は固定（`registration.ts` ではない。auth の registration と衝突するため）。

```ts
// src/features/core/auditLog/services/server/domainEntry.ts
import type { DomainEntries } from "@/lib/domain/types";
import { INTERNAL_ONLY } from "@/lib/domain/accessPresets";

export const domainEntries = {
  auditLog: {
    service: () => import("./index").then((m) => m.auditLogService),
    table: "audit_logs",
    idColumn: "id",
    access: INTERNAL_ONLY,
  },
  auditLogFailed: {
    service: () => import("./drizzleBase").then((m) => m.auditLogFailedBase),
    table: "audit_logs_failed",
    idColumn: "id",
    access: INTERNAL_ONLY,
  },
} satisfies DomainEntries;
```

- キー付きオブジェクト、1 ファイルに複数キー可（auditLog は 2 キー）
- `service` は**遅延読み込み**（`() => import(...)`）。登録表を import しても各ドメインのサービス・DB 接続は読み込まれない
- `service` は CRUD の全メソッドを持つサービスを返す（通常は `<domain>Service` = base + wrappers）。`pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs` が Drizzle 版の全エントリに `getTableName` / `getIdColumnName` / `truncateAll` / `searchWithDeleted` を求める。**base の一部だけを見せる入口のサービス（読み取り専用など）は通らないので、`service` は base を指す**（上の例の auditLogFailed と同じ `import("./drizzleBase").then((m) => m.<x>Base)`）。足りないメソッドを検査のためだけに入口へ足さない
  - base を指すと、登録表を通る全経路（汎用 API `/api/<key>/**`・全件削除・データ移行・サーバー内の `getService`）が base 全体を使い、入口の絞り込みは効かない → `access` は `INTERNAL_ONLY` にするか、base 全体に許してよい操作だけを開く。入口のサービスはそのドメイン専用のルートから使い続ける
- `table` / `idColumn` は型で必須（`string | null`）。service の直後に、**文字列リテラルか `null` で**書く（生成器はファイルを文字として読むので、定数・式は `pnpm check registry` が失敗にする）。表を持たない Firestore 版は両方 `null`
- 静的 import してよいのは `@/lib/domain/types` と `@/lib/domain/accessPresets`（プリセット）だけ。`pnpm check registry` が縛る
- 業務ドメイン: `pnpm generate domain`（forge）が domain.json から生成する（registry カテゴリ。手で直すならそのドメインを `"generate": false`）。access = `apiAccess`（無ければ ADMIN_ONLY）+ `truncateAll` は管理者 + `export` / `import` は `useImportExport: true` のときだけ管理者、それ以外（省略を含む）は `"none"`。`table` = 表の定義の生成器と同じ決め方（`scripts/structure/domain/domain/names.mjs` の `domainTableName` = domain.json の `plural`、無ければドメイン名の snake_case）、`idColumn` = `"id"`、dbEngine が Firestore なら両方 `null`
- core ドメイン・fork が手書きする domainEntry.ts（core パスのドメイン、`generate: false` のドメイン）: `table` / `idColumn` も自分で書く。値の正しさは `pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs` が実物と比べる。core のファイルは fork が編集しない。業務ドメインの写せる形は下の「generate: false の業務ドメイン」
- fork が core の access を変える: 隣に `domainEntry.override.ts`（fork 所有）。`export const domainEntryOverrides = { <key>: <access> } satisfies DomainEntryOverrides` で access を丸ごと置き換える。生成器が読む

#### generate: false の業務ドメイン

`"generate": false` の業務ドメインは生成器が何も書かない（`pnpm generate domain -- <Domain> --only registry` も含む）。`domainEntry.ts` を持たないまま false にしたドメイン（旧 `generateFiles.registry: false` から移ったものなど）は、`pnpm check registry` が「drizzleBase.ts … があるのに domainEntry.ts が無い」で止まるので、`services/server/domainEntry.ts` を手で書く。形は生成器が書くものと同じ（下は domain.json が `"plural": "visits"`、`apiAccess` 無し、`useImportExport` 無しの `visit` の例。`pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs` がこの例をそのまま置いて検査が通ることを確かめている）:

```ts
import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_ONLY, ADMIN_RULE } from "@/lib/domain/accessPresets";

export const domainEntries = {
  visit: {
    service: () => import("./visitService").then((m) => m.visitService),
    table: "visits",
    idColumn: "id",
    access: {
      ...ADMIN_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: "none",
        import: "none",
      },
    },
  },
} satisfies DomainEntries;
```

- キー = フォルダ名（singular の camelCase）。`service` = 同じフォルダの `<camel>Service.ts` の `<camel>Service`
- `table` = domain.json の `plural` の snake_case（無ければドメイン名の snake_case）、`idColumn` = `"id"`。Firestore 版は両方 `null`
- `access` = domain.json の `apiAccess` の read / write（無ければ `...ADMIN_ONLY`。`PUBLIC_READ` などのプリセットに当たるならそれを広げる）+ `apiAccess.operations` + `truncateAll: ADMIN_RULE` + `export` / `import` = `useImportExport: true` なら `ADMIN_RULE`、それ以外は `"none"`
- 書いたら `pnpm generate registry` → `pnpm check registry` → `pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs`（`table` / `idColumn` を実物と比べる）。以後 `apiAccess` / `useImportExport` / `plural` を変えたらこのファイルも手で直す（生成器は追わない）

### 生成と検査

| コマンド | 何をするか |
|---|---|
| `pnpm generate registry` | 全 domainEntry.ts（+ override）を走査して `src/registry/serviceRegistry.ts` を丸ごと生成する。`pnpm generate domain` / `pnpm generate domain -- --delete` の最後にも自動で走る。2 回続けて実行しても差分は出ない |
| `pnpm check registry` | 生成物との一致と静的検査。`pnpm build` の冒頭で環境に依らず必ず走る（`pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs` でも） |
| `pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs` | 上に加えて、全エントリを実際に読み込み、`table` / `idColumn` が `getTableName()` / `getIdColumnName()` と一致すること（`null` は getTableName を持たないサービスだけ）と、access の契約（下記）を確かめる |

`pnpm check registry` が失敗する条件と直し方（メッセージにも出る）:

- 移行前の手書き行（生成ヘッダの無い旧 serviceRegistry.ts に、どの domainEntry.ts からも作られないキー）→ domain.json の `apiAccess` に移して `pnpm generate domain -- <Domain> --only registry`、または domainEntry.ts（core）/ domainEntry.override.ts（fork が core の access を変える）へ移す。生成ヘッダ付きのファイルから消えるキー（pnpm generate domain -- --delete 後）は正当な除去として通る
- キーの重複 / `drizzleBase.ts`・`firestoreBase.ts` があるのに domainEntry.ts が無い（登録表に載せないドメインは `scripts/structure/registry/serviceRegistry/discover.mjs` の `ENTRY_EXCEPTIONS` に理由付きで。縮むだけの表）/ `storageBindingFor` の第 1 引数（record_type）がキーに無い / 読めない行・許可外の静的 import / override のキーが隣の domainEntry.ts に無い
- `table` / `idColumn`: 無い（生成ドメインは `pnpm generate domain -- <Domain> --only registry`、手書きは service の直後に書く）/ 文字列リテラルと `null` 以外 / 形が物理名でない（空・63 文字超・引用符や空白入り。大文字は通す）/ 片方だけ `null` / **同じ表が 2 つのキーにある**（両方のファイルとキーを出す）。値が実物と同じかは `pnpm check registry` では見ない（`pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs`）

生成器: `scripts/structure/registry/serviceRegistry/{discover,generate,check}.mjs`（plain node。cron の generate / check と同じ 3 分割）。

### access と管理データ操作

`access`（`DomainApiAccessConfig`）= `read` / `write` / `operations`。CRUD 操作は `operations[op]` → `read` / `write` → グローバル既定（admin カテゴリのみ、fail-closed）の順に解決する（`resolveAccessRule`）。

**管理データ操作** `truncateAll` / `export` / `import`（`DOMAIN_DATA_OPERATIONS`）は `operations` に明示したときだけ開く。未指定・不正なら `"none"` で、read / write / 既定には倒れない。登録しただけで全件削除やデータ移行の対象にならないようにするため。管理の各ルートは自分の門（access `{ roleCategories: ["admin"] }`、全件削除は + 本人パスワード）に加えて、この規則を同じ評価器で AND で掛ける（1 つでも拒否なら要求全体を拒否）。

プリセット（`src/lib/domain/accessPresets.ts`、lib/domain の公開の定数。上書きできる設定にしない、設定の議会 D63）。既定 `DEFAULT_ACCESS_RULE`（admin カテゴリだけ）は access の書き漏れの fail-closed:

| 名前 | 意味 |
|---|---|
| `ADMIN_ONLY` / `PUBLIC_READ` / `ADMIN_OR_DEBUGGER` | 汎用 API の read / write |
| `INTERNAL_ONLY` | read / write とも `"none"`。登録表には載せる（サーバー内部で引ける）が、汎用 API・全件削除・データ移行には出さない |
| `ADMIN_RULE` / `ADMIN_OR_DEBUGGER_RULE` | 単一ルール（`operations` の上書きに） |
| `ADMIN_DATA_OPERATIONS` | `{ truncateAll, export, import }` を管理者に開く断片。`{ ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS }` / import だけ閉じるなら `operations: { ...ADMIN_DATA_OPERATIONS, import: "none" }` |

`isGenericApiClosed(access)` = 汎用 CRUD が全操作 `"none"` か（feature gate の検査が「閉じているべき `/api/<domain>`」から除くのに使う）。

### データ操作のコマンド（pnpm ops data）の許可

全ドメイン共通のデータ操作のコマンド `pnpm ops data <export|import|update|delete> <domain>` が、そのドメインで許されるか・どのサービスの関数を呼ぶかは `resolveDataCommand(access, command, service)`（`definition/dataCommand.ts`）が決める。

- 対応: `export` → 操作 `export` / 関数 `search`、`import` → `import` / `bulkUpsert`、`update` → `bulkUpdate` / `bulkUpdate`、`delete` → `bulkDeleteByIds` / `bulkDeleteByIds`（`DATA_COMMAND_OPERATIONS`）
- 許可: その操作の規則（`resolveAccessRule`）が `"none"` でなければ許す = 管理 API で何かしらのロールに許した操作はコマンドでも許す。`export` / `import` は上の管理データ操作の規則（書かなければ `"none"`）
- 上書きの欄 `access.commands`（`{ export?, import?, update?, delete? }` = `"allow"` | `"deny"`）: API とコマンドで範囲を変えたいドメインだけ書く。core は `domainEntry.ts`（fork が core を変えるなら `domainEntry.override.ts`）、業務ドメインは domain.json の `apiAccess.commands`（`pnpm generate domain` が `domainEntry.ts` に写す）
- fail-closed: 許されても、そのドメインのサービスに関数が無ければ止める（lib/crud を直接呼ばない）。例: user はサービスが `bulkDeleteByIds` を公開しないので `delete` は閉じる、`update` は列を限ったラッパー `userService.bulkUpdate`
- 登録表で引けること（`getService`）は許可ではない。`INTERNAL_ONLY` のドメインは 4 つとも閉じる
- 全ドメインの結果は `pnpm test scripts/structure/registry/dataCommands.test.mts`（user と INTERNAL_ONLY を固定）

### 引く（`src/lib/domain/server`、登録表は引数）

| 関数 | 用途 |
|---|---|
| `hasService(registry, key)` | 同期。キーの有無だけ（サービスは読み込まない） |
| `getService(registry, key)` / `getServiceOrThrow` | 非同期。遅延読み込みしてサービスを返す。未登録は undefined / throw、読み込み失敗は throw |
| `lookupDomainService(registry, key, { require })` | 非同期・throw しない。`found | unregistered | load_failed | unsupported(missing)` を状態で返す。「引けない」と「行なし」を区別したい照合処理用（例: `require: ["searchWithDeleted"]`） |
| `findDomainByTable(registry, tableName)` | 同期・読み込まない。表の物理名 → キー。登録の無い表（中間表・履歴・カウンター・cron の記録など）は `null`。同じ表が 2 キーの登録表（pnpm check registry を通っていない）では throw |
| `getDomainTable(registry, key)` | 同期・読み込まない。キー → `{ table, idColumn }`。未登録と Firestore 版は `null` |
| `getDomainList(registry, configMap)` / `getDomainListWithCount` / `withRecordCounts` / `isValidDomainKey` / `getInvalidDomainKeys` | 全件削除の一覧（access の評価は呼び手）。`getDomainList` はサービスを読み込まず、`table` を持つ行（= Drizzle 版 = truncateAll あり）で作る。読み込めないドメインも一覧に出るが、実行の直前の `isValidDomainKey` / `getInvalidDomainKeys` はサービスを読み込んで truncateAll を確かめる |

戻りの型 `DomainService` は createCrudService の操作の構造型（全 optional）。Drizzle 版は `getTableName()`（表の物理名）と `getIdColumnName()`（主キー列の物理名）を持つ。主キーの論理名は常に `CRUD_ID_FIELD = "id"`（`@/lib/crud`）。表そのものは公開しない。Firestore 版（凍結）は `truncateAll` / `getTableName` / `getIdColumnName` を持たない。

登録表を結んだ版は `src/wiring/domainRegistry.ts`（import してよい場所は `src/wiring/README.md`）。lib が引きたいときは呼び手が注入する（`src/lib/dataMigration` の `services`、storageObject の sweep の `lookupService`）。

表 ↔ ドメインの逆引きの他の利用候補（auditLog の `target_type` の値をドメイン名に揃える、feature-gate の `tables` を登録表と照らす、中間表の名前解決 `junction/` との役割分担）は、まだ対応していない。使うときは、機能ごとの対応表を作らずこの 2 関数を引く。

## 表示用の写し（entities/display.ts）

client に出すドメイン設定は `<domain>/entities/display.ts` の `domainDisplay`（型 `DomainDisplay`、`types/display.ts`）。`pnpm generate registry` が domain.json の許可した項目だけを写す。`pnpm generate domain` の後は `pnpm generate registry`（ずれは `pnpm check registry` が止める）。

- top: singular・plural・label・fields・relations・searchFields・useCreatedAt・useUpdatedAt・useSoftDelete・useImportExport・sortOrderField・fieldGroups（key・label・fields・collapsible・defaultCollapsed・bgColor）・tableFields
- field: name・label・fieldType・formInput・options・required・readonly・defaultValue・displayType・placeholder・accept・validationRule・reorderable・helperText
- relation: domain・label・fieldName・fieldType・relationType・required・formInput・labelField・includeRelationTable。非同期検索の関連には関連先の searchFields
- 写さない: defaultOrderBy・metadataBinding・uploadPath・field の description・apiAccess・dbEngine・generateFiles・storage ほか一覧の外。domain.json にキーを足しても client には出ない（fork だけのキーも同じ）
- 列名を持つ項目（fields・searchFields・tableFields・sortOrderField・fieldGroups[].fields・relations.fieldName）は、Firestore なら camelCase にし、hiddenColumns の列を除く。隠し列を指す関連は写さない

宣言は `export const domainDisplay: DomainDisplay`（リテラル型は持たない）。

domain.json の無い手書きの domain は、同じ置き場に同じ形を手で書く。`hiddenColumns` は `defineHiddenColumns` と同じ列を宣言する。検査: `pnpm test scripts/structure/registry/alpha/domainDisplay.test.mjs`。

## ドメイン設定の読み方

- client: 写し（上の節）を読む。domain.json は import しない（lint `import-boundaries/client-no-domain-json`、全 Tier error。import()・export from・型も）。client = `"use client"` のファイルか `components/`・`hooks/`・`_components/` の下のファイル。`_components/` の下で `"use client"` の無い `*Screen.tsx` と `loader.ts` は server の差し替えなので対象外。写しに無いキーが本当に要るときは理由を書いて eslint-disable。手持ちの部品の移行は `node .notices/20261101-121000-domain-display-client.domain-json-client-display.mjs`（確かめられないファイルは書き換えず一覧に出す）。`getRelationsOf` / `getBelongsToRelationsOf` / `getBelongsToManyRelationsOf` / `getHasManyRelationsOf` / `hasRelationsOf` は写しを受ける。文字列のドメイン名を受ける関数は無い
- server、自分のドメインだけ: 自分の domain.json を読み `normalizeDomainJsonConfig` を通す（drizzleBase の形。client は写しが変換済みなので呼ばない）
- server、全ドメイン: `src/wiring/domainConfig.ts` の `getDomainConfig` / `hasDomainConfig`。`domainConfigRegistry` は server-only で、client から届くと build が止まる。lib は `createDomainConfigLookup(表)` の汎用版だけを持ち、登録表を import しない

## フォルダ

- `definition/`: `createDomainConfigLookup`、`normalizeDomainJsonConfig`、`resolveAccessRule`
- `relations/`: 写しを受ける関数、関連選択肢（`relationOptions.mjs`）
- `fields/`: `extractFields` / `extractImageFields`、型（fieldType）の表 `fieldTypes.mjs`
- `junction/`: 中間表の名前解決（utils は client 可、`getJunctionTable(tables, name)` は server-only で表の一覧を引数で受ける。結んだ版は `src/wiring/domainRegistry.ts` の `getJunctionTable(name)`）
- `hooks/` `service/client/`: 管理画面の全件削除一覧（`useFetchDomains`）

### 型（fieldType）の表: `fields/fieldTypes.mjs`

domain.json の項目の型の意味（列関数・Zod・TS 型・フォームの初期値・checkbox の単複・日時か・廃止か）を決める表 1 つ。生成器（`scripts/structure/domain/spec/fieldTypes.mjs` は再 export）も実行時（`buildFormDefaultValues`・`isCheckGroupFieldType`）も `fieldTypeSpec(type)` と導出関数でここを引く。

- 型名は小文字化せずに引く。表に無い型は未知型（生成器は型名をそのまま列関数に出して警告、フォームの初期値は `""`、日時変換も複数選択もしない）。別名は作らない
- 型を足す: 表に 1 行（`formDefault` は必ず書く）+ `src/lib/domain/fields/fieldFormInputs.mjs` に入力種別 + `src/components/Form/Field/types.ts` の union に型名。属性の意味は表の頭のコメント
- 廃止: 行に `retired`（移り先の案内文）。生成前の検査が止める。実行時は見ない（まだ列を持つ fork の初期値は残す）
- `.mjs` なのは node の生成器と TypeScript の両方から import するため（`relationOptions.mjs` と同じ）
- テスト: `pnpm test src/components/Form/FieldRenderer/defaultValueBuilder.test.ts`（行ごとの答えを literal で固定、union と表のキーの突き合わせ）

#### 何で表示するか: `fields/presenterFor.mjs`

`presenterFor(field)` が項目の表示の種類 `{ kind, options? }` を返す（kind = `boolean`・`number`・`stringArray`・`enum`（選択肢つき）・`string`・`datetime`・`date`・`collectionThumbnails`・`mediaThumbnail`）。生成器（`scripts/structure/domain/render/presenters`）はこの答えを presenters.ts の式に写すだけ。

- 順: 表の `presenter`（`enum` は選択肢が無ければ `string` で確定）→ formInput（数値・文字列・日時・日付）→ 主の集まり → メディア → `string`
- 手書きの presenters.ts の項目は、この答えより優先される（生成後に手で書き換えた項目はそのまま）
- テスト: `pnpm test src/lib/domain/fields/presenterFor.test.mjs`

#### 番人（lint `field-type-guard/no-literal-field-type`）

表の外で型名を決め打ちするコードを止める。ずれのバグ（型を足したときの抜け）は表の外の型名の比較・集合からしか生まれないので、構造で止める。

- 検出: (a) fieldType 由来の値（`.fieldType`・名前に fieldType を含む変数・`.fieldType` から代入した変数）と文字列の `===` / `!==` / `switch` / `includes` 等 (b) 表のキーのうち一般語でないもの（`stringArray`・`bigint`・`"numeric(10,2)"` 等）を 2 つ以上含む配列・`switch` の case 列。typeof の比較と入力種別（formInput）の名前の集合は通す。詳細: `eslint-rules/field-type-guard.mjs`
- 対象: `src/**/*.{ts,tsx}` と生成器（`scripts/structure/domain`・`scripts/structure/role` の `.mjs`）。対象外: この表（`fields/`）・型名の union（`src/components/Form/Field/types.ts`、表との突き合わせは `pnpm test src/components/Form/FieldRenderer/defaultValueBuilder.test.ts`）・テスト
- 強さ: 上流リポ（`src/lib/CATALOG.md` の先頭の節の持ち主）= error、fork = warn（fork に残る上流の旧版の写しで fork の lint を止めない）
- 直し方: 表の属性と導出関数（`fieldTypeSpec`・`isArrayFieldType`・`isMediaFieldType` 等）で引く。答えに要る属性が表に無ければ表に属性を足す。正当な例外は理由付き eslint-disable
- 許可リストは無い（表の外の決め打ち 0）。新しい決め打ちをフォルダ単位で通さない
- テスト: `pnpm test eslint-rules/field-type-guard.test.mjs`

テスト: `pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs`（登録表）、`pnpm test src/wiring/wiring.test.mjs`（wiring の目録と向き）、`pnpm test src/lib/domain/relations/relationOptions.test.mjs`、`pnpm test scripts/structure/domain/tests/registry.test.mjs`（domainEntry.ts の生成）。
