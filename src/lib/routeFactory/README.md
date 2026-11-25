# routeFactory - APIルートファクトリー

## Overview

- すべての API ルート（`src/app/**/route.ts`）の HTTP の export は、作り手（Factory）の呼び出し結果にする(素のハンドラは検査が止める)
- このフォルダは汎用版。主体（ログイン中の利用者・登録端末）の解き方・access の評価・ドメイン名 → 登録行の表を自分では持たず、差し込まれて初めて使える。差し込んだ設定済み版は `src/wiring/apiRoute.ts`(route とその補助ファイルは `@/wiring/apiRoute` から import する)
- 使う時・直す時の決まりは札 .claude/rules/items/lib/routeFactory.md、層の決まり(access の語彙・主体・汎用 CRUD・lint)は .claude/rules/core/api-routes.md にある。この README は使い方と仕組み

なぜファクトリーが必要か:

1. **主体を 1 か所で解く**: 利用者はリクエストごとに 1 回だけ DB 同期で解き、`ctx.user` で渡す。route ごとにセッションを引かない
2. **認可の構造的強制**: `access` は型必須。宣言しない・自前で守る口は無い（「認可を考えずにルートを書く」ことができない）
3. **共通処理の一元管理**: デモスキップ・レート制限・reCAPTCHA・監査の文脈・エラーの整形
4. **一貫性**: すべてのルートが同じ構造・応答の形を持つ

## Usage

### どのファクトリーを使うか

```
新しい API を作りたい
│
├─ ドメインの標準 CRUD で足りる？
│   └─ YES → createDomainRoute（手書き不要。domainEntry.ts の access で宣言）
│
├─ 自分（ログインユーザー本人）のデータだけを扱う？
│   └─ YES → createMeRoute（/api/me/**）
│
├─ 登録端末（店舗タブレット・キオスク）が主体？
│   └─ YES → createDeviceRoute（端末 + 任意でユーザーも通す orUser）
│
└─ それ以外（独自ロジック・特殊入出力）→ createApiRoute。access を必ず宣言（下の語彙表）
```

```ts
// すべて @/wiring/apiRoute から（@/lib/routeFactory からは型だけ）
import { createApiRoute, createDomainRoute, createDomainIdRoute, createMeRoute, createDeviceRoute, enforceAccessRule, ownerWhere } from "@/wiring/apiRoute";
```

### 業務処理に利用者が要るとき


汎用 CRUD の `create` / `update` は利用者を受け取らない。

- **理由**: ここに渡しても `read`・`count`・リレーション展開・`upsert`・bulk・`duplicate` の経路は守れず、どの操作が何を保証するかを契約にできない
- **形**: 専用のルート（`createApiRoute` か `createMeRoute`）→ 主体を**必須の引数**で受ける業務メソッド → 汎用の経路を閉じる（前例: `user` の `updateSelf(actor, data)`）
- 省略可能な actor は渡し忘れが権限の抜けになる。AuditContext は JWT から作る記録用の値で、ロール剥奪・利用停止を反映しない
- 代理の作成の入口の決まりは札 `proxy_create_admin_entry`(.claude/rules/items/lib/routeFactory.md)

移行の手順:

1. 汎用の `create` / `update` の override で利用者を使っている処理を、主体を必須で受けるメソッドに移す。主体を使わない検証は override に残してよい
2. 専用のルートを作り、`ctx.user` を渡す
3. 汎用の書き込みを閉じる。`write: "none"` なら `operations` に個別の指定が無い `create` / `update` / `upsert` / bulk / `duplicate` がまとめて閉じる（解決順は下の「`createDomainRoute` / `createDomainIdRoute`」の節）
4. 画面の hook を専用のルートへ切り替える（ClientService + `useDomainMutation`）

```ts
// services/server/wrappers/submit.ts
export async function submit(actor: { userId: string; role: string }, data: ExampleInput) {
  await assertCanSubmit(actor, data);
  return base.create({ ...data, user_id: actor.userId });
}

// src/app/api/example/submit/route.ts
export const POST = createApiRoute(
  { operation: "POST /api/example/submit", operationType: "write", access: "authenticated" },
  async (req, { user }) => exampleService.submit(user, await req.json()),
);

// services/server/domainEntry.ts（業務ドメインは domain.json の apiAccess に同じ値を書く）
access: { read: "public", write: "none" },
```

移行の後に確かめること: 他人の id を指定した要求 | 汎用 URL（`/api/<domain>`）での迂回 | 利用停止中の利用者 | 利用者のいない内部の呼び出し

