# src/wiring — 登録表と lib の汎用関数を結ぶ場所

## Overview

`src/lib` の汎用関数は登録表（`src/registry/*`）を引数で受ける。登録表を引数に渡して結んだ「印なし版」（server 用のそのまま使える関数）を置くのがこのフォルダ。業務コード（features）・部品（components）・lib は wiring を知らない。

**lib は登録表を import しない**（値も型も。引きたい lib は引数・注入で受け、結ぶのはこのフォルダ）。検査は lint `import-boundaries/lib-no-registry`（全 Tier error）。例外の一覧は無い。

汎用 Factory（`src/lib/routeFactory`）も同じ形: 値 import できるのはこのフォルダだけ（lint `import-boundaries/route-factory-via-wiring`）。route とその補助ファイルは `apiRoute.ts` の設定済み版を使う。cron の作り手（`@/lib/cron` の `createCronTaskRoute` / `createCronRoute`）も同じ（lint `import-boundaries/cron-route-via-wiring`、設定済み版は `cronRoute.ts`）。

## Usage

### 向き（import してよい場所）

- `src/app/**`（API ルート・Screen・loader）、`src/proxies/**`、`src/proxy.ts`
- `src/instrumentation.ts`（Next の instrumentation の入口）は失敗の記録の結び目 `@/wiring/serverErrorReport` と起動時の処理の結び目 `@/wiring/startup`（どちらも生成物）だけ
- cron のフォルダ `src/app/api/cron/<name>/` では `task.ts` と、1 行の `route.ts` からの `cronRoute.ts` だけ（fork 所有の `task.override.ts` は不可）。task.ts の `run` の中で動的 import する（`const { lookupDomainService } = await import("@/wiring/domainRegistry")`）
- `business.ts` だけは例外: `@/business` の名前で features・app・proxies・scripts(`await import`)と、上書きファイル(`src/config/lib/{mail,url,metadata}.config.ts` ほか)から読む(データに届かず、`src/business` と `lib/business` だけを読む。lib と utils は読まず値を引数で受ける)
- features / lib / components / registry からは import しない（`domainConfig.ts` も同じ。features の server は自分の domain.json、client は写し entities/display.ts を読む）。lib がドメイン名からサービスを引きたいときは、呼び手（ルート）が wiring の関数を注入する（例: `src/lib/dataMigration` の `services` オプション、`storageObject` の sweep の `lookupService`）

「データに届く wiring」= services/server を値 import する wiring（判定は registry → domainEntry.ts → 遅延 import の鎖も辿る）。src/app の中で import してよい場所は限る（UI の場所はデータを取らない）:

- `loader.ts`・`route.ts`・cron の `task.ts`・`src/app/api/**` の補助ファイル（例 `data-migration/_shared/`）
- `guard.ts` は `@/wiring/pageGuard`（守りの作り手）だけ
- root の `src/app/layout.tsx` は `@/wiring/AppProviders` だけ（データに届くのは中の AuthSessionProvider = 名前付き例外）
  - `AppProviders` は Suspense の外で描かれ、殻（build で焼く最初の HTML）に入る。中の Provider は本体で request（セッション・URL）を読まず、読む部分は Suspense の内側の子に置く。枠と本文（children）は AppProviders の内側の Suspense で request ごとに流し込む
- Screen・page.tsx・layout・`_layout/`・`_components/` の部品は不可（データに届かない `screen.tsx` の画面の作り手は Screen が読む）。`src/proxies/**`・`src/proxy.ts` は既存の契約で可

## API

### 目録（置いてよいファイル）

- `apiRoute.ts`: データに届くか = 届く（serviceRegistry → domainEntry.ts → 遅延 import でサービスに届く）
  - `lib/routeFactory` の汎用版 + 生成物 `routeFactory.ts` の 3 つの点の項目を門番 `gate.plugs` で絞った物: 利用者の束 `routeFactoryUser`（ちょうど 1 つ、上流は `domains/core/auth`）・レート制限の束 `routeFactoryRateLimit`（ちょうど 1 つ、上流は `domains/core/rateLimit`）・端末の束 `routeFactoryDevice`（0〜1 個、上流は `domains/core/pairedDevice`。閉じて外れたら lib の「端末なし」、テスト `src/lib/routeFactory/noDevice.test.mts`）
  - + 主体の具体の型（一覧の `<点>Map` の型から `@/lib/routeFactory` の取り出しの型で導く。ドメインを読まない）+ `serviceRegistry` → `createApiRoute` / `createDomainRoute` / `createDomainIdRoute` / `createMeRoute` / `createDeviceRoute` / `enforceAccessRule` / `ownerWhere`（API ルートとその補助ファイルはここから import する）
  - + 想定外の失敗(500)の口 `serverError` → 生成物 `serverErrorReport.ts` の `serverErrorReport.report`（scope api、name = operation）
  - + メンテナンスの口 `maintenance` → 生成物 `routeFactory.ts` の点 `routeFactoryMaintenance`（0〜1 個、上流は `domains/core/setting` の項目。空ならメンテナンスで止めない。期間中の書き込みのメソッドを 503 で止める。`src/lib/routeFactory/README.md`「メンテナンス中の書き込みの停止」）
  - テスト `routeFactory.test.mts`: Factory の契約（主体の解き方・allowStatuses・拒否の body・DomainError）を、汎用版に本物の認可の判定（`domains/core/auth` の `evaluateApiAccessRule`）を差し込んで回す。閉じた lib は features を読めず、汎用版を値で読めるのは wiring だけ（lint `route-factory-via-wiring`）なのでここに置く
