# src/lib/domain — API

## Overview

- src/lib/domain の関数・定数・写しの項目・型の表の参照。仕組みと使い方は `README.md`

## API

### 引く(`src/lib/domain/server`、登録表は引数)

| 関数 | 用途 |
|---|---|
| `hasService(registry, key)` | 同期。キーの有無だけ（サービスは読み込まない） |
| `getService(registry, key)` / `getServiceOrThrow` | 非同期。遅延読み込みしてサービスを返す。未登録は undefined / throw、読み込み失敗は throw |
| `lookupDomainService(registry, key, { require })` | 非同期・throw しない。`found | unregistered | load_failed | unsupported(missing)` を状態で返す。「引けない」と「行なし」を区別したい照合処理用（例: `require: ["searchWithDeleted"]`） |
| `findDomainByTable(registry, tableName)` | 同期・読み込まない。表の物理名 → キー。登録の無い表（中間表・履歴・カウンター・cron の記録など）は `null`。同じ表が 2 キーの登録表（pnpm check registry を通っていない）では throw |
| `getDomainTable(registry, key)` | 同期・読み込まない。キー → `{ table, idColumn }`。未登録と Firestore 版は `null` |
| `getDomainList(registry, configMap)` / `getDomainListWithCount` / `withRecordCounts` / `isValidDomainKey` / `getInvalidDomainKeys` | 全件削除の一覧（access の評価は呼び手）。`getDomainList` はサービスを読み込まず、`table` を持つ行（= Drizzle 版 = truncateAll あり）で作る。読み込めないドメインも一覧に出るが、実行の直前の `isValidDomainKey` / `getInvalidDomainKeys` はサービスを読み込んで truncateAll を確かめる |

戻りの型 `DomainService` は createCrudService の操作の構造型（全 optional）。Drizzle 版は `getTableName()`（表の物理名）と `getIdColumnName()`（主キー列の物理名）を持つ。主キーの論理名は常に `CRUD_ID_FIELD = "id"`（`@/lib/crud`）。表そのものは公開しない。Firestore 版（凍結）は `truncateAll` / `getTableName` / `getIdColumnName` を持たない。

- 登録表を結んだ版は `src/wiring/domainRegistry.ts`(import してよい場所は `src/wiring/README.md`)。lib が引きたいときは呼び手が注入する(`src/lib/dataMigration` の `services`、storageObject の sweep の `lookupService`)

### access のプリセット(`src/lib/domain/accessPresets.ts`)

- lib/domain の公開の定数(上書きできる設定ではない)。既定 `DEFAULT_ACCESS_RULE`(admin カテゴリだけ)は access の書き漏れの fail-closed

| 名前 | 意味 |
|---|---|
| `ADMIN_ONLY` / `PUBLIC_READ` / `ADMIN_OR_DEBUGGER` | 汎用 API の read / write |
| `INTERNAL_ONLY` | read / write とも `"none"`。登録表には載せる（サーバー内部で引ける）が、汎用 API・全件削除・データ移行には出さない |
| `ADMIN_RULE` / `ADMIN_OR_DEBUGGER_RULE` | 単一ルール（`operations` の上書きに） |
| `ADMIN_DATA_OPERATIONS` | `{ truncateAll, export, import }` を管理者に開く断片。`{ ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS }` / import だけ閉じるなら `operations: { ...ADMIN_DATA_OPERATIONS, import: "none" }` |

`isGenericApiClosed(access)` = 汎用 CRUD が全操作 `"none"` か（feature gate の検査が「閉じているべき `/api/<domain>`」から除くのに使う）。

### データ操作のコマンドの対応(`definition/dataCommand.ts`)

- `resolveDataCommand(access, command, service)` が、そのドメインでコマンドが許されるか・どのサービスの関数を呼ぶかを決める
- 対応: `export` → 操作 `export` / 関数 `search`、`import` → `import` / `bulkUpsert`、`update` → `bulkUpdate` / `bulkUpdate`、`delete` → `bulkDeleteByIds` / `bulkDeleteByIds`（`DATA_COMMAND_OPERATIONS`）
- 上書きの欄 `access.commands`（`{ export?, import?, update?, delete? }` = `"allow"` | `"deny"`）: API とコマンドで範囲を変えたいドメインだけ書く。core は `domainEntry.ts`（fork が core を変えるなら `domainEntry.override.ts`）、業務ドメインは domain.json の `apiAccess.commands`（`pnpm generate domain` が `domainEntry.ts` に写す）

### 表示用の写しの項目(`entities/display.ts` の `domainDisplay`、型 `DomainDisplay` は `types/display.ts`)

- top: singular・plural・label・fields・relations・searchFields・useCreatedAt・useUpdatedAt・useSoftDelete・useImportExport・sortOrderField・fieldGroups（key・label・fields・collapsible・defaultCollapsed・bgColor）・tableFields
- field: name・label・fieldType・formInput・options・required・readonly・defaultValue・displayType・placeholder・accept・validationRule・reorderable・helperText
- relation: domain・label・fieldName・fieldType・relationType・required・formInput・labelField・includeRelationTable。非同期検索の関連には関連先の searchFields
- 写さない: defaultOrderBy・metadataBinding・uploadPath・field の description・apiAccess・dbEngine・generateFiles・storage ほか一覧の外。domain.json にキーを足しても client には出ない（fork だけのキーも同じ）
- 列名を持つ項目（fields・searchFields・tableFields・sortOrderField・fieldGroups[].fields・relations.fieldName）は、Firestore なら camelCase にし、hiddenColumns の列を除く。隠し列を指す関連は写さない

宣言は `export const domainDisplay: DomainDisplay`（リテラル型は持たない）。

### 関数のありか

- `definition/`: `createDomainConfigLookup`、`normalizeDomainJsonConfig`、`resolveAccessRule`
- `relations/`: 写しを受ける関数、関連選択肢（`relationOptions.mjs`）
- `fields/`: `extractFields` / `extractImageFields`、型（fieldType）の表 `fieldTypes.mjs`
- `junction/`: 中間表の名前解決（utils は client 可、`getJunctionTable(tables, name)` は server-only で表の一覧を引数で受ける。結んだ版は `src/wiring/domainRegistry.ts` の `getJunctionTable(name)`）
- `hooks/` `service/client/`: 管理画面の全件削除一覧（`useFetchDomains`）

### 型(fieldType)の表: `fields/fieldTypes.mjs`

- domain.json の項目の型の意味(列関数・Zod・TS 型・フォームの初期値・checkbox の単複・日時か・廃止か)を決める表 1 つ。生成器(`scripts/structure/domain/spec/fieldTypes.mjs` は再 export)も実行時(`buildFormDefaultValues`・`isCheckGroupFieldType`)も `fieldTypeSpec(type)` と導出関数(`isArrayFieldType`・`isMediaFieldType` 等)でここを引く。属性の意味は表の頭のコメント
- 表に無い型は未知型(生成器は型名をそのまま列関数に出して警告、フォームの初期値は `""`、日時変換も複数選択もしない)
- `.mjs` なのは node の生成器と TypeScript の両方から import するため(`relationOptions.mjs` と同じ)

### 表示の種類: `fields/presenterFor.mjs`

- `presenterFor(field)` が項目の表示の種類 `{ kind, options? }` を返す(kind = `boolean`・`number`・`stringArray`・`enum`(選択肢つき)・`string`・`datetime`・`date`・`collectionThumbnails`・`mediaThumbnail`)
