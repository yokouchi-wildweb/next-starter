# routeFactory - APIルートファクトリー

すべてのAPIルートは、このファクトリーを経由して作成する必要があります。
直接 `export const GET = async (req) => { ... }` のようなハンドラを書くことは禁止されています。

---

## なぜファクトリーが必要か

1. **共通処理の一元管理**: 認証、エラーハンドリング、デモモード制御などを一箇所で管理
2. **将来の拡張性**: 新しい共通処理（ログ、レート制限等）を追加する際にファクトリーのみ修正すればよい
3. **一貫性の担保**: すべてのAPIルートが同じ構造・挙動を持つ
4. **認可の構造的強制**: どのファクトリーも、認可を宣言しない（`access` の書き忘れ等）と
   型エラー or fail-closed で弾かれる。「認可を考えずにルートを書く」ことができない

---

## どのファクトリーを使うか

```
新しい API を作りたい
│
├─ ドメインの標準 CRUD で足りる？
│   └─ YES → createDomainRoute（手書き不要。serviceRegistry の access で宣言）
│
├─ 自分（ログインユーザー本人）のデータだけを扱う？
│   └─ YES → createMeRoute（/api/me/**）
│
├─ 登録端末（店舗タブレット・キオスク）が主体？
│   └─ YES → createDeviceRoute（端末 + 任意でユーザーも通す orUser）
│
└─ それ以外（独自ロジック・特殊入出力）→ createApiRoute。access を必ず宣言:
        ├─ 未認証で正当（ログイン前・公開マスタ・webhook）→ "public"
        │     webhook はハンドラ内で署名/トークンを検証する（実例: api/webhook/payment）
        ├─ ログインユーザーなら誰でも                     → "authenticated"
        ├─ 管理者のみ                                     → { roleCategories: ["admin"] }
        ├─ 管理者 + デバッガー（デバッグ用）              → ADMIN_OR_DEBUGGER_RULE
        └─ 宣言的ルールに乗らない独自認可（条件付き等）  → "custom"（ハンドラ内で自前に守る）
```

---

## 提供するファクトリー

### 1. `createApiRoute` - 基本ファクトリー

すべてのAPIルート作成の基盤となるファクトリーです。

```ts
import { createApiRoute } from "@/lib/routeFactory";

export const GET = createApiRoute(
  {
    operation: "GET /api/example",
    operationType: "read",
    access: "authenticated", // 必須: アクセスポリシー
  },
  async (req, { params, session }) => {
    // ビジネスロジック
    return { data: "example" };
  },
);
```

#### 設定オプション

| オプション | 型 | 説明 |
|-----------|-----|-----|
| `operation` | `string` | 操作名（ログ・デバッグ用） |
| `operationType` | `"read" \| "write"` | 操作種別 |
| `access` | `RouteAccess` | **必須**。`"public" \| "authenticated" \| "custom" \| { roles?, roleCategories? }`。`"custom"` 以外は factory が認可を強制。型必須のため宣言漏れはコンパイルエラー |
| `skipForDemo` | `boolean \| undefined` | デモユーザー時のスキップ制御 |

`access` の選び方は上記「どのファクトリーを使うか」を参照。`"custom"` のハンドラでは
`@/features/core/auth/services/server/requireRole` の `requireAdmin()` / `requireAuthenticated()` で守る
（失敗時 `DomainError` を throw し factory が 401/403 に変換。ロール判定は DB 同期の `getSessionUser`）。
デバッグ用ルートの雛形は `src/app/api/debug/ping/route.ts`（`access: ADMIN_OR_DEBUGGER_RULE`）。

#### `skipForDemo` の挙動

| 値 | 挙動 |
|----|-----|
| `undefined`（省略） | `operationType: "write"` なら自動スキップ、`"read"` なら実行 |
| `true` | デモユーザーの場合は常にスキップ |
| `false` | デモユーザーでも必ず実行（ログイン処理など） |

スキップ時のレスポンス: `{ success: true, demo: true }`