- `cronRoute.ts`: データに届くか = 届く（生成物 `cron.ts` の項目 → 設定の DB の読み。import してよいのは cron の `route.ts`）
  - `lib/cron` の `createCronTaskRoute` + 門番（`@/featureGate` の `gate.path`）→ `createCronTaskRoute`（cron の `route.ts` はここから import する。タスクの住所 `/api/cron/<name>` が閉じていれば本体を呼ばずに skipped。`src/lib/cron/README.md`）
  - + メンテナンスの口 `maintenance` → 生成物 `cron.ts` の点 `cronMaintenance`（0〜1 個、上流は `domains/core/setting` の項目。空ならメンテナンスで飛ばさない。期間中は `maintenance: "pass"` でないタスクを skipped。`src/lib/cron/README.md` Internals「メンテナンス」）
  - + 失敗したタスクの口 `onServerError` → 生成物 `serverErrorReport.ts` の `serverErrorReport.report`（scope cron、name = タスク名、extra ok:false・durationMs）
- `expiryPrune.ts`: データに届くか = 届く（`@/lib/cron/server` の本物の表で期限の行を消す。import してよいのは cron `expiry-prune` の `task.ts`）
  - `lib/cron` の `runExpiryRules` + 生成物 `cron.ts` の点 `expiryRules` の項目を門番 `gate.plugs` で絞った物 + 本物の表 `drizzleExpiryStore` → `runExpiryPrune({ checkpoint, budgetMs? })`(締切は既定 240 秒の予算からここで作る。印は task.ts が `@/domains/cronCheckpoint` から渡す。`src/lib/cron/README.md` Internals「期限の削除の 1 本」)
- `business.ts`: データに届くか = 届かない
  - `src/business/business.ts`(fork の値と印 source)+ `lib/business` の `resolveBusiness` → `business` / `businessSource`(受付係。tsconfig.json の `"@/business"` がここを指し、読み手は `@/business` を読む。sample のときは例の値。`src/lib/business/README.md`)
- `domainRegistry.ts`: データに届くか = 届く（registry → domainEntry.ts → 遅延 import でサービスに届く）
  - `serviceRegistry` + `domainConfigMap` → `getService` / `getServiceOrThrow` / `hasService` / `lookupDomainService` / `getJunctionTable` / `findDomainByTable` / `getDomainTable` / `getDomainAccess` / `getDomainList` / `getDomainListWithCount` / `withRecordCounts` / `isValidDomainKey` / `getInvalidDomainKeys`
- `domainConfig.ts`: データに届くか = 届かない
  - 全ドメインの設定 → `getDomainConfig` / `hasDomainConfig`（server 専用）
- `pageGuard.ts`（生成物）: データに届くか = 届く（項目の利用者の束 → auth → getSessionUser → DB）
  - ページの守りの利用者の束の一覧 `pageGuardUser`（ちょうど 1 つ、上流は `domains/core/auth` の 1 行スイッチ、差替点 `authPageGuardUser`）+ `lib/pageGuard` の `wirePageGuard`（型引数 `PageGuardUserMap` で利用者の型を運ぶ）→ `defineRootGuard`（root の `src/app/guard.ts` だけが呼ぶ。子の guard.ts は親の `extend` で作る。宣言 `src/lib/pageGuard/extensionPoints.ts`）
- `screen.tsx`: データに届くか = 届かない
  - `lib/screens` の `createScreenMaker` + 既定の待つ間の表示 `src/app/_layout/ScreenWait`（1 行スイッチ、fork は `.replace` で替える）→ `createScreen`（画面 = `_screen/<Name>Screen.tsx`・fork の `_components/<X>Screen.tsx` がここから読む。`src/lib/screens/README.md`「画面の作り手」）
