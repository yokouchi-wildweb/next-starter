# routeFactory - APIルートファクトリー

すべての API ルート（`src/app/**/route.ts`）の HTTP の export は、作り手（Factory）の呼び出し結果にする。
`export async function GET(...)` のような素のハンドラは書かない（検査が止める。下の「検査」）。

このフォルダは**汎用版**。主体（ログイン中の利用者・登録端末）の解き方・access の評価・ドメイン名 → 登録行の表を
自分では持たず、差し込まれて初めて使える。差し込んだ**設定済み版**は `src/wiring/apiRoute.ts` にあり、
**route とその補助ファイルは `@/wiring/apiRoute` から import する**（`@/lib/routeFactory` の値 import は `src/wiring/**` だけ）。

---

## なぜファクトリーが必要か

1. **主体を 1 か所で解く**: 利用者はリクエストごとに 1 回だけ DB 同期で解き、`ctx.user` で渡す。route ごとにセッションを引かない
2. **認可の構造的強制**: `access` は型必須。宣言しない・自前で守る口は無い（「認可を考えずにルートを書く」ことができない）
3. **共通処理の一元管理**: デモスキップ・レート制限・reCAPTCHA・監査の文脈・エラーの整形
4. **一貫性**: すべてのルートが同じ構造・応答の形を持つ

---

## どのファクトリーを使うか

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

---

## access の語彙（1 つの表）

| 宣言 | 通す人 | `ctx.user` | 使える場所 |
|---|---|---|---|
| `"public"` | 誰でも | Cookie があり**利用可能な status**（または宣言した `allowStatuses`）のときだけ利用者、他は `null` | createApiRoute・domainEntry.ts |
| `"authenticated"` | ログイン中で利用可能な status | 必ずいる | createApiRoute・createDeviceRoute の `orUser`・domainEntry.ts（createMeRoute は固定でこれ） |
| `{ roles?, roleCategories? }` | 指定ロール / ロールカテゴリ | 必ずいる | 同上。プリセット `ADMIN_RULE` / `ADMIN_OR_DEBUGGER_RULE`（`src/config/app/domain-api-access.config.ts`） |
| `"none"` | 誰も（存在しない扱いの 404） | — | **汎用 CRUD の domainEntry.ts だけ** |

- 拒否: 未認証 → 401、権限不足・利用できない status → 403（JSON に `code: "unauthenticated" | "forbidden"`）。`"none"`・未登録のドメインは 404（`text/plain`、存在を隠す）
- **`allowStatuses`**（全 Factory。createMeRoute・ページの守り（guard.ts / createLoader）と同じ語彙）: 既定は `USER_AVAILABLE_STATUSES`（active のみ）。
  「利用制限中でも本人が完了すべき手続き」（不正疑いチャレンジ・再有効化・KYC 等）のルートだけ明示列挙する。列挙していない status は常に 403（fail-closed）。
  `"public"` では「その status なら `ctx.user` を渡す」の意味（例: `GET /api/auth/session`・`POST /api/auth/logout` は `USER_STATUSES` 全部を並べ、休会中の人のセッションも扱う）
- 型の外れた `access`（JS の呼び出し・`as any` で undefined・null・未知の文字列・配列）は、利用者を解かずに **500**（`code: "route_access_invalid"`）で全リクエストを拒否する（fail-closed。権限不足ではなくルートの書き誤りなので 403 にしない）。組み立て時に `console.error` を 1 回出す。build は止めない
- 「ハンドラで自前に認可する」口は無い。宣言に乗らない条件は、宣言の門を通った後に `ctx.user` で判定する（下の「追加の門」「役割で振る舞いを分ける」）

---

## 主体（`ctx.user`）の決まり

- Factory がリクエストごとに **1 回だけ** DB 同期で解く（`getSessionUser`。同じリクエストの重複は cache で 1 回）。ロール剥奪・利用停止は次の要求から効く
- ハンドラは `ctx.user` だけを使う。route（と `src/app/api/**` の補助ファイル）でセッション取得・`requireRole`・token だけのセッション・`lib/jwt` の Cookie の解析を import しない（検査が止める）
- token だけのセッション（JWT のクレーム）は Factory の内部で監査の actor とデモ判定にだけ使い、ハンドラには渡さない
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

