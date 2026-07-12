# API ルート認可実装ガイド

API ルートを **作る / 守る** ときの実装手順・パターン・チェックリスト。
設計思想と仕組みの背景は [汎用APIアクセス制御ガイド](./汎用APIアクセス制御ガイド.md) を参照。

> 対象読者: 本テンプレート（および各フォーク）で API ルートを実装する開発者。
> 新規ルートを書く前に読む。

---

## 大前提: API ルートは必ずいずれかのファクトリーを通す

すべての API ルートは 3 つのファクトリーのいずれかで作る。各ファクトリーが**構造的に認可を強制**する。

| ファクトリー | 用途 | 認可の効き方 |
|------|------|--------------|
| `createDomainRoute` | 汎用 CRUD（`/api/[domain]/**`、自動生成） | serviceRegistry の `access` で強制（**fail-closed**） |
| `createApiRoute` | 手書きカスタムルート | `access` が**型必須**。宣言しないとコンパイルが通らない（**fail-closed by construction**） |
| `createMeRoute` | 本人専用（`/api/me/**`、オーナーシップ） | 認証を強制し、ハンドラに認証済み `user` を渡す |

いずれも `access` の宣言（または createMeRoute の利用）を**書き忘れると型エラー or 弾かれる**ため、「認可を考えずにルートを書く」ことができない。

---

## 決定木: どのファクトリーを使うか

```
新しい API を作りたい
│
├─ ドメインの標準 CRUD で足りる？
│   └─ YES → createDomainRoute（手書き不要）。serviceRegistry の access で宣言 →「① 汎用」
│
├─ 自分（ログインユーザー本人）のデータだけを扱う？
│   └─ YES → createMeRoute（/api/me/**）→「③ オーナーシップ」
│
└─ それ以外（独自ロジック・特殊入出力）→ createApiRoute →「② カスタム」
        access を必ず宣言:
        ├─ 未認証で正当（ログイン前・署名付きwebhook・公開マスタ）→ "public"
        ├─ ログインユーザーなら誰でも　　　　　　　　　　　　　 → "authenticated"
        ├─ 管理者のみ　　　　　　　　　　　　　　　　　　　　　 → { roleCategories: ["admin"] }
        └─ ファクトリーに任せられない独自認可（署名検証等）　　 → "custom"（自前で守る）
```

---

## ① 汎用ルート（createDomainRoute）

手書き不要。アクセスポリシーは **serviceRegistry の登録エントリ**で宣言する。

```ts
// src/registry/serviceRegistry.ts
sample: {
  service: sampleService,
  access: { read: "public", write: { roleCategories: ["admin"] } },
},
```

- 自動生成ドメイン: domain.json の `apiAccess` を `dc:generate` が registry に展開する（domain.json が編集元）
- 手動登録ドメイン（コアドメイン）: registry に直接 access を書く
- access は**型必須**。空 `{}` でも `defaultRule`（admin 限定）にフォールバックし安全側に倒れる
- ルール値: `"public"` | `"authenticated"` | `"none"` | `{ roles?, roleCategories? }`、操作単位の上書きは `operations`
- プリセット（`src/config/app/domain-api-access.config.ts`）: `ADMIN_ONLY`（管理者のみ）/ `PUBLIC_READ`（公開読み取り + 管理者書き込み）/ `ADMIN_OR_DEBUGGER`（管理者カテゴリ + デバッガーロール）
- スキーマ詳細: `src/features/README.md`「ApiAccess」

---

## ② カスタムルート（createApiRoute）

`access` を**必ず**宣言する（型必須）。`"custom"` 以外はファクトリーが認可を強制する。

### ②-a public（未認証で正当）

```ts
export const POST = createApiRoute(
  { operation: "...", operationType: "write", access: "public" },
  async (req) => { /* webhook なら署名検証をここで行う */ },
);
```

### ②-b authenticated（ログイン必須）

```ts
export const POST = createApiRoute(
  { operation: "...", operationType: "write", access: "authenticated" },
  async (req) => { /* 未認証→401 / 利用停止→403 は factory が処理 */ },
);
```

### ②-c admin（管理者限定）

```ts
export const GET = createApiRoute(
  { operation: "...", operationType: "read", access: { roleCategories: ["admin"] } },
  async (req) => { /* 未認証→401 / 非admin→403 は factory が処理 */ },
);
```

> 管理者 + デバッガーロールに開放したいデバッグ用ルートは、プリセットの単一ルール版
> `ADMIN_OR_DEBUGGER_RULE`（`@/config/app/domain-api-access.config`）をそのまま `access` に渡せる。
> 実例（雛形）: `src/app/api/debug/ping/route.ts`。画面側の雛形は `src/app/debug/`（layout が一括ガード）。

