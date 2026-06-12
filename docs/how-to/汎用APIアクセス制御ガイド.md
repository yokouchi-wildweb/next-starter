# 汎用 API アクセス制御ガイド

API ルートのアクセス制御の**設計思想・仕組み**の解説。

> **実装手順・コピペ可能なパターン・棚卸し手順**は
> [APIルート認可実装ガイド](./APIルート認可実装ガイド.md) を参照。

## 背景

API ルートは 3 つのファクトリーのいずれかで作る（`createDomainRoute` / `createApiRoute` / `createMeRoute`）。
かつては汎用ルートに認可ガードが無く、未認証の第三者が任意ドメインのデータを読み書きできる脆弱性、
および手書きルートが認可を書かなくても通る（fail-open）構造的盲点があった。
現在は各ファクトリーが**構造的に認可を強制**する（access の型必須化・registry co-location・createMeRoute）。

## 汎用ルートの仕組み（createDomainRoute）

```
リクエスト
  → createDomainRoute
      → serviceRegistry からエントリ解決（無ければ 404）。entry = { service, access }
      → resolveAccessRule(entry.access, crudOp, operationType)   … src/lib/domain（純関数）
      → enforceAccessRule(rule)                                   … src/lib/routeFactory
          granted → ハンドラ実行 / none → 404 / 未認証 → 401 / 権限不足 → 403
```

- アクセスポリシーの**実行時ソースは serviceRegistry のエントリ（`access`）**。lib/domain は registry を
  import せず純関数で解決し、client-safe を保つ（access は server の routeFactory が渡す）
- ロール判定には **DB 同期される `getSessionUser()`** を使用する（token-only セッションでは
  ロール剥奪・利用停止が即時反映されないため）。`rule: "public"` の場合は DB 引きをしない
- 利用停止中（`USER_AVAILABLE_STATUSES` 外）のユーザーは認証済みでも 403

## アクセスポリシーの宣言

汎用ルートのポリシーは **serviceRegistry の登録エントリ**で宣言する（型必須）。

```ts
// src/registry/serviceRegistry.ts
sample: {
  service: sampleService,
  access: { read: "public", write: { roleCategories: ["admin"] }, operations: { update: "authenticated" } },
},
```

- **自動生成ドメイン**: domain.json の `apiAccess` を `dc:generate` が registry に展開する（domain.json が編集元）
- **手動登録ドメイン**（コアドメイン: wallet/setting 等）: registry に直接 access を書く

| ルール | 意味 |
|--------|------|
| `"public"` | 未認証でもアクセス可 |
| `"authenticated"` | ログイン済み（利用可能ステータス）なら誰でも可 |
| `"none"` | 汎用 API を無効化（404） |
| `{ "roles": [...], "roleCategories": [...] }` | 指定ロール ID / カテゴリのみ可（OR 条件） |

解決の優先順位: `operations[操作名]` → `read` / `write` → `defaultRule`。

## フォールバック（fail-closed）

- access は型必須のため、登録時に宣言を省略できない（`access:` を書かないとコンパイルエラー）
- access が当該操作のルールを持たない（部分宣言・空 `{}`）場合は `defaultRule`（admin カテゴリのみ）に倒れる
- 既定値は `src/config/app/domain-api-access.config.ts` の `defaultRule` で変更可能

新ドメイン追加時は `dc:init` が read / write の許可範囲を対話で確認し、domain.json に宣言する
（generator が registry に展開する）。

## カスタムルート / オーナーシップ

- **カスタムルート**（`createApiRoute`）は `access` が**型必須**。`"public" | "authenticated" | "custom" | { roleCategories }`
  を宣言し、`"custom"` 以外はファクトリーが認可を強制する。`"custom"` はハンドラ内で自前認可する明示宣言
- **オーナーシップ**（自分のレコードのみ）は `createMeRoute`（`/api/me/**`）で実現する。認証を強制し、
  ハンドラに認証済み `user` を渡す。`user.userId` をサーバー側で where に使い、クライアント指定の id は信用しない

詳細な実装は [APIルート認可実装ガイド](./APIルート認可実装ガイド.md)。

## 設計指針

### ロールガードだけではオーナーシップを守れない

`access: "authenticated"` を設定しても、汎用 `/api/[domain]` は where の `user_id` がクライアント任せで
**他ユーザーのレコードも読める**。ユーザー所有データ（wallet 等）の汎用 API は admin 限定にし、
ユーザー向けは `createMeRoute`（`/api/me/**`）で所有者スコープを強制する。

### 公開 read の判断基準

未認証アクセスを許可してよいのは「全レコードが公開情報」のドメインのみ
（例: 公開記事、商品マスタ）。検索・count・withRelations 展開も含めて全件が見える前提で判断する。

### sample ドメインの例外

`sample` は `/demo` ページ（公開デモ）が update / reorder を使うため、該当操作のみ
`authenticated` に緩和している。フォーク先で demo ページを削除する場合は
`operations` の緩和も削除すること。

## トラブルシューティング

- **管理画面の一覧が 403 になる**: 対象ドメインの registry エントリの access が admin 限定で、
  ログイン中ユーザーのロールカテゴリが admin でない。access を見直すかロールを確認する
- **公開ページで一覧取得が 401 になる**: registry の `read` が `"public"` でない。公開してよいデータか
  確認した上で宣言する
- **wallet 等で本人のデータが取れない**: 汎用 `/api/[domain]` ではなく `/api/me/**`（createMeRoute）を使う