---

## 提供するファクトリー

### 1. `createApiRoute` - 基本ファクトリー

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
| `rateLimit` / `rateLimitSubnet` | `RateLimitCategory` | IP / サブネット（/24）単位のレート制限（`src/config/app/rate-limit.config.ts`） |
| `recaptcha` | `RecaptchaConfig` | reCAPTCHA v3（中間スコアは v2 チャレンジ） |

`skipForDemo`: 省略 = `operationType: "write"` なら自動スキップ / `true` = 常にスキップ / `false` = デモでも実行（ログイン処理・決済の戻り先など）。スキップ時の応答は `{ success: true, demo: true }`。認可はデモスキップより**前**に評価する（権限の無いデモ利用者に偽の成功を返さない）。

デバッグ用ルートの雛形は `src/app/api/debug/ping/route.ts`（`access: ADMIN_OR_DEBUGGER_RULE`）。

### 2. `createDomainRoute` / `createDomainIdRoute` - 汎用CRUDファクトリー

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
// src/features/sample/services/server/domainEntry.ts（業務ドメインは dc:generate が domain.json から生成）
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

- 編集元: 自動生成ドメインは domain.json の `apiAccess` / `useImportExport`（`dc:init` が対話で確認し、`dc:generate` が domainEntry.ts に展開）。
  コアドメインは domainEntry.ts を手書き、fork が core の access を変えるときは隣に `domainEntry.override.ts`。ルール値・スキーマは `src/features/README.md`「ApiAccess」、仕組みは `src/lib/domain/README.md`
- 管理データ操作 `truncateAll` / `export` / `import` は `operations` に明示したときだけ開く（未指定 = `"none"`）。
  全件削除・データ移行のルートは自分の門（`{ roleCategories: ["admin"] }`）に加えて、ドメインごとの access を `enforceAccessRule(rule, ctx.user)` で評価する（AND）
- 解決順: `operations[操作名]` → `read` / `write` → `defaultRule`（`resolveAccessRule`、`src/lib/domain/config/apiAccess.ts`）。
  空 `{}` や部分宣言でも `defaultRule`（admin カテゴリのみ）に倒れる（fail-closed）
- 拒否の body には `{ domain, operation }` が載る（どの操作が拒否されたかをクライアントで観測できる。規則の中身は出さない）
- プリセット（`src/config/app/domain-api-access.config.ts`）: `ADMIN_ONLY` / `PUBLIC_READ`（公開読み取り + 管理者書き込み）/ `ADMIN_OR_DEBUGGER` / `INTERNAL_ONLY`（汎用 API・管理データ操作とも閉じる。登録表には載せる）。
  単一ルール版 `ADMIN_RULE` / `ADMIN_OR_DEBUGGER_RULE` は `operations` の上書きや `createApiRoute` の `access` にも使える。`ADMIN_DATA_OPERATIONS` = 管理データ操作 3 つを管理者に開く断片
- **公開 read の判断基準**: `"public"` にしてよいのは「全レコードが公開情報」のドメインのみ（公開記事・商品マスタ等）。search / count / withRelations 展開も含めて全件見える前提で判断する
- **`authenticated` はオーナーシップを守らない**: where の `user_id` がクライアント任せなので他人のレコードも読める。ユーザー所有データの汎用 API は admin 限定にし、本人向けは createMeRoute で出す
- **sample ドメインの例外**: `/demo` ページ（`sortable-list` の reorder、`tables` のインライン update）が使うため、`src/features/sample/domain.json` の `apiAccess.operations` で `update` / `reorder` のみ `authenticated` に緩和している。フォーク先で demo ページを削除する場合はこの緩和も削除する

