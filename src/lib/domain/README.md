# src/lib/domain — domain.json の読み取りと、ドメイン名からサービス・表・主キーを引く仕組み

`domain.json` の設定（フィールド・リレーション・中間表）を読む純関数群と、**登録表（serviceRegistry）からドメイン名でサービス・表・主キーを引く正式な仕組み**の汎用部分を持つ。ここの関数は登録表を import せず引数で受ける（lib から新しく登録表を import しない。既存の例外と規則は `src/wiring/README.md`）。登録表を結んだそのまま使える関数は `src/wiring/domains.ts`。

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
import { INTERNAL_ONLY } from "@/config/app/domain-api-access.config";

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
- `table` / `idColumn` は型で必須（`string | null`）。service の直後に、**文字列リテラルか `null` で**書く（生成器はファイルを文字として読むので、定数・式は `registry:check` が失敗にする）。表を持たない Firestore 版は両方 `null`
- 静的 import してよいのは `@/lib/domain/types` と `@/config/app/domain-api-access.config`（プリセット）だけ。`pnpm registry:check` が縛る
- 業務ドメイン: `dc:generate` が domain.json から生成する（`generateFiles.registry`。手で直すなら registry を false）。access = `apiAccess`（無ければ ADMIN_ONLY）+ `truncateAll` は管理者 + `export` / `import` は `useImportExport` が偽なら `"none"`、それ以外は管理者。`table` = 表の定義の生成器と同じ決め方（`scripts/domain-config/utils/tableName.mjs` の `domainTableName` = domain.json の `plural`、無ければドメイン名の snake_case）、`idColumn` = `"id"`、dbEngine が Firestore なら両方 `null`
- core ドメイン・fork が手書きする domainEntry.ts（core パスのドメイン、`generateFiles.registry: false`）: `table` / `idColumn` も自分で書く。値の正しさは `pnpm test:service-registry` が実物と比べる。core のファイルは fork が編集しない
- fork が core の access を変える: 隣に `domainEntry.override.ts`（fork 所有）。`export const domainEntryOverrides = { <key>: <access> } satisfies DomainEntryOverrides` で access を丸ごと置き換える。生成器が読む

### 生成と検査

| コマンド | 何をするか |
|---|---|
| `pnpm registry:generate` | 全 domainEntry.ts（+ override）を走査して `src/registry/serviceRegistry.ts` を丸ごと生成する。`dc:generate` / `dc:delete` の最後にも自動で走る。2 回続けて実行しても差分は出ない |
| `pnpm registry:check` | 生成物との一致と静的検査。`pnpm build` の冒頭で環境に依らず必ず走る（`pnpm test:service-registry` でも） |
| `pnpm test:service-registry` | 上に加えて、全エントリを実際に読み込み、`table` / `idColumn` が `getTableName()` / `getIdColumnName()` と一致すること（`null` は getTableName を持たないサービスだけ）と、access の契約（下記）を確かめる |

`registry:check` が失敗する条件と直し方（メッセージにも出る）:

- 移行前の手書き行（生成ヘッダの無い旧 serviceRegistry.ts に、どの domainEntry.ts からも作られないキー）→ domain.json の `apiAccess` に移して `pnpm dc:generate <Domain> --yes --only registry`、または domainEntry.ts（core）/ domainEntry.override.ts（fork が core の access を変える）へ移す。生成ヘッダ付きのファイルから消えるキー（dc:delete 後）は正当な除去として通る
- キーの重複 / `drizzleBase.ts`・`firestoreBase.ts` があるのに domainEntry.ts が無い（登録表に載せないドメインは `scripts/registry/serviceRegistry/discover.mjs` の `ENTRY_EXCEPTIONS` に理由付きで。縮むだけの表）/ `storageBindingFor` の第 1 引数（record_type）がキーに無い / 読めない行・許可外の静的 import / override のキーが隣の domainEntry.ts に無い
- `table` / `idColumn`: 無い（生成ドメインは `pnpm dc:generate <Domain> --yes --only registry`、手書きは service の直後に書く）/ 文字列リテラルと `null` 以外 / 形が物理名でない（空・63 文字超・引用符や空白入り。大文字は通す）/ 片方だけ `null` / **同じ表が 2 つのキーにある**（両方のファイルとキーを出す）。値が実物と同じかは `registry:check` では見ない（`test:service-registry`）

生成器: `scripts/registry/serviceRegistry/{discover,generate,check}.mjs`（plain node。cron の generate / check と同じ 3 分割）。

### access と管理データ操作

`access`（`DomainApiAccessConfig`）= `read` / `write` / `operations`。CRUD 操作は `operations[op]` → `read` / `write` → グローバル既定（admin カテゴリのみ、fail-closed）の順に解決する（`resolveAccessRule`）。