---

### 2. `createDomainRoute` - 汎用CRUDファクトリー

`/api/[domain]/**` 配下の汎用CRUDルート専用のファクトリーです。
serviceRegistryからドメインサービスを自動取得し、ハンドラに渡します。

```ts
import { createDomainRoute } from "@/lib/routeFactory";

type Params = { domain: string };

export const GET = createDomainRoute<any, Params>(
  { operation: "GET /api/[domain]", operationType: "read" },
  async (_req, { service }) => {
    return service.list();
  },
);
```

#### アクセスポリシー（serviceRegistry の `access`）

アクセスポリシーは serviceRegistry の登録エントリ（`{ service, access }`）で宣言する（型必須）。

```ts
// src/registry/serviceRegistry.ts
sample: {
  service: sampleService,
  access: {
    read: "public",
    write: { roleCategories: ["admin"] },
    operations: { update: "authenticated", reorder: "authenticated" },
  },
},
```

- 編集元: 自動生成ドメインは domain.json の `apiAccess`（`dc:init` が対話で確認し、`dc:generate` が registry に展開）。
  手動登録のコアドメインは registry に直接書く。ルール値・スキーマは `src/features/README.md`「ApiAccess」
- 解決順: `operations[操作名]` → `read` / `write` → `defaultRule`（`resolveAccessRule`、`src/lib/domain/config/apiAccess.ts`）。
  空 `{}` や部分宣言でも `defaultRule`（admin カテゴリのみ、`src/config/app/domain-api-access.config.ts`）に倒れる（fail-closed）
- 判定（`enforceAccess.ts`）: registry 未登録 / `"none"` → 404（text/plain）| 未認証 → 401 | 権限不足・利用不可ステータス
  （`USER_AVAILABLE_STATUSES` 外）→ 403。`"public"` / `"none"` ではセッション取得（DB 引き）をしない
- プリセット（同 config）: `ADMIN_ONLY` / `PUBLIC_READ`（公開読み取り + 管理者書き込み）/ `ADMIN_OR_DEBUGGER`。
  単一ルール版 `ADMIN_OR_DEBUGGER_RULE` は `operations` の上書きや `createApiRoute` の `access` にも使える
- **公開 read の判断基準**: `"public"` にしてよいのは「全レコードが公開情報」のドメインのみ（公開記事・商品マスタ等）。
  search / count / withRelations 展開も含めて全件見える前提で判断する
- **`authenticated` はオーナーシップを守らない**: where の `user_id` がクライアント任せなので他人のレコードも読める。
  ユーザー所有データの汎用 API は admin 限定にし、本人向けは createMeRoute で出す
- **sample ドメインの例外**: `/demo` ページ（`sortable-list` の reorder、`tables` のインライン update）が使うため、
  `src/features/sample/domain.json` の `apiAccess.operations` で `update` / `reorder` のみ `authenticated` に緩和している。
  フォーク先で demo ページを削除する場合はこの緩和も削除する

> **注意（よくある誤解）**: `/api/<domain>/` に独自の静的サブルート（例 `/api/coupon/redeem`）が
> あっても、汎用 `/api/[domain]/**` は**そのまま動く**。「静的フォルダが汎用ルートをシャドーして 404 に
> なる」ことは**無い**（Next.js はフルパスでマッチし、静的は完全一致パスだけを占有する。
> `/api/users/[id]` と `/api/users/export` が同居できるのと同じ理屈）。ミラールートのような対策は不要。
> client で setting 等が読めない場合はルーティングではなく**アクセス制御**（例: setting は `ADMIN_ONLY` のため
> 非管理者の `useSetting()` は 401）を疑う。非管理者に読ませたい設定は専用の読み取りルートを用意する。
>
> 確認は推測でなく、dev サーバーへ未認証で `curl -i` を投げて**ステータスと content-type** で判定する:
>
> - `401` / `403` の JSON（例 `{"message":"認証が必要です。"}`）→ 汎用ルートに**到達している**（認可で弾かれただけ）
> - `404` + `content-type: text/plain`（本文 `Not Found`）→ `[domain]` ハンドラには到達。registry 未登録 or `access` が `"none"`
> - `404` + `content-type: text/html`（Next の 404 ページ）→ **本物のルーティング欠落**
>
> ```
> curl -i http://localhost:3000/api/setting/global          # 401 JSON（静的 setting/setup があっても到達）
> curl -i -X POST http://localhost:3000/api/coupon/count    # 401 JSON
> ```

