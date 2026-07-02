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

---

### 4. 固定ドメインファクトリー（静的フォルダ・シャドーイング対策）

**問題**: Next.js App Router は静的セグメントを動的 `[domain]` より優先解決する。
登録済みドメイン `<domain>` に対し `src/app/api/<domain>/`（例: `/api/setting/setup`,
`/api/coupon/redeem`）という静的フォルダが存在すると、`/api/<domain>/<id>` や
`/api/<domain>/search` 等の汎用オペレーションが `/api/[domain]/**` にフォールバックせず
**404** になる。SSR は service 直呼びで HTTP を通らないため、クライアント CRUD
（`createApiClient` / `use<Domain>` / `useUpdate<Domain>`）が使われて初めて露見する。

**対策**: 静的フォルダを持つドメインは、必要な汎用オペレーションを固定ドメイン
ファクトリーで **同じ場所に再公開** する。認可（serviceRegistry の access）・URLスキーム・
ハンドラ実装は汎用ルートと完全に同一（`domainRoutes.ts` の単一ソースを共有）。domain を
params から読むか固定値で解決するかだけが違う。

```ts
// src/app/api/<domain>/route.ts        （list + create）
export const { GET, POST } = createDomainCollectionRouteFor("<domain>");
// src/app/api/<domain>/[id]/route.ts   （get + update + remove）
export const { GET, PUT, DELETE } = createDomainIdRouteFor("<domain>");
// src/app/api/<domain>/search/route.ts
export const { GET } = createDomainSearchRouteFor("<domain>");
// src/app/api/<domain>/upsert/route.ts
export const { PUT } = createDomainUpsertRouteFor("<domain>");
```

利用可能なファクトリー（各 route.ts に対応。ドメインが実際に使うオペレーションだけ mirror すればよい）:

- `createDomainCollectionRouteFor` → `route.ts`（GET list / POST create）
- `createDomainIdRouteFor` → `[id]/route.ts`（GET / PUT / DELETE）
- `createDomainSearchRouteFor` → `search/route.ts`
- `createDomainSearchForSortingRouteFor` → `search-for-sorting/route.ts`
- `createDomainCountRouteFor` → `count/route.ts`
- `createDomainUpsertRouteFor` → `upsert/route.ts`
- `createDomainDuplicateRouteFor` → `[id]/duplicate/route.ts`
- `createDomainHardDeleteRouteFor` → `[id]/hard-delete/route.ts`
- `createDomainReorderRouteFor` → `[id]/reorder/route.ts`
- `createDomainRestoreRouteFor` → `[id]/restore/route.ts`
- `createDomainBulk{DeleteByIds,DeleteByQuery,Update,UpdateByIds,Upsert}RouteFor` → `bulk/*/route.ts`

**CI ガード**: `pnpm check:route-shadow`（`scripts/check/domain-route-shadow.mjs`）が、
`createApiClient("/api/<domain>")` で汎用クライアント CRUD を束縛しているのに静的フォルダで
`[id]` ルートを再公開していないドメインを検出して失敗する。新しく静的フォルダを追加した際の
シャドーイング再発を防ぐ。

---

## 使用例

### 本人のデータを返す（createMeRoute）

```ts
export const GET = createMeRoute(
  { operation: "GET /api/me/wallet", operationType: "read" },
  async (_req, { user }) => walletService.search({ where: ownerWhere(user) }),
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