> **注意（よくある誤解）**: `/api/<domain>/` に独自の静的サブルート（例 `/api/coupon/redeem`）があっても、汎用 `/api/[domain]/**` は**そのまま動く**（Next.js はフルパスでマッチし、静的は完全一致パスだけを占有する）。
> client で setting 等が読めない場合はルーティングではなく**アクセス制御**（例: setting は `ADMIN_ONLY`）を疑う。確認は dev サーバーへ未認証で `curl -i` を投げ、ステータスと content-type で判定する:
>
> - `401` / `403` の JSON（`{"message":"認証が必要です。","code":"unauthenticated",…}`）→ 汎用ルートに**到達している**（認可で弾かれただけ）
> - `404` + `content-type: text/plain`（本文 `Not Found`）→ `[domain]` ハンドラには到達。registry 未登録 or `access` が `"none"`
> - `404` + `content-type: text/html`（Next の 404 ページ）→ **本物のルーティング欠落**

### 3. `createMeRoute` - 本人専用ファクトリー（オーナーシップ）

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

### 4. `createDeviceRoute` - 登録端末専用ファクトリー

登録端末（pairedDevice）を主体にするルート。端末の認証を強制し、ハンドラに **認証済みの `device`**（`kind` ごとに型の付いた `scope`）を渡す。店舗・テーブル等の所属は `device.scope` から取り、クライアントが送る id は使わない。

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
- 詳細・ペアリング・ページ側のガード（`deviceGuard` / `principalGuard`）: `src/features/core/pairedDevice/README.md`
- `createApiRoute` の `access` に端末は足さない（ハンドラが `device` を受け取らない形だと scope の確認を書き忘れる）。汎用 CRUD も端末を通さない

既存の `createApiRoute` を端末でも通すようにするときは、**scope の確認を必ず足す**（`{ roleCategories: ["admin"] }` は「全店舗を触れる人」前提なので、そのままだと店舗 A の端末が店舗 B の行を id 指定で操作できる）:

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

---

## 追加の門（`enforceAccessRule`）

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

---

## 応答とエラー

- ハンドラが返した `Response`（`NextResponse` 以外も）は**そのまま**返す（redirect・binary・SSE・Cookie 付きの応答）。それ以外の値は `NextResponse.json(value ?? null)`
- `DomainError` → `{ message, code?, details? }` + その status。`code`（機械可読な分類）・`details` は指定したときだけ載る（`src/lib/errors/README.md`）
- それ以外の例外 → `{ message: "サーバーでエラーが発生しました" }` + 500（元の message はサーバーログだけ）
- 認可の拒否 → 401 / 403 の JSON（`code`、汎用 CRUD は `domain` / `operation` も）、404 は `text/plain`

---

## 呼び手が利用者でない入口（webhook・コールバック）

`access: "public"` にし、真正性はハンドラで確かめる（自前で守る口は無い）:

- **webhook**（`POST /api/webhook/payment`）: provider の署名を検証し、無効なら何もしない。`skipForDemo: false`
- **ルームサーバーのコールバック**: `verifyRoomCallback(req)` で検証（`src/lib/realtimeRoom/README.md`）
- **決済サービスからの戻り先**（`/api/wallet/purchase/callback`）: 利用者のブラウザが戻る入口。クエリを戻り先ページへ写して redirect するだけで**何も確定しない**。支払いの確定は status route（本人照合 + provider 照会）と webhook（署名検証）が守る

---

## 検査（全 Tier error）

| 検査 | 内容 | 定義 |
|---|---|---|
| `route-http-export/http-export` | `src/app/**/route.{ts,tsx}` の GET〜OPTIONS は `export const X = <wiring か @/lib/cron の作り手>(…)` だけ。export function・再 export・分割代入の export は不可 | `eslint-rules/route-http-export.mjs` |
| `import-boundaries/route-factory-via-wiring` | `src/lib/routeFactory/**` の値 import は `src/wiring/**`（fork のドット名を含む）と自身だけ。エイリアス・相対・`src/…`・サブパス・dynamic import も実パスで判定。型だけは可 | `eslint-rules/import-boundaries.mjs` |
| `page-authz/session-api-callsite` | `src/app/api/**`（補助ファイルを含む）でセッション取得・`requireRole`・token だけのセッション・Cookie の解析を import しない | `eslint-rules/page-authz.mjs` |
| 型 | `RouteAccess` に `"custom"` が無い・ctx に `session` が無い・`ctx.user` の null 可は `"public"` だけ | `routeAccess.typecheck.ts`（`pnpm typecheck`） |