### 呼び手が利用者でない入口（webhook・コールバック）

`access: "public"` にし、真正性はハンドラで確かめる（自前で守る口は無い）:

- **webhook**（`POST /api/webhook/payment`）: provider の署名を検証し、無効なら何もしない。`skipForDemo: false`
- **ルームサーバーのコールバック**: `verifyRoomCallback(req)` で検証（`src/lib/realtimeRoom/README.md`）
- **決済サービスからの戻り先**（`/api/wallet/purchase/callback`）: 利用者のブラウザが戻る入口。クエリを戻り先ページへ写して redirect する。支払いの確定は status route（本人照合 + provider 照会）と webhook（署名検証）が守る
- 決済の完了の通知・戻りの POST は `maintenance: "pass"` を書く（下の「メンテナンス中の書き込みの停止」。止めると進行中の支払いの完了を取りこぼす）

### メンテナンス中の書き込みの停止

設定のメンテナンスの期間（`settingService.isMaintenanceActive()`）は、全 Factory の土台が書き込みを止める。判定は点 `routeFactoryMaintenance`（0〜1 個、`./extensionPoints.ts`、項目の型 `RouteMaintenancePlug`）の項目で、上流は `domains/core/setting` の `plugs/routeFactoryMaintenance/maintenance.ts`。空ならメンテナンスで止めない。

- 止まる物: メソッドが `POST`・`PUT`・`PATCH`・`DELETE` の要求。応答は 503 + `{ message, code: "maintenance" }`（`MAINTENANCE_CODE`、`@/lib/errors`）。`operationType` ではなくメソッドで決まる
- 止まらない物: `GET`・`HEAD`・`OPTIONS`（期間を読みもしない）
- 通る人: `canBypassMaintenance`（`src/domains/core/setting/utils/maintenanceBypass.ts`、既定は設定の `maintenance.bypassRoles` = 管理者・debugger）が true の利用者。画面の proxy と同じ判定で、DB 同期・利用できる status の利用者だけ（停止中の管理者は止まる）
- 通らない物: `user: "skip"` のルート（利用者を解かない）と端末の主体（利用者がいない）
- 通す宣言: そのルート自身が設定に `maintenance: "pass"` を書く（中央の一覧は無い）。止めると取りこぼす経路だけに書く: 決済の webhook・完了・戻り、ログイン・ログアウト（ログインを止めると管理者がメンテナンスを解けない）
- 汎用 CRUD（`createDomainRoute` / `createDomainIdRoute`）には宣言の鍵が無く、期間中の書き込みはいつも止まる（管理者は通る）
- Tier1 で `"pass"` を書いているルート: `POST /api/webhook/payment`・`POST /api/wallet/purchase/callback`・`POST /api/wallet/purchase/[id]/paidy/confirm`・`…/paypal/confirm`・`…/bank-transfer/confirm`（自社振込の完了の唯一の入口）・`POST /api/auth/firebase/login`・`POST /api/auth/local/login`・`POST /api/auth/logout`。一覧は `git grep -n 'maintenance: "pass"' -- src/app`
- 既定で止まる例: `wallet/purchase/initiate`・`auth/register`・`auth/pre-register`・`webhook/line`・`webhook/messaging/**`（provider は 503 を受けて自分の方針で再送する）・端末のルート
- クライアントは `isMaintenanceError(error)`（`@/lib/errors`）で見分け、文言は `err(error, fallback)` で出す
- 期間の切り替わりは設定の読みのメモ（`readMemoMs`、既定 10 秒）だけ遅れる。止まったかの確かめ方は `src/domains/core/setting/README.md` の「メンテナンスで止まる物と確かめ方」

### トラブルシューティング

- **管理画面の一覧が 403**: 対象ドメインの registry `access` が admin 限定で、ログイン中ユーザーのロールカテゴリが admin でない
- **公開ページの一覧取得が 401**: registry の `read` が `"public"` でない。公開してよいデータか（全レコードが公開情報で、search / count / リレーション展開も全件見えてよいか）を確認してから宣言する
- **休会中・処分保留中の人が 403**: 既定は active だけを通す。その手続きに限って `allowStatuses` を列挙する
- **DB が落ちている間 API が 503 `route_user_unavailable`**: 想定通り（未ログインの 401 と区別している）。DB の復旧を待つ。利用者を使わない公開ルートなら `user: "skip"` で影響を受けない
- **`ctx.user` が `null` 可の型になる**: 型引数を書いていて 3 つ目（access）を省いている（API の「主体（`ctx.user`）」）
- **wallet 等で本人のデータが取れない**: 汎用 `/api/[domain]` ではなく `/api/me/**`（createMeRoute）を使う
- **静的サブルートを持つドメインの汎用パスが 404 / 401**: シャドーイングではない。API の「`createDomainRoute` / `createDomainIdRoute` - 汎用CRUDファクトリー」の「注意（よくある誤解）」の curl で判定する