**管理データ操作** `truncateAll` / `export` / `import`（`DOMAIN_DATA_OPERATIONS`）は `operations` に明示したときだけ開く。未指定・不正なら `"none"` で、read / write / 既定には倒れない。登録しただけで全件削除やデータ移行の対象にならないようにするため。管理の各ルートは自分の門（admin + 本人パスワード / `requireAdmin`）に加えて、この規則を同じ評価器で AND で掛ける（1 つでも拒否なら要求全体を拒否）。

プリセット（`src/config/app/domain-api-access.config.ts`）:

| 名前 | 意味 |
|---|---|
| `ADMIN_ONLY` / `PUBLIC_READ` / `ADMIN_OR_DEBUGGER` | 汎用 API の read / write |
| `INTERNAL_ONLY` | read / write とも `"none"`。登録表には載せる（サーバー内部で引ける）が、汎用 API・全件削除・データ移行には出さない |
| `ADMIN_RULE` / `ADMIN_OR_DEBUGGER_RULE` | 単一ルール（`operations` の上書きに） |
| `ADMIN_DATA_OPERATIONS` | `{ truncateAll, export, import }` を管理者に開く断片。`{ ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS }` / import だけ閉じるなら `operations: { ...ADMIN_DATA_OPERATIONS, import: "none" }` |

`isGenericApiClosed(access)` = 汎用 CRUD が全操作 `"none"` か（feature gate の検査が「閉じているべき `/api/<domain>`」から除くのに使う）。

### 引く（`src/lib/domain/server`、登録表は引数）

| 関数 | 用途 |
|---|---|
| `hasService(registry, key)` | 同期。キーの有無だけ（サービスは読み込まない） |
| `getService(registry, key)` / `getServiceOrThrow` | 非同期。遅延読み込みしてサービスを返す。未登録は undefined / throw、読み込み失敗は throw |
| `lookupDomainService(registry, key, { require })` | 非同期・throw しない。`found | unregistered | load_failed | unsupported(missing)` を状態で返す。「引けない」と「行なし」を区別したい照合処理用（例: `require: ["searchWithDeleted"]`） |
| `findDomainByTable(registry, tableName)` | 同期・読み込まない。表の物理名 → キー。登録の無い表（中間表・履歴・カウンター・cron の記録など）は `null`。同じ表が 2 キーの登録表（registry:check を通っていない）では throw |
| `getDomainTable(registry, key)` | 同期・読み込まない。キー → `{ table, idColumn }`。未登録と Firestore 版は `null` |
| `getDomainList(registry, configMap)` / `getDomainListWithCount` / `withRecordCounts` / `isValidDomainKey` / `getInvalidDomainKeys` | 全件削除の一覧（access の評価は呼び手）。`getDomainList` はサービスを読み込まず、`table` を持つ行（= Drizzle 版 = truncateAll あり）で作る。読み込めないドメインも一覧に出るが、実行の直前の `isValidDomainKey` / `getInvalidDomainKeys` はサービスを読み込んで truncateAll を確かめる |

戻りの型 `DomainService` は createCrudService の操作の構造型（全 optional）。Drizzle 版は `getTableName()`（表の物理名）と `getIdColumnName()`（主キー列の物理名）を持つ。主キーの論理名は常に `CRUD_ID_FIELD = "id"`（`@/lib/crud`）。表そのものは公開しない。Firestore 版（凍結）は `truncateAll` / `getTableName` / `getIdColumnName` を持たない。

登録表を結んだ版は `src/wiring/domains.ts`（import してよい場所は `src/wiring/README.md`）。lib が引きたいときは呼び手が注入する（`src/lib/dataMigration` の `services`、storageObject の sweep の `lookupService`）。

表 ↔ ドメインの逆引きの他の利用候補（auditLog の `target_type` の値をドメイン名に揃える、feature-gate の `tables` を登録表と照らす、中間表の名前解決 `junction/` との役割分担）は、まだ対応していない。使うときは、機能ごとの対応表を作らずこの 2 関数を引く。

## domain.json の読み取り（従来どおり）

- `config/`: `getDomainConfig` / `hasDomainConfig`（`domainConfigRegistry` を読む）、`resolveAccessRule`
- `relations/`: `getRelations` / `getHasManyRelations`、関連選択肢（`relationOptions.mjs`）
- `fields/`: `extractFields` / `extractImageFields`
- `junction/`: 中間表の名前解決（utils は client 可、`getJunctionTable` は server-only）
- `hooks/` `service/client/`: 管理画面の全件削除一覧（`useFetchDomains`）

テスト: `pnpm test:service-registry`（登録表）、`pnpm test:wiring`（wiring の目録と向き）、`pnpm test:relation-options`、`pnpm test:dc-registry`（domainEntry.ts の生成）。
