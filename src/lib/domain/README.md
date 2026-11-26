# src/lib/domain — ドメインの定義と欄(宣言 domain.json + entity.json の読み方・欄の型とその schema と表示・関連・ドメインの道)と、ドメイン名からサービス・表・主キーを引く仕組み

## Overview

- 役目 = ドメインの定義と欄: 宣言(`domain.json` + 登録ごとの `entities/<登録名>/entity.json`)の形と読み込みの部品 `readDomain`、entity.json の正規化 `normalizeEntityDeclaration`、写し `entities/display.ts` と設定(フィールド・リレーション・中間表)の読み方、欄の型の表とその schema(日時の `nullableDatetime` / `requiredDatetime`)・表示(`format*`・`FieldPresenter`)・主キーの論理名 `CRUD_ID_FIELD`、関連、ドメインの道(管理画面のパス `getAdminPaths`)。加えて、登録表(serviceRegistry)からドメイン名でサービス・表・主キーを引く正式な仕組みの汎用部分を持つ
- React の値のコード・hooks・HTTP の client は持たない(入口 "." は server でも値で読める)。データの読み書き(サービス・hooks・client。管理画面の全件削除の `useFetchDomains` / `useTruncateDomains` / `domainClient` も)は `@/lib/crud`(crud → domain の向きだけ。domain は crud を読まない)
- ここの関数は登録表を import せず引数で受ける(既存の例外と規則は `src/wiring/README.md`)。登録表を結んだそのまま使える関数は `src/domains/core/admin/services/server/screenParts.ts`
- 閉じた lib: 外からは入口だけを読む。`@/lib/domain`(client でも server でも)・`@/lib/domain/server`(登録表から引く関数)・`./node` = `src/lib/domain/node.mjs`(scripts・eslint-rules が読む `.mjs`)・`./declarations` = `src/lib/domain/declarations.mjs`(宣言の形と `readDomain`。node の API を使わないので地区の地図などの lib も読める)。何がどこから出るか: `API.md`「入口と関数のありか」。access の型と定型は別の閉じた lib `@/lib/domainAccess`(domainEntry.ts が値で読むので値だけで作る)
- 登録表 `src/registry/serviceRegistry.ts` = ドメイン名(camelCase のキー)→ `{ service, access, table, idColumn }` の表。ドメインを 1 つ作ると 1 行増える一覧で、下流が中身を足す「登録口」ではない。Drizzle はモデルの登録簿を持たないので、アプリ側でここに 1 か所用意する

| 入口 | 何が決まるか |
|---|---|
| 汎用 CRUD API `/api/<key>/**`（`createDomainRoute`） | 登録されていれば到達。操作ごとの認可は `access`（read / write / operations） |
| 全件削除（`GET /api/admin/domains`・`POST /api/admin/domains/truncate`） | `truncateAll` を持ち、`access.operations.truncateAll` が許可した行だけ |
| データ移行（`/api/data-migration/*`） | `access.operations.export` / `import` が許可した行だけ |
| サーバー内部（`getService` 系・`findDomainByTable` / `getDomainTable`） | 登録されていれば引ける（access は見ない） |

`table` / `idColumn` = 表の物理名と主キー列の物理名（サービスの `getTableName()` / `getIdColumnName()` と同じ値）。サービスを読み込まずに表 ↔ ドメインを引くために、登録の行そのものが持つ。`null` は表を持たない Firestore 版のドメイン（core の chatRoom）だけ。1 つの表は 1 つのキーにしか登録できない（表 → ドメインが一意に決まる）。

## Usage

### 定義ファイル: `services/server/domainEntry.ts`

登録表に載る全ドメイン（core・業務・fork が core パスに作るドメイン）は `src/domains/**/services/server/domainEntry.ts` を 1 ファイル持つ。名前は固定（`registration.ts` ではない。auth の registration と衝突するため）。