## API

### access の語彙

| 宣言 | 通す人 | `ctx.user` | 使える場所 |
|---|---|---|---|
| `"public"` | 誰でも | Cookie があり**利用可能な status**（または宣言した `allowStatuses`）のときだけ利用者、他は `null` | createApiRoute・domainEntry.ts |
| `"authenticated"` | ログイン中で利用可能な status | 必ずいる | createApiRoute・createDeviceRoute の `orUser`・domainEntry.ts（createMeRoute は固定でこれ） |
| `{ roles?, roleCategories? }` | 指定ロール / ロールカテゴリ | 必ずいる | 同上。プリセット `ADMIN_RULE` / `ADMIN_OR_DEBUGGER_RULE`（`src/lib/domainAccess/accessPresets.ts`） |
| `"none"` | 誰も（存在しない扱いの 404） | — | **汎用 CRUD の domainEntry.ts だけ** |

- 拒否: 未認証 → 401、権限不足・利用できない status → 403（JSON に `code: "unauthenticated" | "forbidden"`）。`"none"`・未登録のドメインは 404（`text/plain`、存在を隠す）
- **`allowStatuses`**（全 Factory。createMeRoute・ページの守り（guard.ts / createLoader）と同じ語彙）: 既定は `USER_AVAILABLE_STATUSES`（active のみ）。
  「利用制限中でも本人が完了すべき手続き」（不正疑いチャレンジ・再有効化・KYC 等）のルートだけ明示列挙する。列挙していない status は常に 403（fail-closed）。
  `"public"` では「その status なら `ctx.user` を渡す」の意味（例: `GET /api/auth/session`・`POST /api/auth/logout` は `USER_STATUSES` 全部を並べ、休会中の人のセッションも扱う）
- 型の外れた `access`（JS の呼び出し・`as any` で undefined・null・未知の文字列・配列）は、利用者を解かずに **500**（`code: "route_access_invalid"`）で全リクエストを拒否する（fail-closed。権限不足ではなくルートの書き誤りなので 403 にしない）。組み立て時に `console.error` を 1 回出す。build は止めない
- 「ハンドラで自前に認可する」口は無い。宣言に乗らない条件は、宣言の門を通った後に `ctx.user` で判定する（下の「追加の門」「役割で振る舞いを分ける」）

### 主体（`ctx.user`）

- Factory がリクエストごとに **1 回だけ** DB 同期で解く（`getSessionUser`。同じリクエストの重複は cache で 1 回）。ロール剥奪・利用停止は次の要求から効く
- ハンドラは `ctx.user` だけを使う。route（と `src/app/api/**` の補助ファイル）でセッション取得・`requireRole`・token だけのセッション・`lib/jwt` の Cookie の解析を import しない（検査が止める）
- token だけのセッション（JWT のクレーム）は Factory の内部で監査の actor とデモ判定にだけ使い、ハンドラには渡さない
- **利用者を確かめられないとき（DB 障害）は 503**（`code: "route_user_unavailable"`、`RouteUserUnavailableError`）。全 Factory（createApiRoute の全 access・createMeRoute・createDomainRoute・createDeviceRoute の `orUser`）で同じ。ハンドラには届かない
  - 意味: 障害であって認証の失敗ではない。401（未ログイン）にはせず、JWT のクレームに落として通すこともしない（stale な権限で通さない）
  - 束の契約（`deps.ts` の `resolveUser`）: `null` = 利用者がいないと分かった（未ログイン・失効・削除）、throw = 確かめられない。Factory が throw を `RouteUserUnavailableError` にする（束は lib の値を import しない）。auth の束は `getSessionUserForRoute`（`getSessionUser` と同じ 1 回の引きを共有）
  - ページの守り（guard.ts）・proxy・`AuthSessionProvider` は今まで通り障害も `null`（ログインへ送る）
