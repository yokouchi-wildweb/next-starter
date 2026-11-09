# src/wiring — 登録表と lib の汎用関数を結ぶ場所

`src/lib` の汎用関数は登録表（`src/registry/*`）を引数で受ける。登録表を引数に渡して結んだ「印なし版」（server 用のそのまま使える関数）を置くのがこのフォルダ。業務コード（features）・部品（components）・lib は wiring を知らない。

**lib は登録表を import しない**（値も型も。引きたい lib は引数・注入で受け、結ぶのはこのフォルダ）。検査は lint `import-boundaries/lib-no-registry`（全 Tier error）。例外の一覧は無い。

汎用 Factory（`src/lib/routeFactory`）も同じ形: 値 import できるのはこのフォルダだけ（lint `import-boundaries/route-factory-via-wiring`）。route とその補助ファイルは `apiRoute.ts` の設定済み版を使う。cron の作り手（`@/lib/cron` の `createCronTaskRoute` / `createCronRoute`）も同じ（lint `import-boundaries/cron-route-via-wiring`、設定済み版は `cronRoute.ts`）。

## 目録（置いてよいファイル）

| ファイル | 結ぶもの | データに届くか |
|---|---|---|
| `apiRoute.ts` | `lib/routeFactory` の汎用版 + 利用者の束（`features/core/auth` の `apiRouteUserDeps`）+ レート制限の束（`features/core/rateLimit` の `apiRouteRateLimitDeps`）+ 端末の束（`features/core/pairedDevice` の `apiRouteDeviceDeps`。端末の機能が閉じている間は `gateDeviceDeps` が端末の認証を「端末なし」にする、テスト `apiRoute.test.mts`）+ 主体の具体の型 + `serviceRegistry` → `createApiRoute` / `createDomainRoute` / `createDomainIdRoute` / `createMeRoute` / `createDeviceRoute` / `enforceAccessRule` / `ownerWhere`（API ルートとその補助ファイルはここから import する） | 届く（serviceRegistry → domainEntry.ts → 遅延 import でサービスに届く） |
| `cronRoute.ts` | `lib/cron` の `createCronTaskRoute` + 門番（`@/featureGate` の `gate.path`）→ `createCronTaskRoute`（cron の `route.ts` はここから import する。タスクの住所 `/api/cron/<name>` が閉じていれば本体を呼ばずに skipped。`src/lib/cron/README.md`） | 届かない |
| `business.ts` | `src/business/business.ts`(fork の値と印 source)+ `lib/business` の `resolveBusiness` → `business` / `businessSource`(受付係。tsconfig.json の `"@/business"` がここを指し、読み手は `@/business` を読む。sample のときは例の値。`src/lib/business/README.md`) | 届かない |
| `domainRegistry.ts` | `serviceRegistry` + `domainConfigMap` → `getService` / `getServiceOrThrow` / `hasService` / `lookupDomainService` / `getJunctionTable` / `findDomainByTable` / `getDomainTable` / `getDomainAccess` / `getDomainList` / `getDomainListWithCount` / `withRecordCounts` / `isValidDomainKey` / `getInvalidDomainKeys` | 届く（registry → domainEntry.ts → 遅延 import でサービスに届く） |
| `domainConfig.ts` | 全ドメインの設定 → `getDomainConfig` / `hasDomainConfig`（server 専用） | 届かない |
| `adminScreenParts.ts` | `serviceRegistry` + `features/core/admin/services/server/screenData` → 管理画面の共通部品の組 `adminListParts` / `adminEditParts` / `adminCreateParts` / `adminSortParts`（各ルートの `_screen/loader.ts` が最寄りの guard.ts の `createLoader` に渡す。access は serviceRegistry の entry から操作ごと。テスト `adminScreenParts.test.mts`） | 届く（registry → domainEntry.ts → 遅延 import でサービスに届く） |
| `pageGuard.ts` | `lib/pageGuard` の汎用版 + 利用者の束（`features/core/auth` の `pageGuardUserDeps`）+ setup 誘導の判定（auth の `hasUserForAccess`）→ `defineRootGuard`（root の `src/app/guard.ts` だけが呼ぶ。子の guard.ts は親の `extend` で作る） | 届く（auth → getSessionUser → DB） |
| `AppProviders.tsx` | アプリ全体の Provider の入れ子（門番 `GateProvider`（root layout が計算した利用者の枠の値を prop `gate` で受ける。`src/featureGate/README.md`）→ Tooltip → reCAPTCHA → 認証セッション `AuthSessionProvider` → 管理コマンド → 画像ビューア → 入力部品 → 未保存の編集の守り `src/app/_layout/unsavedGuard/UnsavedGuardRoot.tsx`（`src/lib/unsavedGuard` + Overlays の Dialog + `src/config/ui/unsaved-guard.config.ts` の文 → 棚の Navigation の口。確認の開閉に state を持つ root の枠のクライアント側の Provider で、この入れ子は server なので中に書けない → 管理コマンドの `AdminCommandRoot` と同じく root の layout の部品に置く。wiring へ戻さない（wiring どうしは import しない））→ fork の口 `src/app/_providers/ForkProviders.tsx`（1 行スイッチ。上流の既定は空の素通し。fork の Provider は `ForkProviders.replace.tsx` に書いてスイッチを向ける、多段は同じ `.replace` を書き換える。`src/app/_providers/README.md`）。root の `src/app/layout.tsx` が 1 か所で描く（server。自分ではデータを取らない） | 届く（AuthSessionProvider → セッション解決。データとセッションを読む場所の名前付き例外） |
| `GoogleTag.tsx` | `lib/googleTag` の `<GoogleTag>`（client）+ 流入経路の判別表（`features/core/userAcquisition/lib/classifyVisit` の `getChannelDefinitions`。招待などの独自のリンクの印を GA4 の `campaign_source` / `campaign_medium` にする）→ `GoogleTag`（server。root の `src/app/layout.tsx` が描き、表はシリアライズできる値として prop で渡る。lib は features を読まないので結ぶのはここ） | 届かない |
| `formInputs/` | 独自の入力部品の一覧 → `src/components/Form` の Provider（`FormInputsRoot.tsx`、受け口 `inputs/`。書き方は `inputs/README.md`） | いいえ |