### ②-d custom（自前認可）

webhook の署名検証など、ファクトリーの宣言的認可に乗らない独自ガードを持つルート。
`access: "custom"` を宣言し、ハンドラ内で自前に守る。認可ヘルパーは
`@/features/core/auth/services/server/requireRole` の `requireAdmin()` / `requireAuthenticated()` を使える
（失敗時 `DomainError` を throw し factory が 401/403 に変換。ロール判定は DB 同期の `getSessionUser`）。

```ts
export const POST = createApiRoute(
  { operation: "...", operationType: "write", access: "custom" },
  async (req) => {
    // 例: 署名検証 / 独自トークン検証 / 条件付き認可
  },
);
```

---

## ③ オーナーシップ専用ルート（createMeRoute）

「自分のレコードだけ」を扱うユーザー向け API は `/api/me/**` に置き、`createMeRoute` で作る。
認証が強制され、ハンドラに**認証済み `user`（DB 同期）が渡る**。

```ts
// src/app/api/me/wallet/route.ts
import { createMeRoute, ownerWhere } from "@/lib/routeFactory";

export const GET = createMeRoute(
  { operation: "GET /api/me/wallet", operationType: "read" },
  async (_req, { user }) => {
    // ownerWhere(user) = { field: "user_id", op: "eq", value: user.userId }
    const result = await walletService.search({ where: ownerWhere(user) });
    return { wallets: result.results ?? [] };
  },
);
```

- `access` は不要（createMeRoute が内部で認証を強制する）
- **オーナーシップは `ownerWhere(user)` でサーバー側スコープを固定する**（所有者カラムが `user_id` 以外なら
  `ownerWhere(user, "owner_id")`）。汎用 `/api/[domain]` はクライアント指定の `user_id` を信用してしまうため、
  ユーザー所有データは createMeRoute に集約する
- 他ユーザーのデータを見る管理用途は createMeRoute ではなく admin 用ルート（`{ roleCategories: ["admin"] }`）で

---

## lint による検出（route-authz/require-authz）

`eslint-rules/route-authz.mjs` が `createApiRoute` の `access` 宣言を検査する。

- `access` が宣言済み（非 custom）→ OK（factory が強制 / 意図的公開）
- `access: "custom"` なのにハンドラ内に認可の痕跡（`getSessionUser` / `requireAdmin` / `session` 参照 等）が無い → **警告**
- `access` 未宣言 → **警告**（型必須のため通常はコンパイルエラーが先に出る）

フォーク先で独自の認可ヘルパーを足した場合は `route-authz.mjs` の `AUTH_SIGNALS` に関数名を追加する。

---

## PR 前チェックリスト

- [ ] 汎用 CRUD で足りるなら手書きせず createDomainRoute（serviceRegistry の access）で宣言したか
- [ ] 本人専用データは createMeRoute（/api/me）にしたか
- [ ] createApiRoute に `access` を宣言したか（public/authenticated/custom/{roleCategories}）
- [ ] `access: "custom"` のルートはハンドラ内で実際に認可しているか
- [ ] オーナーシップは `user.userId` でサーバー側スコープしたか（他人のデータが返らないか）
- [ ] webhook はハンドラ内で署名/トークン検証しているか
- [ ] `pnpm tsc --noEmit` と `pnpm lint`（route-authz 警告 0）が通るか

---

## アンチパターン

- **`ctx.session` でロール判定する**: token-only のためロール剥奪・利用停止が即時反映されない。
  認可は factory の `access` か `requireAdmin/requireAuthenticated`（= DB 同期の `getSessionUser`）に任せる。
- **`operationType: "write"` を認可と勘違いする**: デモスキップ・監査ログ用で認可とは無関係。
- **ユーザー所有データを汎用 `/api/[domain]` で出す**: where の `user_id` がクライアント任せでオーナーシップを
  強制できない。createMeRoute（/api/me）に置く。
- **オーナーシップをロールだけで代替する**: `authenticated` でも他人のレコードは見える。`user.userId` 絞り必須。
- **`access: "custom"` で実際には何も守らない**: custom は「自前で守る」宣言。守らないなら適切な access を宣言する。

---

## 関連

- [汎用APIアクセス制御ガイド](./汎用APIアクセス制御ガイド.md) — 設計思想・fail-closed・registry co-location
- `src/lib/routeFactory/` — `createDomainRoute` / `createApiRoute` / `createMeRoute`
- `src/features/core/auth/services/server/requireRole.ts` — 認可ヘルパー（custom ルート用）
- `eslint-rules/route-authz.mjs` — access 宣言の検査
- `src/features/README.md`「ApiAccess」 — domain.json スキーマ（generator が registry へ展開）