```ts
// src/domains/core/auditLog/services/server/domainEntry.ts
import type { DomainEntries } from "@/lib/domain";
import { INTERNAL_ONLY } from "@/lib/domainAccess";

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
- `service` は CRUD の全メソッドを持つサービスを返す（通常は `<domain>Service` = base + wrappers）。`pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs` が Drizzle 版の全エントリに `getTableName` / `getIdColumnName` / `truncateAll` / `searchWithDeleted` を求める。
  - **base の一部だけを見せる入口のサービス（読み取り専用など）は通らないので、`service` は base を指す**（上の例の auditLogFailed と同じ `import("./drizzleBase").then((m) => m.<x>Base)`）
  - base を指すと、登録表を通る全経路（汎用 API `/api/<key>/**`・全件削除・データ移行・サーバー内の `getService`）が base 全体を使い、入口の絞り込みは効かない → `access` は `INTERNAL_ONLY` にするか、base 全体に許してよい操作だけを開く。入口のサービスはそのドメイン専用のルートから使い続ける
- `table` / `idColumn` は型で必須(`string | null`)。service の直後に、文字列リテラルか `null` で書く(生成器はファイルを文字として読む)。表を持たない Firestore 版は両方 `null`
- 静的 import(`domainEntry.ts` と `domainEntry.override.ts`): 登録表がこれを全ドメイン分静的に読むので、軽く副作用なしに保つ。`pnpm check registry` が縛る(判定: `scripts/structure/registry/serviceRegistry/discover.mjs` の `checkEntryStaticImports`)
  - 型だけの import（`import type`・名前がすべて `type`）はどこからでも可
  - 値の import は**値だけのファイル**からだけ。置き場や名前でなく中身で見る: 文が 型だけの import・値だけのファイルからの値の import と再 export・型の宣言（`type` / `interface`）・`const <名> = <値の式>`・`export default <値の式>` だけのファイル。値の式 = リテラル・そのファイルの定数か import した名前の参照（`.プロパティ` も）・それらの object / 配列 / spread（`as` / `satisfies` は外して見る）。関数・呼び出し・`new`・副作用の import・`let` / `var`・`enum`・`class` は不可。値の import の先も同じ決まりで推移的に確かめ、解けない指定子（パッケージ・無いファイル）は不可
  - 上流の権限の型と定型 `@/lib/domainAccess`(値だけのファイルだけで作った閉じた lib)はこの決まりで通る。`@/lib/domain` の入口は関数・hooks を含むので、値は読まない(型だけなら可)。fork が自分の権限の定型（例: 店舗の関係者だけ）を持つなら、自分のドメインの `constants/` などに値だけのファイルとして置き、`domainEntry.ts` から import する
- 業務ドメイン: `pnpm generate domain`（forge）が主の登録の `entities/<登録名>/entity.json` から生成する（registry カテゴリ。手で直すならその登録を `"generate": false`）。access = `apiAccess`（無ければ ADMIN_ONLY）+ `truncateAll` は管理者 + `export` / `import` は `useImportExport: true` のときだけ管理者、それ以外（省略を含む）は `"none"`。
  - `table` = 表の定義の生成器と同じ決め方（`scripts/structure/domain/domain/names.mjs` の `domainTableName` = entity.json の `plural`、無ければドメイン名の snake_case）、`idColumn` = `"id"`、dbEngine が Firestore なら両方 `null`
- core ドメイン・fork が手書きする domainEntry.ts（core パスのドメイン、`generate: false` のドメイン）: `table` / `idColumn` も自分で書く。値の正しさは `pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs` が実物と比べる。core のファイルは fork が編集しない。業務ドメインの写せる形は下の「generate: false の業務ドメイン」

### generate: false の業務ドメイン

`"generate": false` の業務ドメインは生成器が何も書かない（`pnpm generate domain -- <Domain> --only registry` も含む）。`domainEntry.ts` を持たないまま false にしたドメイン（旧 `generateFiles.registry: false` から移ったものなど）は、`pnpm check registry` が「drizzleBase.ts … があるのに domainEntry.ts が無い」で止まるので、`services/server/domainEntry.ts` を手で書く。

形は生成器が書くものと同じ（下は登録の entity.json が `"plural": "visits"`、`apiAccess` 無し、`useImportExport` 無しの `visit` の例。`pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs` がこの例をそのまま置いて検査が通ることを確かめている）:

```ts
import type { DomainEntries } from "@/lib/domain";
import { ADMIN_ONLY, ADMIN_RULE } from "@/lib/domainAccess";

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
- `table` = 登録の entity.json の `plural` の snake_case（無ければドメイン名の snake_case）、`idColumn` = `"id"`。Firestore 版は両方 `null`
- `access` = 登録の entity.json の `apiAccess` の read / write（無ければ `...ADMIN_ONLY`。`PUBLIC_READ` などのプリセットに当たるならそれを広げる）+ `apiAccess.operations` + `truncateAll: ADMIN_RULE` + `export` / `import` = `useImportExport: true` なら `ADMIN_RULE`、それ以外は `"none"`
- 書いたら `pnpm generate registry`。`pnpm check registry` と `scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs`（`table` / `idColumn` を実物と比べる）が守る(/sluice の検査が回す)。以後 `apiAccess` / `useImportExport` / `plural` を変えたらこのファイルも手で直す（生成器は追わない）

### ドメイン設定の読み方

- client: 写し（上の節）を読む。宣言（domain.json と entities/<登録名>/entity.json）は import しない（lint `import-boundaries/client-no-domain-json`、全 Tier error。import()・export from・型も）。client = `"use client"` のファイルか `components/`・`hooks/`・`_components/` の下のファイル。`_components/` の下で `"use client"` の無い `*Screen.tsx` と `loader.ts` は server の差し替えなので対象外。写しに無いキーが本当に要るときは理由を書いて eslint-disable。
  - 手持ちの部品の移行は `node .notices/20261101-121000-domain-display-client.domain-json-client-display.mjs`（確かめられないファイルは書き換えず一覧に出す）。`getRelationsOf` / `getBelongsToRelationsOf` / `getBelongsToManyRelationsOf` / `getHasManyRelationsOf` / `hasRelationsOf` は写しを受ける。文字列のドメイン名を受ける関数は無い
- server、自分のドメインだけ: 自分の登録の `entities/<登録名>/entity.json` を import し `normalizeEntityDeclaration` を通す（drizzleBase の形。client は写しが変換済みなので呼ばない）
- server、全ドメイン: `src/wiring/domainConfig.ts` の `getDomainConfig` / `hasDomainConfig`(全ドメインの主の登録の entity.json)。`domainConfigRegistry` は server-only で、client から届くと build が止まる。lib は `createDomainConfigLookup(表)` の汎用版だけを持ち、登録表を import しない

### 型(fieldType)を足す・廃止する

- 足す: 表 `fields/fieldTypes.mjs` に 1 行(`formDefault` は必ず書く)+ `src/lib/domain/fields/fieldFormInputs.mjs` に入力種別。型名の union は `fields/fieldTypeNames.ts` が表から導く(手で書かない)
- 廃止: 行に `retired`(移り先の案内文)。生成前の検査が止める。実行時は見ない(まだ列を持つ fork の初期値は残す)

## API

- 引く関数・access のプリセット・コマンドの対応・写しの項目・型の表・宣言の読み込み: `API.md`

### 宣言の形(D335、作り直しの途中)

- ドメイン 1 つ = `src/domains/<d>/domain.json`(ドメインそのものの短い宣言: `domainConfigVersion` "2.0"・`label`)+ 表 1 つ = 登録 1 件ごとの `entities/<登録名>/entity.json`(表の鍵と登録の鍵)。表なしのドメインは登録 0、表 1 つのドメインは登録名 = ドメイン名
- 登録の一覧は `entities/` の下のフォルダの並びで、どこにも手で書かない。生成するかの旗 `generate` は登録ごと(entity.json、D337)
- 鍵の集合の正は `definition/declaration.mjs`、読むのは読み込みの部品 `definition/readDomain.mjs` だけ(入口 "./declarations"・"./node")。無い・壊れた・知らない鍵は `problems` に入り、推測で埋めない
- entities/ の下のフォルダのうち entity.json か表のファイル(`ENTITY_FILE_KINDS`)を持つ物だけが登録(役割の表 profiles/ などは登録でない)
- 入れ子(fields・relations・fieldGroups・indexes と下の表の鍵)の知らない鍵も `problems`(表 `ENTITY_NESTED_KEYS`)。値の形は見ない
- 上流の全ドメインはこの形。scripts 側の読み手(生成器・登録表の生成・地区の地図・検査)はこの部品だけで読む。実行時(server)に宣言を読む所は登録の entity.json を import して `normalizeEntityDeclaration` を通す(上の「ドメイン設定の読み方」)
- 比べる道具(`pnpm check domain -- --compare`・`--parity <ref>`)は ref の生成器で旧側を動かすので、宣言が 1 ファイルの domain.json だった頃の ref とは比べられない
- 生成器の 1 ドメインの config = 主の登録の entity.json。生成する登録を持つのに登録が 2 つ以上のドメインは止める(登録ごとの一式は区切り domain-kit)

手で持つ表の形の鍵(entity.json だけ、Neon のみ。宣言が 1 ファイルの domain.json だった頃には書けなかった物):

- 宣言から表を組む手段は生成器の 1 つ(`scripts/structure/domain/render/entities/drizzle/shape.mjs`・`indexes.mjs` が下の鍵を entities/drizzle.ts に書く、dbObjects は書かず名指すだけ、Firestore に書けば止める)


| 鍵 | 形 | 例 |
|---|---|---|
| `table` | string(省略 = snake(plural)) | `"users"` |
| `primaryKey` | `{ columns, name? }`(省略 = idType の id 列) | 複合の主キー・名前の主キー |
| `foreignKeys` | `[{ columns, references: { table, columns }, onDelete?, onUpdate?, name? }]` | relations で言えない FK(名前つき・同じ相手への 2 本目・自己参照) |
| `indexes[]` の `unique`・`desc`・`expression` | `unique: true`・`desc: [列]`(降順)・`expression: "<SQL の式>"`(列の代わり) | 名前つき・部分のユニーク(ユニークはこの形だけ、`compositeUniques` は entity.json に無い)・`lower(btrim(name))` |
| `checks` | `[{ name, sql }]` | check 制約 |
| `enums` | `[{ name, values }]` か `[{ name, valuesFrom: { file, export } }]` | pgEnum。設定から値を作る物は値を写さず名指す(照らしは読み込んだ値で比べる) |
| `relations[].unique` | `true` | belongsTo の外部キーの列のユニーク(1 対 1) |
| `relations[].foreignKey` | `false` | 外部キーの制約を作らない(列だけ。表に制約の無い関連、または名前の違う制約を foreignKeys で書く時) |
| `dbObjects` | `[{ kind: "trigger" \| "function", file }]` | drizzle で書けない DB の物を SQL のファイルで名指す |
| `columns` | `[{ name, column }]`(`column.type` か `column.enum` は必ず) | 表だけの列(画面・フォームの項目でない表の事実)。1 つの列は fields と columns のどちらか一方にだけ書く |
| `fields[].column`・`columns[].column` | `{ name?, type?, enum?, default?, notNull?, identity?, unique? }` | `type` = SQL の型の書き方(smallint・numeric・inet・uuid[])、`default` = 値か `{ sql: "now()" }`、`identity` = always・byDefault、`unique` = 列の制約(ソフトデリートの表でも部分索引にしない) |

登録の鍵(entity.json だけ): `generate`(省略 = true、D337)・`registered`・`reason`・`requires`・`service`・`adminList`。
`adminList: false` = 汎用の管理一覧の目録 src/registry/adminDomains.ts に出さない(省略 = 一覧の画面 /admin/<複数形>/page.tsx がある登録は出る)。
手で作った管理の画面を持ち、今の形の宣言を持たなかった登録(auditLog・setting・userGroup)は false(起こす道具が書く。管理の一覧を黙って変えない)

## Extension

- fork が core の access を変える: 隣に `domainEntry.override.ts`(fork 所有)。`export const domainEntryOverrides = { <key>: <access> } satisfies DomainEntryOverrides` で access を丸ごと置き換える。生成器が読む(拡張点の宣言 `extensionPoints.ts` の `domainEntries`、差し替えられる鍵は `access` だけ)
- 業務ドメインの access は登録の entity.json の `apiAccess`(`apiAccess.commands` も)

## Internals

### 生成と検査

| コマンド | 何をするか |
|---|---|
| `pnpm generate registry` | 全 domainEntry.ts（+ override）を走査して `src/registry/serviceRegistry.ts` を丸ごと生成する。`pnpm generate domain` / `pnpm generate domain -- --delete` の最後にも自動で走る。2 回続けて実行しても差分は出ない |
| `pnpm check registry` | 生成物との一致と静的検査。`pnpm build` の冒頭で環境に依らず必ず走る（`pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs` でも） |
| `pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs` | 上に加えて、全エントリを実際に読み込み、`table` / `idColumn` が `getTableName()` / `getIdColumnName()` と一致すること（`null` は getTableName を持たないサービスだけ）と、access の契約（下記）を確かめる |

`pnpm check registry` が失敗する条件と直し方（メッセージにも出る）:

- 移行前の手書き行（生成ヘッダの無い旧 serviceRegistry.ts に、どの domainEntry.ts からも作られないキー）→ 登録の entity.json の `apiAccess` に移して `pnpm generate domain -- <Domain> --only registry`、または domainEntry.ts（core）/ domainEntry.override.ts（fork が core の access を変える）へ移す。生成ヘッダ付きのファイルから消えるキー（pnpm generate domain -- --delete 後）は正当な除去として通る
- キーの重複 / `drizzleBase.ts`・`firestoreBase.ts` があるのに domainEntry.ts が無い（登録表に載せないドメインは `scripts/structure/registry/serviceRegistry/discover.mjs` の `ENTRY_EXCEPTIONS` に理由付きで。縮むだけの表）/ `storageBindingFor` の第 1 引数（record_type）がキーに無い / 読めない行・許可外の静的 import / override のキーが隣の domainEntry.ts に無い
- `table` / `idColumn`: 無い（生成ドメインは `pnpm generate domain -- <Domain> --only registry`、手書きは service の直後に書く）/ 文字列リテラルと `null` 以外 / 形が物理名でない（空・63 文字超・引用符や空白入り。大文字は通す）/ 片方だけ `null` / **同じ表が 2 つのキーにある**（両方のファイルとキーを出す）。値が実物と同じかは `pnpm check registry` では見ない（`pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs`）

生成器: `scripts/structure/registry/serviceRegistry/{discover,generate,check}.mjs`（plain node。cron の generate / check と同じ 3 分割）。

### access と管理データ操作

`access`（`DomainApiAccessConfig`）= `read` / `write` / `operations`。CRUD 操作は `operations[op]` → `read` / `write` → グローバル既定（admin カテゴリのみ、fail-closed）の順に解決する（`resolveAccessRule`）。

**管理データ操作** `truncateAll` / `export` / `import`（`DOMAIN_DATA_OPERATIONS`）は `operations` に明示したときだけ開く。未指定・不正なら `"none"` で、read / write / 既定には倒れない。登録しただけで全件削除やデータ移行の対象にならないようにするため。管理の各ルートは自分の門（access `{ roleCategories: ["admin"] }`、全件削除は + 本人パスワード）に加えて、この規則を同じ評価器で AND で掛ける（1 つでも拒否なら要求全体を拒否）。

`isGenericApiClosed(access)` = 汎用 CRUD が全操作 `"none"` か(feature gate の検査が「閉じているべき `/api/<domain>`」から除くのに使う)。

### データ操作のコマンド(pnpm ops data)の許可

- 許可: その操作の規則（`resolveAccessRule`）が `"none"` でなければ許す = 管理 API で何かしらのロールに許した操作はコマンドでも許す。`export` / `import` は上の管理データ操作の規則（書かなければ `"none"`）
- fail-closed: 許されても、そのドメインのサービスに関数が無ければ止める（lib/crud を直接呼ばない）。例: user はサービスが `bulkDeleteByIds` を公開しないので `delete` は閉じる、`update` は列を限ったラッパー `userService.bulkUpdate`
- 登録表で引けること（`getService`）は許可ではない。`INTERNAL_ONLY` のドメインは 4 つとも閉じる
- 全ドメインの結果は `pnpm test scripts/structure/registry/dataCommands.test.mts`（user と INTERNAL_ONLY を固定）

### 表示用の写し(entities/display.ts)

- client に出すドメイン設定は `<domain>/entities/display.ts` の `domainDisplay`。`pnpm generate registry` が主の登録の entity.json の許可した項目(`API.md`「表示用の写しの項目」)だけを写す。`pnpm generate domain` の後は `pnpm generate registry`(ずれは `pnpm check registry` が止める)
- 宣言は `export const domainDisplay: DomainDisplay`(リテラル型は持たない)
- 主の登録の無いドメイン(表の無いドメイン、ドメイン名でない登録が複数のドメイン)は写しを持たない(pnpm generate registry は作らない)。client の部品が写しを要るなら、主の登録(登録名 = ドメイン名)を宣言する。`hiddenColumns` は `defineHiddenColumns` と同じ列を宣言する

### 表示の種類の決め方(`presenterFor`)

- 生成器(`scripts/structure/domain/render/presenters`)は `presenterFor` の答えを presenters.ts の式に写すだけ
- 順: 表の `presenter`（`enum` は選択肢が無ければ `string` で確定）→ formInput（数値・文字列・日時・日付）→ 主の集まり → メディア → `string`
- 手書きの presenters.ts の項目は、この答えより優先される（生成後に手で書き換えた項目はそのまま）

### 番人(lint `field-type-guard/no-literal-field-type`)

- 表の外で型名を決め打ちするコードを止める。ずれのバグ(型を足したときの抜け)は表の外の型名の比較・集合からしか生まれないので、構造で止める
- 検出: (a) fieldType 由来の値（`.fieldType`・名前に fieldType を含む変数・`.fieldType` から代入した変数）と文字列の `===` / `!==` / `switch` / `includes` 等 (b) 表のキーのうち一般語でないもの（`stringArray`・`bigint`・`"numeric(10,2)"` 等）を 2 つ以上含む配列・`switch` の case 列。typeof の比較と入力種別（formInput）の名前の集合は通す。詳細: `eslint-rules/field-type-guard.mjs`
- 対象: `src/**/*.{ts,tsx}` と生成器（`scripts/structure/domain`・`scripts/structure/role` の `.mjs`）。対象外: この表（`fields/`）・型名の union（`src/lib/formSuite/Field/types.ts`、表との突き合わせは `pnpm test src/lib/formSuite/FieldRenderer/defaultValueBuilder.test.ts`）・テスト
- 強さ: 上流リポ（`src/lib/CATALOG.md` の先頭の節の持ち主）= error、fork = warn（fork に残る上流の旧版の写しで fork の lint を止めない）
- 直し方: 表の属性と導出関数で引く。答えに要る属性が表に無ければ表に属性を足す。正当な例外は理由付き eslint-disable
- 許可リストは無い(表の外の決め打ち 0)

## Verification

- 登録表: `pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs`
- wiring の目録と向き: `pnpm test src/wiring/wiring.test.mjs`
- 関連選択肢: `pnpm test src/lib/domain/relations/relationOptions.test.mjs`
- domainEntry.ts の生成: `pnpm test scripts/structure/domain/tests/registry.test.mjs`
- 写し: `pnpm test scripts/structure/registry/alpha/domainDisplay.test.mjs`
- コマンドの許可: `pnpm test scripts/structure/registry/dataCommands.test.mts`(user と INTERNAL_ONLY を固定)
- 型の表: `pnpm test src/lib/formSuite/FieldRenderer/defaultValueBuilder.test.ts`(行ごとの答えを literal で固定、union と表のキーの突き合わせ)
- 表示の種類: `pnpm test src/lib/domain/fields/presenterFor.test.mjs`
- 番人: `pnpm test eslint-rules/field-type-guard.test.mjs`

## Related

- 登録表の結び方と import してよい場所: `src/wiring/README.md`
- 生成器: `scripts/structure/registry/README.md`、`scripts/structure/domain/README.md`