- **利用者を使わない公開ルートは `user: "skip"`** で users の読みを省ける（createApiRoute の `access: "public"` だけ。他の access は型で止まり、JS などで届いても無視せず 500 `route_access_invalid`）
  - `ctx.user` はいつも `null`。DB 障害でも利用者を引かないので 503 にならない
  - 監査の actor とデモ判定は今まで通り JWT だけ（DB を引かない）で決まる。デモの書き込みスキップも効く
  - 例: 公開の一覧・メディアの配信

```ts
export const GET = createApiRoute(
  { operation: "GET /api/public-prizes", operationType: "read", access: "public", user: "skip" },
  async () => prizeService.listPublic(),
);
```
- **役割で振る舞いを分ける**のは可（門ではない）: 門は宣言で書き、通った後の分岐に `ctx.user.role` を使う（例: `GET /api/wallet/history/batches` は「他人の userId を指定できるのは admin だけ」）
- 型引数を書くときは 3 つ目に access を書く（TS は型引数の一部だけを推論できない。省くと `ctx.user` が `null` 可になる）:

```ts
type Params = { id: string };
export const POST = createApiRoute<Params, unknown, "authenticated">(
  { operation: "POST /api/example/[id]/cancel", operationType: "write", access: "authenticated" },
  async (_req, { params, user }) => exampleService.cancel(params.id, user.userId),
);
// 管理者なら createApiRoute<Params, unknown, { roleCategories: string[] }>(…)
```

### `createApiRoute` - 基本ファクトリー

```ts
import { createApiRoute } from "@/wiring/apiRoute";

export const POST = createApiRoute(
  {
    operation: "POST /api/feedback",
    operationType: "write",
    access: "authenticated", // 必須
  },
  async (req, { user }) => feedbackService.submit(user.userId, await req.json()),
);
```

| オプション | 型 | 説明 |
|---|---|---|
| `operation` | `string` | 操作名（ログ・デバッグ用） |
| `operationType` | `"read" \| "write"` | 操作種別（デモスキップの既定に使う。認可とは無関係） |
| `access` | `RouteAccess` | **必須**。上の語彙表 |
| `allowStatuses` | `readonly UserStatus[]` | 通す status（省略時は利用可能な status だけ） |
| `skipForDemo` | `boolean` | 下の表 |
| `rateLimit` / `rateLimitSubnet` | `TCategory`(wiring が `RateLimitCategory` を渡す) | IP / サブネット（/24）単位のレート制限(カテゴリの持ち主 `src/domains/core/rateLimit/config.ts`。lib はカテゴリの名前を知らず、`createRouteFactories` の型引数 `TCategory` で受ける) |
| `recaptcha` | `RecaptchaConfig` | reCAPTCHA v3（中間スコアは v2 チャレンジ） |
| `onRejected` | `(rejection: RouteRejection, req) => Promise<void>` | Factory 自身が断った時(回数制限の 429 = `{ kind: "rateLimit", scope: "ip" \| "subnet", category, identifier }`・reCAPTCHA の 403 / 428 = `{ kind: "recaptcha", version, outcome: "failed" \| "challenge", error?, score? }`)に、答えが決まった後・返す前に監査の文脈の中で待って呼ぶ口(省略可)。口の誤りは記録して飲み込み、答えは変えない。例: 登録の API の失敗の記録(auth の `signupRejectionRecorder`) |
| `maintenance` | `"pass"` | メンテナンス中も書き込みを通す宣言（省略 = 止める。Usage の「メンテナンス中の書き込みの停止」）。`createMeRoute` / `createDeviceRoute` も同じ |

`skipForDemo`: 省略 = `operationType: "write"` なら自動スキップ / `true` = 常にスキップ / `false` = デモでも実行（ログイン処理・決済の戻り先など）。スキップ時の応答は `{ success: true, demo: true }`。認可はデモスキップより前に評価する。

デバッグ用ルートの雛形は `src/app/api/debug/ping/route.ts`（`access: ADMIN_OR_DEBUGGER_RULE`）。

### `createDomainRoute` / `createDomainIdRoute` - 汎用CRUDファクトリー

`/api/[domain]/**` 配下の汎用 CRUD 専用。登録表（`src/registry/serviceRegistry.ts`、各ドメインの `services/server/domainEntry.ts` から生成）の行を wiring が差し込み、URL のドメイン名から引く。認可はサービスの遅延読み込みより先に判定する。

```ts
import { createDomainRoute } from "@/wiring/apiRoute";

export const GET = createDomainRoute<any, { domain: string }>(
  { operation: "GET /api/[domain]", operationType: "read", crudOp: "list" },
  async (_req, { service }) => service.list(),
);
```