---

### 3. `createMeRoute` - 本人専用ファクトリー（オーナーシップ）

`/api/me/**` 配下の「自分のデータだけ」を扱うルート専用。認証を強制し、ハンドラに
**認証済み `user`（DB 同期）** を渡す。`access` は不要（内部で認証を強制する）。

```ts
import { createMeRoute, ownerWhere } from "@/lib/routeFactory";

export const GET = createMeRoute(
  { operation: "GET /api/me/wallet", operationType: "read" },
  async (_req, { user }) => {
    // ownerWhere(user) で本人スコープを固定（クライアント指定の id は使わない）
    const result = await walletService.search({ where: ownerWhere(user) });
    return { wallets: result.results ?? [] };
  },
);
```

#### `allowStatuses` — 利用制限中でも本人が完了すべき手続き

既定では `active` のユーザーだけ通す（`USER_AVAILABLE_STATUSES`）。「処分保留中でも回答が
必要」な手続き（不正疑いチャレンジ・異議申立て・再有効化・KYC 等）は、そのルートに限って
`allowStatuses` を明示する。列挙していないステータスは常に 403（fail-closed）。
`authGuard` の `allowStatuses` と同じ語彙なので、ページ側の guard と揃えやすい。

```ts
export const POST = createMeRoute(
  {
    operation: "POST /api/me/fingerprint-challenges/[token]/submit",
    operationType: "write",
    allowStatuses: ["active", "suspended"], // config 定数から渡すのが望ましい
  },
  async (req, { user }) => { /* user.status は active か suspended */ },
);
```

`requireAuthenticated({ allowStatuses })` も同じオプションを受ける（`createApiRoute` +
`access: "custom"` で自前ガードする場合）。

### 4. `createDeviceRoute` - 登録端末専用ファクトリー

登録端末（pairedDevice）を主体にするルート。端末の認証を強制し、ハンドラに **認証済みの `device`**
（`kind` ごとに型の付いた `scope`）を渡す。店舗・テーブル等の所属は `device.scope` から取り、クライアントが送る id は使わない。

```ts
import { createDeviceRoute } from "@/lib/routeFactory";

export const POST = createDeviceRoute(
  { operation: "POST /api/terminal/lending", operationType: "write", kinds: ["table_terminal"] },
  async (req, { device }) => lendingService.request({ tableId: device.scope.tableId }),
);
```

- 端末でない → 401、kind 違い → 403。監査ログの actor は `device`
- `orUser: "authenticated" | { roles?, roleCategories? }` を付けると、ルールに合うログインユーザーも通る（`ctx.principal` で分岐）
- `rateLimit` は端末 id / ユーザー id 単位（店内の端末は同じ IP から来るため IP 単位にしない）
- 端末の Cookie はユーザーの認可に影響しない（端末で `createMeRoute` や `"authenticated"` のルートは通らない）
- 詳細・ペアリング・ページ側のガード（`deviceGuard`）: `src/features/core/pairedDevice/README.md`

---

## 使用例

### 本人のデータを返す（createMeRoute）

```ts
export const GET = createMeRoute(
  { operation: "GET /api/me/wallet", operationType: "read" },
  async (_req, { user }) => walletService.search({ where: ownerWhere(user) }),
);
```

### ログイン必須の書き込み（createApiRoute + access）

```ts
export const POST = createApiRoute(
  {
    operation: "POST /api/storage/upload",
    operationType: "write",
    access: "authenticated",
  },
  async (req) => storageService.upload(req), // 未認証→401 / 利用停止→403 は factory が処理済み
);
```

