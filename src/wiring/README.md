# src/wiring — 登録表と lib の汎用関数を結ぶ場所

`src/lib` の汎用関数は登録表（`src/registry/*`）を引数で受ける。登録表を引数に渡して結んだ「印なし版」（server 用のそのまま使える関数）を置くのがこのフォルダ。業務コード（features）・部品（components）・lib は wiring を知らない。

**lib は登録表を import しない**（値も型も。引きたい lib は引数・注入で受け、結ぶのはこのフォルダ）。検査は lint `import-boundaries/lib-no-registry`（全 Tier error）。今ある違反は縮むだけの一覧 `eslint-rules/import-boundaries.exceptions.mjs`（upstream の物。fork は足せない。直した出荷で行を消す）。

汎用 Factory（`src/lib/routeFactory`）も同じ形: 値 import できるのはこのフォルダだけ（lint `import-boundaries/route-factory-via-wiring`）。route とその補助ファイルは `apiRoute.ts` の設定済み版を使う。

## 目録（置いてよいファイル）

| ファイル | 結ぶもの | データに届くか |
|---|---|---|
| `apiRoute.ts` | `lib/routeFactory` の汎用版 + 利用者の束（`features/core/auth` の `apiRouteUserDeps`）+ 端末の束（`features/core/pairedDevice` の `apiRouteDeviceDeps`）+ `serviceRegistry` → `createApiRoute` / `createDomainRoute` / `createDomainIdRoute` / `createMeRoute` / `createDeviceRoute` / `enforceAccessRule` / `ownerWhere`（API ルートとその補助ファイルはここから import する） | 届く（serviceRegistry → domainEntry.ts → 遅延 import でサービスに届く） |
| `domains.ts` | `serviceRegistry` + `domainConfigMap` → `getService` / `getServiceOrThrow` / `hasService` / `lookupDomainService` / `findDomainByTable` / `getDomainTable` / `getDomainAccess` / `getDomainList` / `getDomainListWithCount` / `withRecordCounts` / `isValidDomainKey` / `getInvalidDomainKeys`、管理画面の共通部品の組 `adminListParts` / `adminEditParts` / `adminCreateParts` / `adminSortParts`（各ルートの `_screen/loader.ts` が最寄りの guard.ts の `createLoader` に渡す。access は serviceRegistry の entry から操作ごと、取得本体は `features/core/admin/services/server/screenData`。テスト `domains.test.mts`） | 届く（registry → domainEntry.ts → 遅延 import でサービスに届く） |
| `pageGuard.ts` | `lib/pageGuard` の汎用版 + 利用者の束（`features/core/auth` の `pageGuardUserDeps`）+ setup 誘導の判定（auth の `hasUserForAccess`）→ `defineRootGuard`（root の `src/app/guard.ts` だけが呼ぶ。子の guard.ts は親の `extend` で作る） | 届く（auth → getSessionUser → DB） |
| `AppProviders.tsx` | アプリ全体の Provider の入れ子（Tooltip → reCAPTCHA → 認証セッション `AuthSessionProvider` → 管理コマンド → 画像ビューア）。root の `src/app/layout.tsx` が 1 か所で描く（server。自分ではデータを取らない） | 届く（AuthSessionProvider → セッション解決。データとセッションを読む場所の名前付き例外） |

増やすときは、このテーブルと `wiring.test.mjs` の `WIRING_FILES` に足す。将来の API 用・管理画面用の wiring は自分で登録表を結ぶ（wiring どうしは import しない。共有するのは lib の汎用版と登録表だけ）。

## fork の wiring（ドット名）

- fork は `src/wiring/<名前>[.client].<fork ID>.ts(x)` を足せる（fork の物）。例: fork 独自の主体（店舗の会員など）の API の Factory を、`lib/routeFactory` の汎用版から自分の束で作る
- fork ID = `.claude/rules/project.md` の `fork_id:`（自分）+ `.notices/applied/*.md` の台帳名（親の fork）。宣言に無い ID のドット名は `pnpm test:wiring` が止める（読み手: `src/lib/forkOwnership/forkIds.mjs`）
- 向き・データ到達・wiring どうし不可は fork のファイルにも同じに掛かる
- 上流の wiring のファイルを置き換える口（`<対象>.override.ts`）は無い。上流の結び方を変えたいときは `/order <upstream>`
- 差し込む値の束は持ち主のドメインが 1 つ export する（利用者 = `features/core/auth` の `apiRouteUserDeps` 等）。全項目必須

## 向き（import してよい場所）

- `src/app/**`（API ルート・Screen・loader）、`src/proxies/**`、`src/proxy.ts`
- cron のフォルダ `src/app/api/cron/<name>/` では `task.ts` だけ（fork 所有の `override.ts` と 1 行の `route.ts` は不可）。task.ts の `run` の中で動的 import する（`const { lookupDomainService } = await import("@/wiring/domains")`）
- features / lib / components / registry からは import しない。lib がドメイン名からサービスを引きたいときは、呼び手（ルート）が wiring の関数を注入する（例: `src/lib/dataMigration` の `services` オプション、`storageObject` の sweep の `lookupService`）

「データに届く wiring」= services/server を値 import する wiring（判定は registry → domainEntry.ts → 遅延 import の鎖も辿る）。今は同じ場所からだけ import できる。

- `src/app/api/**` の補助ファイル（例 `data-migration/_shared/`）もデータに届く wiring を import してよい

検査: `pnpm test:wiring`（目録・fork のドット名・向き・鎖）。設計の全体は `src/lib/domain/README.md`、API の Factory は `src/lib/routeFactory/README.md`。