アクセスポリシーは各ドメインの `domainEntry.ts` の `{ service, access }` で宣言する（型必須）:

```ts
// src/domains/sample/services/server/domainEntry.ts（業務ドメインは pnpm generate domain が domain.json から生成）
export const domainEntries = {
  sample: {
    service: () => import("./sampleService").then((m) => m.sampleService),
    access: {
      ...PUBLIC_READ,
      operations: { update: "authenticated", reorder: "authenticated", truncateAll: ADMIN_RULE, export: ADMIN_RULE, import: ADMIN_RULE },
    },
  },
} satisfies DomainEntries;
```

- 編集元: 自動生成ドメインは domain.json の `apiAccess` / `useImportExport`（domain.json に手で書き、`pnpm generate domain` / forge が domainEntry.ts に展開）。
  コアドメインは domainEntry.ts を手書き、fork が core の access を変えるときは隣に `domainEntry.override.ts`。ルール値・スキーマは `src/domains/README.md`「ApiAccess（汎用 API アクセス制御）」、仕組みは `src/lib/domain/README.md`
- 管理データ操作 `truncateAll` / `export` / `import` は `operations` に明示したときだけ開く（未指定 = `"none"`）。
  全件削除・データ移行のルートは自分の門（`{ roleCategories: ["admin"] }`）に加えて、ドメインごとの access を `enforceAccessRule(rule, ctx.user)` で評価する（AND）
- 解決順: `operations[操作名]` → `read` / `write` → `DEFAULT_ACCESS_RULE`(`src/lib/domainAccess/accessPresets.ts`)（`resolveAccessRule`、`src/lib/domain/definition/apiAccess.ts`）。
  空 `{}` や部分宣言でも `DEFAULT_ACCESS_RULE`（admin カテゴリのみ）に倒れる（fail-closed）
- 拒否の body には `{ domain, operation }` が載る（どの操作が拒否されたかをクライアントで観測できる。規則の中身は出さない）
- プリセット（`src/lib/domainAccess/accessPresets.ts`）: `ADMIN_ONLY` / `PUBLIC_READ`（公開読み取り + 管理者書き込み）/ `ADMIN_OR_DEBUGGER` / `INTERNAL_ONLY`（汎用 API・管理データ操作とも閉じる。登録表には載せる）。
  単一ルール版 `ADMIN_RULE` / `ADMIN_OR_DEBUGGER_RULE` は `operations` の上書きや `createApiRoute` の `access` にも使える。`ADMIN_DATA_OPERATIONS` = 管理データ操作 3 つを管理者に開く断片
- `authenticated` は where の `user_id` がクライアント任せなので他人のレコードも読める。本人向けは下の createMeRoute
- **sample ドメインの例外**: `/demo` ページ（`sortable-list` の reorder、`tables` のインライン update）が使うため、`src/domains/sample/domain.json` の `apiAccess.operations` で `update` / `reorder` のみ `authenticated` に緩和している。フォーク先で demo ページを削除する場合はこの緩和も削除する

> **注意（よくある誤解）**: `/api/<domain>/` に独自の静的サブルート（例 `/api/coupon/redeem`）があっても、汎用 `/api/[domain]/**` は**そのまま動く**（Next.js はフルパスでマッチし、静的は完全一致パスだけを占有する）。
> client で setting 等が読めない場合はルーティングではなく**アクセス制御**（例: setting は `ADMIN_ONLY`）を疑う。確認は dev サーバーへ未認証で `curl -i` を投げ、ステータスと content-type で判定する:
>
> - `401` / `403` の JSON（`{"message":"認証が必要です。","code":"unauthenticated",…}`）→ 汎用ルートに**到達している**（認可で弾かれただけ）
> - `404` + `content-type: text/plain`（本文 `Not Found`）→ `[domain]` ハンドラには到達。registry 未登録 or `access` が `"none"`
> - `404` + `content-type: text/html`（Next の 404 ページ）→ **本物のルーティング欠落**

### `createMeRoute` - 本人専用ファクトリー（オーナーシップ）

`/api/me/**` 配下の「自分のデータだけ」を扱うルート専用。access は `"authenticated"` 固定で、`ctx.user`（必ずいる）を渡す。