- 管理画面の共通部品の組（前の `adminScreenParts.ts`）は admin の概念なので `src/domains/core/admin/services/server/screenParts.ts` にある（注文 34）
- `AppProviders.tsx`: データに届くか = 届く（AuthSessionProvider → セッション解決。データとセッションを読む場所の名前付き例外）
  - アプリ全体の Provider の入れ子。root の `src/app/layout.tsx` が 1 か所で描く（server。自分ではデータを取らない）。並び:
    - 門番 `GateProvider`（root layout が計算した利用者の枠の値を prop `gate` で受ける。`src/featureGate/README.md`）
    - → Tooltip → reCAPTCHA → 認証セッション `AuthSessionProvider` → 管理コマンド → 画像ビューア → 入力部品
    - → 未保存の編集の守り `src/app/_layout/unsavedGuard/UnsavedGuardRoot.tsx`（`src/lib/unsavedGuard` + Overlays の Dialog + `src/config/lib/unsavedGuard.config.ts` の文 → 棚の Navigation の口）
      - 確認の開閉に state を持つ root の枠のクライアント側の Provider で、この入れ子は server なので中に書けない → root の枠の部品に置く。wiring へ戻さない（wiring どうしは import しない）
    - ドメインと fork の Provider は根の枠の点 `rootProviders` の項目(`<ドメイン>/plugs/rootProviders/<名前>.tsx`、生成された一覧 `@/app/_layout/extensions/rootProviders` を門番で絞る)。段 session(上流 auth の認証セッション)→ domain(上流 adminCommand の管理者コマンド)→ project(fork の Provider、前の ForkProviders の口、注文 32)。並べ方 `src/app/_layout/rootProviders.ts`
- `googleTag.ts`（生成物）: データに届くか = 届かない
  - 流入経路の判別表の一覧 `googleTagChannels`（上流は `domains/core/userAcquisition` の項目 = `getChannelDefinitions`。招待などの独自のリンクの印を GA4 の `campaign_source` / `campaign_medium` にする）+ `lib/googleTag` の `wireGoogleTag` → `GoogleTag`（server。root の `src/app/layout.tsx` が描き、表はシリアライズできる値として prop で渡る。宣言 `src/lib/googleTag/extensionPoints.ts`）
- `formSuite.ts`（生成物）: データに届くか = いいえ
  - 独自の入力部品の一覧 `formInputs` → `@/lib/formSuite` の `FormInputsProvider`（結び目 `FormInputsRoot`、client。宣言 `src/lib/formSuite/extensionPoints.ts`、書き方は `src/lib/formSuite/README.md`）
- `serverErrorReport.ts`（生成物）: データに届くか = いいえ（上流の項目は 0。fork の項目がデータに届くなら届く wiring になる）
  - サーバーの失敗の送り先の一覧 `serverErrorReporters`（lazy）+ `lib/serverErrorReport` の `wireServerErrorReport` → `serverErrorReport`（`onRequestError` / `report`。宣言 `src/lib/serverErrorReport/extensionPoints.ts`、書き方は `src/lib/serverErrorReport/README.md`）
- `backends.ts`（生成物）: データに届くか = いいえ（上流の項目は 0。項目は字面だけ）
  - 能力の語の一覧 `backendCapabilities`（宣言 `src/lib/backends/extensionPoints.ts`。結び目なし、実行時に読む所は無い。生成器と検査は項目を構文木で読む、`src/lib/backends/README.md`）
- `dbAgent.ts`（生成物）: データに届くか = いいえ（上流の項目は 0）
- `startup.ts`（生成物）: データに届くか = いいえ（上流の行は選ぶ点ごとの起動時の知らせ = 持ち主の公開の入口の `<点>BackendStatus` を読む生成の行だけ。fork の項目がデータに届くなら届く wiring になる）
  - 起動時の処理の一覧 `startupTasks`（lazy）+ `lib/startup` の `wireStartup` → `startup`（`register`。宣言 `src/lib/startup/extensionPoints.ts`、書き方は `src/lib/startup/README.md`。読み手は `src/instrumentation.ts` だけ）
  - DB 調査エージェントの一覧 `dbAgentTools`・`dbAgentPromptFragments`・`dbAgentSuffixProviders`（宣言 `src/lib/dbAgent/extensionPoints.ts`。結び目なし、route が渡す）
- `routeFactory.ts`（生成物）: データに届くか = 届く（項目の利用者の束 → auth の services/server）。import するのは `apiRoute.ts` だけ
  - API ルートの Factory の点の一覧 `routeFactoryUser`・`routeFactoryRateLimit`・`routeFactoryDevice`・`routeFactoryMaintenance` と型 `RouteFactoryUserMap` ほか（宣言 `src/lib/routeFactory/extensionPoints.ts`。結び目なし、`apiRoute.ts` が門番で絞って渡す）