### 署名検証付き webhook（access: "public"）

```ts
export const POST = createApiRoute(
  {
    operation: "POST /api/webhook/payment",
    operationType: "write",
    access: "public",       // 未認証で叩かれるのが正当。正当性は署名で担保する
    skipForDemo: false,
  },
  async (req) => { /* 署名検証 → 処理 */ },
);
```

### 自前認可が必要なルート（access: "custom"）

```ts
export const POST = createApiRoute(
  { operation: "POST /api/example", operationType: "write", access: "custom" },
  async (req) => {
    const user = await requireAuthenticated(); // 条件付き認可などをハンドラ内で行う
    /* ... */
  },
);
```

---

## lint（route-authz/require-authz）

`eslint-rules/route-authz.mjs` が `src/app/api/**/route.ts` の `createApiRoute` 呼び出しを検査する（warn）。

- `access` 宣言済み（`"custom"` 以外）→ OK
- `access: "custom"` なのにファイル内に認可の痕跡（`getSessionUser` / `requireAdmin` / `requireAuthenticated` /
  `session` 参照 等）が無い → 警告
- `access` 未宣言 → 警告（型必須のため通常はコンパイルエラーが先に出る）

フォーク先で独自の認可ヘルパーを足した場合は `route-authz.mjs` の `AUTH_SIGNALS` に関数名を追加する。

---

## 禁止事項・アンチパターン

- ファクトリーを経由せずに直接ハンドラをエクスポートすること
- `operationType` / `access` を省略すること（access は型必須）
- ユーザー所有データを汎用 `/api/[domain]` で出すこと（オーナーシップを強制できない。createMeRoute を使う）
- デモスキップの判断をハンドラ内で行うこと（ファクトリーに委譲する）
- **ハンドラの `ctx.session` でロール判定する**: token-only セッションのためロール剥奪・利用停止が即時反映されない。
  factory の `access` か `requireAdmin` / `requireAuthenticated`（DB 同期の `getSessionUser`）に任せる
- **`operationType: "write"` を認可と勘違いする**: デモスキップ・監査用で認可とは無関係
- **オーナーシップをロールだけで代替する**: `authenticated` でも他人のレコードは見える。`ownerWhere(user)` で絞る
- **`access: "custom"` で実際には何も守らない**: custom は「自前で守る」宣言。守らないなら適切な access を宣言する

---

## PR 前チェックリスト

- [ ] 汎用 CRUD で足りるなら手書きせず createDomainRoute（serviceRegistry の access）で宣言したか
- [ ] 本人専用データは createMeRoute（/api/me）にし、`ownerWhere(user)` でサーバー側スコープしたか
- [ ] `access: "custom"` のルートはハンドラ内で実際に認可しているか
- [ ] webhook はハンドラ内で署名/トークン検証しているか
- [ ] `pnpm tsc --noEmit` と `pnpm lint`（route-authz 警告 0）が通るか

---

## トラブルシューティング

- **管理画面の一覧が 403**: 対象ドメインの registry `access` が admin 限定で、ログイン中ユーザーのロールカテゴリが admin でない
- **公開ページの一覧取得が 401**: registry の `read` が `"public"` でない。公開してよいデータか（上記判断基準）を確認してから宣言する
- **wallet 等で本人のデータが取れない**: 汎用 `/api/[domain]` ではなく `/api/me/**`（createMeRoute）を使う
- **静的サブルートを持つドメインの汎用パスが 404 / 401**: シャドーイングではない。上記「注意（よくある誤解）」の curl で判定する

---

## 関連ドキュメント

- `src/features/README.md`「ApiAccess」 - domain.json の `apiAccess` スキーマ（generator が registry へ展開）
- `src/features/core/auth/services/server/requireRole.ts` - 認可ヘルパー（custom ルート用）
- `docs/!must-read/アプリ構築における構成層.md` - 全体アーキテクチャ
