# src/lib/domain — API

## Overview

- src/lib/domain の関数・定数・写しの項目・型の表の参照。仕組みと使い方は `README.md`

## API

### 引く(入口 `@/lib/domain/server`、登録表は引数)

| 関数 | 用途 |
|---|---|
| `hasService(registry, key)` | 同期。キーの有無だけ（サービスは読み込まない） |
| `getService(registry, key)` / `getServiceOrThrow` | 非同期。遅延読み込みしてサービスを返す。未登録は undefined / throw、読み込み失敗は throw |
| `lookupDomainService(registry, key, { require })` | 非同期・throw しない。`found | unregistered | load_failed | unsupported(missing)` を状態で返す。「引けない」と「行なし」を区別したい照合処理用（例: `require: ["searchWithDeleted"]`） |
| `findDomainByTable(registry, tableName)` | 同期・読み込まない。表の物理名 → キー。登録の無い表（中間表・履歴・カウンター・cron の記録など）は `null`。同じ表が 2 キーの登録表（pnpm check registry を通っていない）では throw |
| `getDomainTable(registry, key)` | 同期・読み込まない。キー → `{ table, idColumn }`。未登録と Firestore 版は `null` |
| `getDomainList(registry, configMap)` / `getDomainListWithCount` / `withRecordCounts` / `isValidDomainKey` / `getInvalidDomainKeys` | 全件削除の一覧（access の評価は呼び手）。`getDomainList` はサービスを読み込まず、`table` を持つ行（= Drizzle 版 = truncateAll あり）で作る。読み込めないドメインも一覧に出るが、実行の直前の `isValidDomainKey` / `getInvalidDomainKeys` はサービスを読み込んで truncateAll を確かめる |

戻りの型 `DomainService` は createCrudService の操作の構造型（全 optional）。Drizzle 版は `getTableName()`（表の物理名）と `getIdColumnName()`（主キー列の物理名）を持つ。主キーの論理名は常に `CRUD_ID_FIELD = "id"`（この lib の "."）。表そのものは公開しない。Firestore 版（凍結）は `truncateAll` / `getTableName` / `getIdColumnName` を持たない。

- 登録表を結んだ版は `src/wiring/domainRegistry.ts`(import してよい場所は `src/wiring/README.md`)。lib が引きたいときは呼び手が注入する(`src/lib/dataMigration` の `services`、storageObject の sweep の `lookupService`)

### access のプリセット(別の閉じた lib `@/lib/domainAccess`、`src/lib/domainAccess/accessPresets.ts`)

- domainAccess の公開の定数(上書きできる設定ではない)。access の型(`DomainApiAccessConfig` ほか)と操作名(`DOMAIN_DATA_OPERATIONS` ほか)も domainAccess。domainEntry.ts が値で読むので値だけのファイルで作る(`src/lib/domainAccess/README.md`)。既定 `DEFAULT_ACCESS_RULE`(admin カテゴリだけ)は access の書き漏れの fail-closed

| 名前 | 意味 |
|---|---|
| `ADMIN_ONLY` / `PUBLIC_READ` / `ADMIN_OR_DEBUGGER` | 汎用 API の read / write |
| `INTERNAL_ONLY` | read / write とも `"none"`。登録表には載せる（サーバー内部で引ける）が、汎用 API・全件削除・データ移行には出さない |
| `ADMIN_RULE` / `ADMIN_OR_DEBUGGER_RULE` | 単一ルール（`operations` の上書きに） |
| `ADMIN_DATA_OPERATIONS` | `{ truncateAll, export, import }` を管理者に開く断片。`{ ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS }` / import だけ閉じるなら `operations: { ...ADMIN_DATA_OPERATIONS, import: "none" }` |

`isGenericApiClosed(access)`(`@/lib/domain`)= 汎用 CRUD が全操作 `"none"` か（feature gate の検査が「閉じているべき `/api/<domain>`」から除くのに使う）。

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

### 項目の型(`types/domainField.ts`)