```ts
import { createMeRoute, ownerWhere } from "@/wiring/apiRoute";

export const GET = createMeRoute(
  { operation: "GET /api/me/wallet", operationType: "read" },
  // ownerWhere(user) で本人スコープを固定（クライアント指定の id は使わない）
  async (_req, { user }) => walletService.search({ where: ownerWhere(user) }),
);

export const POST = createMeRoute(
  {
    operation: "POST /api/me/fingerprint-challenges/[token]/submit",
    operationType: "write",
    allowStatuses: ["active", "suspended"], // 利用制限中でも本人が完了すべき手続き
  },
  async (req, { user }) => { /* user.status は active か suspended */ },
);
```

### `createDeviceRoute` - 登録端末専用ファクトリー

登録端末（pairedDevice）を主体にするルート。端末の認証を強制し、ハンドラに認証済みの `device`（`kind` ごとに型の付いた `scope`）を渡す。

```ts
import { createDeviceRoute } from "@/wiring/apiRoute";

export const POST = createDeviceRoute(
  { operation: "POST /api/terminal/lending", operationType: "write", kinds: ["table_terminal"] },
  async (req, { device }) => lendingService.request({ tableId: device.scope.tableId }),
);
```

- 端末でない → 401、kind 違い → 403。監査ログの actor は `device`。端末への応答は毎回 Cookie の期限を DB に合わせる
- `orUser: "authenticated" | { roles?, roleCategories? }`（+ `allowStatuses`）を付けると、ルールに合うログインユーザーも通る（`ctx.principal` で分岐）
- `rateLimit` は端末 id / ユーザー id 単位（店内の端末は同じ IP から来るため IP 単位にしない）。`recaptcha` は使えない
- 端末の Cookie はユーザーの認可に影響しない（端末で `createMeRoute` や `"authenticated"` のルートは通らない）
- 詳細・ペアリング・ページ側のガード（`deviceGuard` / `principalGuard`）: `src/domains/core/pairedDevice/README.md`
- 汎用 CRUD は端末を通さない

既存の `createApiRoute` を端末でも通す例（`{ roleCategories: ["admin"] }` は「全店舗を触れる人」前提なので、scope の確認が無いと店舗 A の端末が店舗 B の行を id 指定で操作できる）:

```ts
export const POST = createDeviceRoute<"staff_tablet", Params>(
  {
    operation: "POST /api/visitGroup/[id]/finish",
    operationType: "write",
    kinds: ["staff_tablet"],                  // ← access の代わり
    orUser: { roleCategories: ["admin"] },    // ← 今までのルール（スタッフ本人のスマホ等）
  },
  async (_req, ctx) => {
    const group = await visitGroupService.get(ctx.params.id);
    if (ctx.principal === "device" && group?.storeId !== ctx.device.scope.storeId) {
      throw new DomainError("見つかりません", { status: 404 });
    }
    return visitGroupService.finish(ctx.params.id);
  },
);
```

### 追加の門（`enforceAccessRule`）

宣言の門を通った後に、別の access ルールを同じ利用者で重ねて評価する（AND）。主体は引き直さず `ctx.user` を渡す。拒否なら応答（401 / 403 / 404）、許可なら `null`。

```ts
import { createApiRoute, enforceAccessRule } from "@/wiring/apiRoute";

export const POST = createApiRoute(
  { operation: "POST /api/admin/domains/truncate", operationType: "write", access: { roleCategories: ["admin"] } },
  async (_req, { user }) => {
    const denied = await enforceAccessRule(resolveAccessRule(access, "truncateAll", "write"), user, { domain, operation: "truncateAll" });
    if (denied) return denied;
    /* … */
  },
);
```

`src/app/api/**` の補助ファイル（例 `data-migration/_shared/domainAccess.ts`）も、主体を引数で受けてこれを呼ぶ。

### 応答とエラー