テスト: `pnpm test:route-factory`（Factory の契約）/ `test:route-http-export` / `test:import-boundaries` / `test:device-route` / `test:collection-entries-route`。

---

## 禁止事項・アンチパターン

- ファクトリーを経由せずに HTTP の export を書く（検査が止める）
- route で `@/lib/routeFactory` から作り手を import する（設定済み版は `@/wiring/apiRoute`）
- route でセッションを引く・`requireAdmin` 等の自前の guard を書く（門は access の宣言、主体は `ctx.user`）
- ユーザー所有データを汎用 `/api/[domain]` で出す（オーナーシップを強制できない。createMeRoute を使う）
- デモスキップの判断をハンドラ内で行う（ファクトリーに委譲する）
- `operationType: "write"` を認可と勘違いする（デモスキップの既定用）
- オーナーシップをロールだけで代替する（`authenticated` でも他人のレコードは見える。`ownerWhere(user)` / `user.userId` で絞る）

---

## PR 前チェックリスト

- [ ] 汎用 CRUD で足りるなら手書きせず createDomainRoute（domainEntry.ts の access）で宣言したか
- [ ] 本人専用データは createMeRoute（/api/me）にし、`ownerWhere(user)` でサーバー側スコープしたか
- [ ] 利用制限中の人を通す必要がある手続きだけ `allowStatuses` を明示したか
- [ ] webhook・コールバックはハンドラ内で真正性を確かめているか（確定しない入口は確定しないか）
- [ ] `pnpm typecheck` と `pnpm lint` が通るか

---

## トラブルシューティング

- **管理画面の一覧が 403**: 対象ドメインの registry `access` が admin 限定で、ログイン中ユーザーのロールカテゴリが admin でない
- **公開ページの一覧取得が 401**: registry の `read` が `"public"` でない。公開してよいデータか（上記判断基準）を確認してから宣言する
- **休会中・処分保留中の人が 403**: 既定は active だけを通す。その手続きに限って `allowStatuses` を列挙する
- **`ctx.user` が `null` 可の型になる**: 型引数を書いていて 3 つ目（access）を省いている（上の「主体の決まり」）
- **wallet 等で本人のデータが取れない**: 汎用 `/api/[domain]` ではなく `/api/me/**`（createMeRoute）を使う
- **静的サブルートを持つドメインの汎用パスが 404 / 401**: シャドーイングではない。上記「注意（よくある誤解）」の curl で判定する

---

## 汎用版の構成（このフォルダ）

- `createRouteFactories(deps)` が全 Factory を作る。`deps` = `{ user: RouteUserDeps, device: RouteDeviceDeps, domains: DomainRegistry }`（全項目必須、型は `deps.ts`）
- 束の持ち主: 利用者 = `features/core/auth` の `apiRouteUserDeps`、端末 = `features/core/pairedDevice` の `apiRouteDeviceDeps`。結ぶのは `src/wiring/apiRoute.ts`
- `makeRouteCore`（共通の前後処理）→ `makeCreateApiRoute` / `makeDomainRoutes` / `makeCreateMeRoute` / `makeCreateDeviceRoute` / `makeEnforceAccessRule`
- fork が独自の主体の Factory を作るときは `src/wiring/<名前>.<fork ID>.ts` で汎用版から作る（`src/wiring/README.md`）

---

## 関連ドキュメント

- `src/wiring/README.md` - 設定済み版の置き場・fork のドット名
- `src/features/README.md`「ApiAccess」 - domain.json の `apiAccess` スキーマ（generator が registry へ展開）
- `src/lib/errors/README.md` - `DomainError` の `code` / `details`
- `docs/!must-read/アプリ構築における構成層.md` - 全体アーキテクチャ