- `DomainField` = domain.json の項目 1 つ。キーの正は `scripts/structure/domain/spec/domainJson.mjs` の `FIELD_KEYS`(`$comment` を除く)で、型はここ 1 か所。値は domain.json に書ける素の値だけ(関数・実行時だけの値・登録した入力部品の名前への広げは formSuite の `FieldConfig`)
- `fieldType` は表の名前(`FieldTypeName`)を案内しつつ表に無い名前も受ける(未知型)。`formInput` は組み込みの名前(`BuiltinFormInput`)と登録した名前
- 項目のキーを持つ型はここから作る: `DomainConfig` の `fields` = `DomainField` そのもの(別名の型は作らない)、`DomainDisplayField` = client に出すキーの `Pick`(`fieldType` は省ける)、`DomainFieldInfo` = name・label・fieldType・formInput の `Pick`。新しい型でキーを写し直さない
- 関連の型: `DomainConfigRelation`(`types/domainConfig.ts`) = domain.json の関連 1 つ(キーの正は `RELATION_KEYS`、onDelete を含む)。client の写しの `DomainDisplayRelation` = それから onDelete を除き searchFields を足したもの。関連のキーを持つ型(プロフィールの関連・一覧の列)もここから作る
- `DomainFieldOption` = 選択肢 1 つ(value・label・disabled)。`getFieldOptions` が返す形。domain.json に書いた選択肢は `DomainFieldOptionValue`(値の型を決め打ちしない)
- 型名の union(`fields/fieldTypeNames.ts`、型だけ): `FieldTypeName`(表のキー)・`NeonFieldType` / `FirestoreFieldType`(`fieldFormInputs.mjs` の DB ごとの表のキー)・`BuiltinFormInput`(`formInputs.mjs`)。表から導くので名前を手で並べない(CLAUDE.md field_types)

### 入口と関数のありか

- 入口は 3 つ(`package.json`): `.` = `@/lib/domain`(client でも server でも読める: 型・写しを受ける関数・定義の読み方・型の表と入力種別の表と表示の答え・主キーの論理名 `CRUD_ID_FIELD`・日時の schema・値の表示 `format*` と `FieldPresenter`・中間表の名前・管理画面のパス `getAdminPaths` / `AdminPaths`。React の値・hooks・HTTP の client は無い)、`./server` = `@/lib/domain/server`(登録表から引く関数・`getJunctionTable`)、`./node` = `node.mjs`(Next の外のプログラムが読む `.mjs` 5 つ: `fieldTypes`・`fieldFormInputs`・`formInputs`・`presenterFor`・`relationOptions`。scripts・eslint-rules からは相対で `src/lib/domain/node.mjs`)
- 外から下の中のファイルは読まない(lint `entry/only-entries`)。下はフォルダの中の置き場

- `definition/`: `createDomainConfigLookup`、`normalizeEntityDeclaration`、`resolveAccessRule`
- `relations/`: 写しを受ける関数、関連選択肢（`relationOptions.mjs`）
- `fields/`: `extractFields` / `extractImageFields`、型（fieldType）の表 `fieldTypes.mjs`、主キーの論理名 `idField.ts`、日時の schema `datetimeSchema.ts`、値の表示 `formatters.ts`(生成した presenters.ts が読む。`FieldPresenter` の戻りの型だけ react を型で読む)
- `routes/`: 管理画面のパス `getAdminPaths(slugPlural)` → `AdminPaths`(list / new / detail(id) / edit(id))
- `junction/`: 中間表の名前解決（utils は client 可、`getJunctionTable(tables, name)` は server-only で表の一覧を引数で受ける。結んだ版は `src/wiring/domainRegistry.ts` の `getJunctionTable(name)`）

### 型(fieldType)の表: `fields/fieldTypes.mjs`

- domain.json の項目の型の意味(列関数・Zod・TS 型・フォームの初期値・checkbox の単複・日時か・廃止か)を決める表 1 つ。生成器(`scripts/structure/domain/spec/fieldTypes.mjs` は再 export)も実行時(`buildFormDefaultValues`・`isCheckGroupFieldType`)も `fieldTypeSpec(type)` と導出関数(`isArrayFieldType`・`isMediaFieldType` 等)でここを引く。属性の意味は表の頭のコメント
- 表に無い型は未知型(生成器は型名をそのまま列関数に出して警告、フォームの初期値は `""`、日時変換も複数選択もしない)
- `.mjs` なのは node の生成器と TypeScript の両方から import するため(`relationOptions.mjs` と同じ)