- ハンドラが返した `Response`（`NextResponse` 以外も）は**そのまま**返す（redirect・binary・SSE・Cookie 付きの応答）。それ以外の値は `NextResponse.json(value ?? null)`
- `DomainError` → `{ message, code?, details? }` + その status。`code`（機械可読な分類）・`details` は指定したときだけ載る（`src/lib/errors/README.md`）
- 外部の口の誤り（`DomainError` の後・汎用 500 の前）: `BackendNoneSelectedError`（`@/lib/backends`、選択表で `none` の口）→ 501 + `{ message: "この機能は利用できません", code: "backend_not_selected" }` / ほかの `BackendNotConfiguredError`（`@/lib/errors`、選んだ実装に設定が無い）→ 500 + `{ message: "サーバーでエラーが発生しました", code: "backend_not_configured" }`。口の名前・実装・足りない名前は載せない。どちらも想定外の失敗として失敗の記録の口へ渡る
- それ以外の例外 → `{ message: "サーバーでエラーが発生しました" }` + 500（元の message はサーバーログだけ）
- 想定外の失敗（DomainError 以外と status 500 以上の DomainError）は束の口 `serverError.onServerError`（省略可）へ path・method・headers・requestId・operation を渡して待つ。口があればその記録が 1 失敗 1 行（`console.error` の `<operation> failed:` は出さない）、無ければ `console.error`。400 番台の DomainError は口へ渡さない。上流の wiring はサーバーの失敗の記録（`src/lib/serverErrorReport/README.md`）へ結ぶ
- 認可の拒否 → 401 / 403 の JSON（`code`、汎用 CRUD は `domain` / `operation` も）、404 は `text/plain`
- 利用者を確かめられない（DB 障害）→ 503 の JSON（`code: "route_user_unavailable"`、上の「主体（`ctx.user`）」）。クライアントは再試行
- レート制限で止めた → 429 + `Retry-After`(サブネット単位は `silent: true`)/ reCAPTCHA の中間スコア → 428(v2 チャレンジを求める)
- メンテナンスで止めた → 503 の JSON（`code: "maintenance"`）。`DomainError` ではないので失敗の記録の口へは渡らない

## Extension

- fork が独自の主体の Factory を作るときは `src/wiring/<名前>.ts` で汎用版から作る（`src/wiring/README.md`）
  - 束の `maintenance`(`RouteMaintenanceDeps`: `isActive`・`canBypass`)に、生成物 `@/wiring/routeFactory` の点 `routeFactoryMaintenance` の項目を門番で絞って結ぶ（上流の `src/wiring/apiRoute.ts` と同じ形。結ばないとその Factory のルートはメンテナンスで止まらない）
  - 束の `serverError.onServerError` に生成物 `@/wiring/serverErrorReport` の `serverErrorReport.report` を結ぶ（`scope: "api"`、`name` = operation。上流の `src/wiring/apiRoute.ts` と同じ形。結ばないと 500 が既定の記録と送り先に残らない）

## Internals

- `createRouteFactories(deps)` が全 Factory を作る。
  - `deps` = `{ user: RouteUserDeps, device?: RouteDeviceDeps, rateLimit: RouteRateLimitDeps, domains: DomainRegistry, gate?: RouteGateDeps, serverError?: RouteServerErrorDeps, maintenance?: RouteMaintenanceDeps }`。
  - `device`(省略可)= 省略時は lib の「端末なし」(`noDevice.ts`: 端末を認証しない。端末だけのルートは 401、orUser のルートは利用者の枝だけ)。点 `routeFactoryDevice` が空(端末を差すドメインが閉じて門番が外した)ときの既定(D53)
  - `maintenance`(省略可): 土台が認可の後・デモスキップの前に `maintenance.ts` の判定を通す。書き込みのメソッドで宣言が無い時だけ `isActive()` を読み、期間中ならバイパスを `authorize` と同じ `resolveUser`(持ち主の cache でリクエスト内 1 回)で確かめる。lib は設定も役割も知らない
  - `gate`(省略可)= 門番の口 `{ isClosed(pathname) }`: 全 Factory の土台(`runRoute`)が最初に要求の住所を聞き、閉なら主体の解決・認可・ハンドラの前に `not_found` と同じ 404(本文 `Not Found`、機能名を出さない)。
  - proxy の門番の 404 が先に効くので、通り抜けたときの安全網。
  - 土台の最初の文は `await connection()`(next/server)で、門番の 404 を含むどの早期 return より前。cacheComponents の build は request を読まずに返す応答を静的に焼き付けるため(cacheComponents off では何も変えない)。route.ts の側には書かない。
  - lib は門番を知らず、`src/wiring/apiRoute.ts` が `gate.path` で結ぶ(Factory に機能名の指定欄は無い)。
  - 主体の型(利用者・status・端末の種類ごとの型・認証済みの端末)は型引数で受け、lib はドメインを import しない(lint `import-boundaries/district-no-domains`)。
  - 具体の型を結ぶのは `src/wiring/apiRoute.ts`（型は `deps.ts`。具体の型は生成された一覧の `<点>Map` の型から `plugs.ts` の取り出しの型で導く）。