増やすときは、このテーブルと `wiring.test.mjs` の `WIRING_FILES` に足す。将来の API 用・管理画面用の wiring は自分で登録表を結ぶ（wiring どうしは import しない。共有するのは lib の汎用版と登録表だけ）。

wiring どうしの import の例外は次の 2 つだけ（`pnpm test src/wiring/wiring.test.mjs` の `isReceptacleImport` / `isFormInputsBundleImport` と同じ）:

- 受け口: 生成物 `wiring/<束>.ts` → その束の受け口の項目 `wiring/<束>/<受け口>/…`（受け口 = `wiring/<束>/extensionPoints.ts` が宣言した `dir`）と、同じ受け口の中の項目どうし。項目は fork が足した物を含み、名前に fork の印は付けない。例: 生成物 `dbAgent.ts` → `dbAgent/extraTools/<名前>.ts`・`dbAgent/promptFragments/<名前>.ts`
- 入力部品の束: `AppProviders.tsx` → `formInputs/FormInputsRoot.tsx` と、`formInputs/` の中どうし（受け口 `formInputs/inputs/` の項目を含む）

## fork の wiring

- fork は `src/wiring/<名前>.ts(x)`（client 用は `<名前>.client.tsx`）を足せる（fork が足したファイル = fork の物。名前に fork の印は付けない）。例: fork 独自の主体（店舗の会員など）の API の Factory を、`lib/routeFactory` の汎用版から自分の束で作る
- 目録（`WIRING_FILES` との完全一致）は Tier1 だけで検査する。fork の所有は git の分岐点で `pnpm workflow ownership check` が見る（上流と同じ単位名は unit-clash）。旧い fork の名前の印つきの名前は全 Tier で `pnpm test src/wiring/wiring.test.mjs` が止め、移し方 = 共有の棚の印の移行の notice を案内する
- 向き・データ到達・wiring どうし不可は fork のファイルにも同じに掛かる
- 上流の wiring のファイルを置き換える口（`<対象>.override.ts`）は無い。上流の結び方を変えたいときは `/order <upstream>`
- 差し込む値の束は持ち主のドメインが 1 つ export する（利用者 = `features/core/auth` の `apiRouteUserDeps` 等）。全項目必須

## 向き（import してよい場所）

- `src/app/**`（API ルート・Screen・loader）、`src/proxies/**`、`src/proxy.ts`
- cron のフォルダ `src/app/api/cron/<name>/` では `task.ts` と、1 行の `route.ts` からの `cronRoute.ts` だけ（fork 所有の `task.override.ts` は不可）。task.ts の `run` の中で動的 import する（`const { lookupDomainService } = await import("@/wiring/domainRegistry")`）
- `business.ts` だけは例外: `@/business` の名前で features・app・proxies・scripts(`await import`)と、上書きファイル・古い殻 `src/config/business.config.ts` から読む(データに届かず、`src/business` と `lib/business` だけを読む。lib と utils は読まず値を引数で受ける、設定の議会 D88 K2)
- features / lib / components / registry からは import しない（`domainConfig.ts` も同じ。features の server は自分の domain.json、client は写し entities/display.ts を読む）。lib がドメイン名からサービスを引きたいときは、呼び手（ルート）が wiring の関数を注入する（例: `src/lib/dataMigration` の `services` オプション、`storageObject` の sweep の `lookupService`）

「データに届く wiring」= services/server を値 import する wiring（判定は registry → domainEntry.ts → 遅延 import の鎖も辿る）。src/app の中で import してよい場所は限る（D73 K6。UI の場所はデータを取らない）:

- `loader.ts`・`route.ts`・cron の `task.ts`・`src/app/api/**` の補助ファイル（例 `data-migration/_shared/`）
- `guard.ts` は `@/wiring/pageGuard`（守りの作り手）だけ
- root の `src/app/layout.tsx` は `@/wiring/AppProviders` だけ（データに届くのは中の AuthSessionProvider = 名前付き例外）
- Screen・page.tsx・layout・`_layout/`・`_components/` の部品は不可。`src/proxies/**`・`src/proxy.ts` は既存の契約で可

検査: `pnpm test src/wiring/wiring.test.mjs`（目録・旧い印・向き・鎖・データに届く wiring の import の場所）。受け口の宣言は `src/lib/districtMap/declarations.mjs` で読む。設計の全体は `src/lib/domain/README.md`、API の Factory は `src/lib/routeFactory/README.md`。

## dbAgent

DB 調査エージェントの拡張点は `src/wiring/dbAgent/`(宣言と受け口。fork は祖先の lib の中にファイルを足せない)、一覧は生成物 `dbAgent.ts`。lib は一覧を import しないので、route(`src/app/api/admin/db-agent/route.ts`)が `extensions` で渡す。