### 表示の種類: `fields/presenterFor.mjs`

- `presenterFor(field)` が項目の表示の種類 `{ kind, options? }` を返す(kind = `boolean`・`number`・`stringArray`・`enum`(選択肢つき)・`string`・`datetime`・`date`・`collectionThumbnails`・`mediaThumbnail`)

### 宣言を読む(入口 `./declarations`・`./node`、`definition/readDomain.mjs`・`definition/declaration.mjs`・`definition/nodeDomainSource.mjs`)

`./declarations` はファイルを開かない素の JS(source を渡して読む。地区の地図 src/lib/districtMap からも使う)。`./node` は同じ物 + `nodeDomainSource`

| 関数・定数 | 用途 |
|---|---|
| `nodeDomainSource(repoRoot)`(`./node` だけ) | 今の木を node:fs で読む source(`{ listDir, readText }`、地区の地図の source と同じ形。git の木を読む source も渡せる) |
| `listDomains(source)` | `{ domains: { name, core, dir }[], problems }`。src/domains 直下(業務)と src/domains/core 直下(core)のフォルダ、`_` で始まる物は除く。domain.json の有無で選ばない。業務と core の重なりは problems |
| `readDomain(source, name)` | `{ name, core, dir, domain, registrations: { name, dir, entity }[], problems }`。domain.json と entities/<登録名>/entity.json だけを読む。読めない宣言は `null` と problems |
| `readDomains(source)` | 全部のドメインの `readDomain`(listDomains の順) |
| `primaryRegistrationOf(declaration)` | 主の登録: 登録名 = ドメイン名の物、無ければ登録がちょうど 1 つの時のそれ、ほかは `null`(生成器の config・表示の写し・登録表の 1 ドメイン 1 行が読む) |
| `findRegistration(declarations, name)` | 名前の登録をどのドメインからでも(関連の先 `relations[].domain` は登録名)。`{ declaration, registration }` か `null` |
| `isGeneratedRegistration(registration)` | 生成器が書く登録か(entity.json の `generate`、省略 = true、D337) |
| `DOMAIN_KEYS` / `ENTITY_KEYS`(= `ENTITY_TABLE_KEYS` + `ENTITY_REGISTRATION_KEYS` + `$comment`) | 宣言の鍵の集合。表の鍵 `ENTITY_TABLE_KEYS` = 今の形と同じ意味の `TABLE_KEYS` + 手で持つ表の形の `TABLE_SHAPE_KEYS`。登録の鍵 = `generate`・`registered`・`reason`・`requires`・`service` |
| `ENTITY_NESTED_KEYS` と中の集合(`FIELD_KEYS`・`RELATION_KEYS`・`COLUMN_KEYS`・`INDEX_KEYS`・`PRIMARY_KEY_KEYS`・`FOREIGN_KEY_KEYS`・`CHECK_KEYS`・`ENUM_KEYS`・`DB_OBJECT_KEYS` ほか)・値の集合(`DB_ENGINES`・`ID_TYPES`・`RELATION_TYPES`・`ON_DELETE_VALUES`・`IDENTITY_VALUES`・`DB_OBJECT_KINDS`) | 入れ子の鍵の表(readDomain が歩く)。今の形の語彙 scripts/structure/domain/spec/domainJson.mjs もここから組む |
| `DOMAIN_DECLARATION_FILE` / `ENTITIES_DIR` / `ENTITY_DECLARATION_FILE` / `DOMAIN_DECLARATION_VERSION` | 置き場の名前("domain.json"・"entities"・"entity.json")と形の版("2.0") |
| `ENTITY_FILE_KINDS` | 登録のフォルダの表のファイルの種類(drizzle・schema・form・model)。entities/ の下で entity.json かこの種類のファイルを持つフォルダが登録(役割の表 profiles/ などは登録でない) |