- 束は lib の 3 つの点の項目(宣言 `extensionPoints.ts`、約束の型 `plugs.ts`、一覧は生成物 `src/wiring/routeFactory.ts`、どれも shape "object" で項目の具体の型を残す):
  - `routeFactoryUser` = 利用者の解き方、ちょうど 1 つ(`required`)。上流の項目 `domains/core/auth/plugs/routeFactoryUser/session.ts`(1 行スイッチ、既定 `session.default.ts`、fork は差替点 `authRouteFactoryUser` で `session.replace.ts` に替える)
  - `routeFactoryRateLimit` = レート制限、ちょうど 1 つ(`required`)。上流の項目 `domains/core/rateLimit/plugs/routeFactoryRateLimit/ipRate.ts`(1 行スイッチ、差替点 `rateLimitRouteFactoryRateLimit`)
  - `routeFactoryDevice` = 登録端末、0〜1 個(`max: 1`)。上流の項目 `domains/core/pairedDevice/plugs/routeFactoryDevice/pairedDevice.ts`(端末の種類ごとの型は値を持たない欄 `types` で運ぶ)。pairedDevice が閉じれば門番が外し「端末なし」
  - 結ぶのは `src/wiring/apiRoute.ts`(一覧を `gate.plugs` で絞って渡す。ドメインを読まない、D22)
- `runRoute` はハンドラを `runWithAuditContext`(どの深さからでも `getAuditContext()` で actor / IP / UA を取れる)と `runWithUserDirtyTracking`(`markUserDirty` した対象をハンドラの後に反映)と `runWithCacheTags`(書き込みが積んだ共有の読みのキャッシュの札をハンドラの後にまとめて消す、`src/lib/cacheTags`)で包む。端末の route(createDeviceRoute)も同じ 2 つを端末の監査の文脈の内側で敷き直す
- `makeRouteCore`（共通の前後処理）→ `makeCreateApiRoute` / `makeDomainRoutes` / `makeCreateMeRoute` / `makeCreateDeviceRoute` / `makeEnforceAccessRule`

## Verification

| 検査 | 内容 | 定義 |
|---|---|---|
| `route-http-export/http-export` | `src/app/**/route.{ts,tsx}` の GET〜OPTIONS は `export const X = <wiring か @/lib/cron の作り手>(…)` だけ。export function・再 export・分割代入の export は不可 | `eslint-rules/route-http-export.mjs` |
| `import-boundaries/route-factory-via-wiring` | `src/lib/routeFactory/**` の値 import は `src/wiring/**`（fork が足した wiring を含む）と自身だけ。エイリアス・相対・`src/…`・サブパス・dynamic import も実パスで判定。型だけは可 | `eslint-rules/import-boundaries.mjs` |
| `page-authz/session-api-callsite` | `src/app/api/**`（補助ファイルを含む）でセッション取得・`requireRole`・token だけのセッション・Cookie の解析を import しない | `eslint-rules/page-authz.mjs` |
| 型 | `RouteAccess` に `"custom"` が無い・ctx に `session` が無い・`ctx.user` の null 可は `"public"` だけ・`user: "skip"` は `"public"` だけ | `routeAccess.typecheck.ts`（`pnpm typecheck`） |

テスト: `pnpm test src/wiring/routeFactory.test.mts`（Factory の契約）/ `pnpm test eslint-rules/route-http-export.test.mjs` / `pnpm test eslint-rules/import-boundaries.test.mjs` / `pnpm test src/lib/routeFactory/createDeviceRoute.test.mts src/lib/routeFactory/noDevice.test.mts src/domains/core/pairedDevice` / `pnpm test src/app/api/collectionEntriesRoute.test.mts` / `pnpm test src/lib/routeFactory/maintenance.test.mts`（メンテナンスの停止・宣言・バイパス）/ `pnpm test src/lib/routeFactory/unconfigured.test.mts`（外部の口の誤りの 500 / 501 と code、本文に口の名前を出さない）。webhook の鍵が無い時の 503 は `src/domains/core/messaging/services/server/webhooks/applyEvents.test.ts`。

## Related

- `src/wiring/README.md` - 設定済み版の置き場・fork の wiring
- `src/domains/README.md`「ApiAccess（汎用 API アクセス制御）」 - domain.json の `apiAccess` スキーマ（generator が registry へ展開）
- `src/lib/errors/README.md` - `DomainError` の `code` / `details`
- `docs/!must-read/アプリ構築における構成層.md` - 全体アーキテクチャ
