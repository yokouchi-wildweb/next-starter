# routeFactory - APIルートファクトリー

すべてのAPIルートは、このファクトリーを経由して作成する必要があります。
直接 `export const GET = async (req) => { ... }` のようなハンドラを書くことは禁止されています。

---

## なぜファクトリーが必要か

1. **共通処理の一元管理**: 認証、エラーハンドリング、デモモード制御などを一箇所で管理
2. **将来の拡張性**: 新しい共通処理（ログ、レート制限等）を追加する際にファクトリーのみ修正すればよい
3. **一貫性の担保**: すべてのAPIルートが同じ構造・挙動を持つ

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

`access` の選び方・パターンは [APIルート認可実装ガイド](../../../docs/how-to/APIルート認可実装ガイド.md) を参照。

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

アクセスポリシーは serviceRegistry の登録エントリ（`{ service, access }`）で宣言する（型必須）。

---

### 3. `createMeRoute` - 本人専用ファクトリー（オーナーシップ）

`/api/me/**` 配下の「自分のデータだけ」を扱うルート専用。認証を強制し、ハンドラに
**認証済み `user`（DB 同期）** を渡す。`access` は不要（内部で認証を強制する）。

```ts
import { createMeRoute } from "@/lib/routeFactory";

export const GET = createMeRoute(
  { operation: "GET /api/me/wallet", operationType: "read" },
  async (_req, { user }) => {
    // user.userId でサーバー側スコープを強制（クライアント指定の id は使わない）
    const result = await walletService.search({
      where: { field: "user_id", op: "eq", value: user.userId },
    });
    return { wallets: result.results ?? [] };
  },
);
```

---

## 使用例

### 本人のデータを返す（createMeRoute）

```ts
export const GET = createMeRoute(
  { operation: "GET /api/me/wallet", operationType: "read" },
  async (_req, { user }) => walletService.search({
    where: { field: "user_id", op: "eq", value: user.userId },
  }),
);
```

### 管理者限定の書き込み（createApiRoute + access）

```ts
export const POST = createApiRoute(
  {
    operation: "POST /api/storage/upload",
    operationType: "write",
    access: "authenticated",
  },
  async (req) => storageService.upload(req), // 認可は factory が処理済み
);
```

### 自前認可が必要なルート（access: "custom"）

```ts
export const POST = createApiRoute(
  {
    operation: "POST /api/webhook/payment",
    operationType: "write",
    access: "custom",       // 署名検証など独自ガードを自前で行う
    skipForDemo: false,
  },
  async (req) => { /* 署名検証 → 処理 */ },
);
```

---

## 禁止事項

- ファクトリーを経由せずに直接ハンドラをエクスポートすること
- `operationType` / `access` を省略すること（access は型必須）
- ユーザー所有データを汎用 `/api/[domain]` で出すこと（オーナーシップを強制できない。createMeRoute を使う）
- デモスキップの判断をハンドラ内で行うこと（ファクトリーに委譲する）

---

## 関連ドキュメント

- [APIルート認可実装ガイド](../../../docs/how-to/APIルート認可実装ガイド.md) - access / 3 ファクトリーの実装手順
- [汎用APIアクセス制御ガイド](../../../docs/how-to/汎用APIアクセス制御ガイド.md) - 設計思想・仕組み
- `docs/!must-read/アプリ構築における構成層.md` - 全体アーキテクチャ