- `cron.ts`（生成物）: データに届くか = 届く（項目のメンテナンスの判定 → setting の services/server）。import するのは `cronRoute.ts` だけ
  - cron のメンテナンスの判定の一覧 `cronMaintenance`（宣言 `src/lib/cron/extensionPoints.ts`。結び目なし、`cronRoute.ts` が門番で絞って渡す）

## Extension

### 目録に足す

増やすときは、上の API「目録」と `wiring.test.mjs` の `WIRING_FILES` に足す。将来の API 用・管理画面用の wiring は自分で登録表を結ぶ（wiring どうしは import しない。共有するのは lib の汎用版と登録表だけ）。

### fork の wiring

- fork は `src/wiring/<名前>.ts(x)`（client 用は `<名前>.client.tsx`）を足せる（fork が足したファイル = fork の物。名前に fork の印は付けない）。例: fork 独自の主体（店舗の会員など）の API の Factory を、`lib/routeFactory` の汎用版から自分の束で作る
- 目録（`WIRING_FILES` との完全一致）は Tier1 だけで検査する。fork の所有は git の分岐点で `pnpm workflow ownership check` が見る（上流と同じ単位名は unit-clash）。旧い fork の名前の印つきの名前は全 Tier で `pnpm test src/wiring/wiring.test.mjs` が止め、移し方 = 共有の棚の印の移行の notice を案内する
- 向き・データ到達・wiring どうし不可は fork のファイルにも同じに掛かる
- 上流の wiring のファイルを置き換える口（`<対象>.override.ts`）は無い。上流の結び方を変えたいときは `/order <upstream>`
- API の Factory に差し込む束は lib/routeFactory の点の項目（`<ドメイン>/plugs/routeFactoryUser|routeFactoryRateLimit|routeFactoryDevice/<名前>.ts`）。利用者・レート制限はちょうど 1 つで、fork は上流の項目の 1 行スイッチを `<名前>.replace.ts` に向けて替える（足して 2 つにしない、D53）

### lib の点の一覧と結び目（formSuite・serverErrorReport・startup・dbAgent・routeFactory・backends）

lib の拡張点は lib 自身の `extensionPoints.ts` が宣言し、項目は差す側の `<ドメイン か lib>/plugs/<点>/<名前>.ts`（D31・D38）。生成器（`pnpm generate extensions`）が一覧を `src/wiring/<lib>.ts` に書き、lib が `export const wire` を宣言していれば結び目も同じファイルに書く（一覧を門番で絞って lib の作り手に渡す）。

- `formSuite.ts`: 入力部品の一覧 `formInputs` と結び目 `FormInputsRoot`（client。`AppProviders.tsx` が包む。登録名は `RegisteredFormInputs` に載る）
- `serverErrorReport.ts`: 失敗の送り先の一覧 `serverErrorReporters` と結び目 `serverErrorReport`（`src/instrumentation.ts`・`src/proxy.ts`・`apiRoute.ts`・`cronRoute.ts` が読む）
- `startup.ts`: 起動時の処理の一覧 `startupTasks` と結び目 `startup`（`src/instrumentation.ts` の `register` が読む。失敗の記録の送り先から分けた、D30）
- `dbAgent.ts`: 一覧 `dbAgentTools`・`dbAgentPromptFragments`・`dbAgentSuffixProviders`（結び目なし。route `src/app/api/admin/db-agent/route.ts` が門番で絞って `extensions` で渡す）
- `routeFactory.ts`: 一覧 `routeFactoryUser`・`routeFactoryRateLimit`・`routeFactoryDevice`（結び目なし。`apiRoute.ts` が門番で絞り、型は `<点>Map` から取り出す）
- `backends.ts`: 一覧 `backendCapabilities`（結び目なし。読む所は無く、口の語は生成器と検査が項目の字面から読む）

## Internals

wiring どうしは読まない、例外なし（D32、`pnpm test src/wiring/wiring.test.mjs`）: wiring のファイルが読めるのは lib の入口・登録表・生成された一覧だけで、`src/wiring` の中で読めるのは生成物（先頭に生成の印の `src/wiring/<lib>.ts`）だけ。複数の wiring が同じ物を要る時は lib の入口か生成物の側に置く（例: 失敗の記録は生成物 `serverErrorReport.ts` の結び目を `apiRoute.ts`・`cronRoute.ts` が読む）。`src/wiring` はフォルダを持たない（D38）

## Verification

- `pnpm test src/wiring/wiring.test.mjs`（目録・旧い印・向き・鎖・データに届く wiring の import の場所）

## Related

- 受け口の宣言は `src/lib/districtMap/declarations.mjs` で読む。設計の全体は `src/lib/domain/README.md`、API の Factory は `src/lib/routeFactory/README.md`。
