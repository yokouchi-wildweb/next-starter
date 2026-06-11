# 汎用 API アクセス制御ガイド

`/api/[domain]/**` の汎用 CRUD ルートに対するロールベースのアクセス制御の採用ガイド。

> 本書は設計思想・仕組みの解説。**実装手順・コピペ可能なパターン・棚卸し手順**は
> [APIルート認可実装ガイド](./APIルート認可実装ガイド.md) を参照。

## 背景

汎用ドメインルートは serviceRegistry に登録された全ドメインの CRUD を HTTP 経由で公開する。
かつてはここに認可ガードがなく、未認証の第三者が任意ドメインのデータを読み書きできる脆弱性があった。
現在は `createDomainRoute`（`src/lib/routeFactory/createDomainRoute.ts`）が domain.json の
`apiAccess` 宣言に基づいて全ルートを一元的にガードする。

## 仕組み

```
リクエスト
  → createDomainRoute
      → serviceRegistry からサービス解決（無ければ 404）
      → resolveDomainApiAccessRule(domain, crudOp, operationType)   … src/lib/domain
      → evaluateApiAccessRule(rule, sessionUser)                     … features/core/auth
          granted → ハンドラ実行 / none → 404 / 未認証 → 401 / 権限不足 → 403
```

- ロール判定には **DB 同期される `getSessionUser()`** を使用する（token-only セッションでは
  ロール剥奪・利用停止が即時反映されないため）。`rule: "public"` の場合は DB 引きをしない
- 利用停止中（`USER_AVAILABLE_STATUSES` 外）のユーザーは認証済みでも 403

## 宣言方法

domain.json に `apiAccess` を追加する（スキーマ詳細: `src/features/README.md`「ApiAccess」）。

```json
"apiAccess": {
  "read": "public",
  "write": { "roleCategories": ["admin"] },
  "operations": { "hardDelete": "none" }
}
```

| ルール | 意味 |
|--------|------|
| `"public"` | 未認証でもアクセス可 |
| `"authenticated"` | ログイン済み（利用可能ステータス）なら誰でも可 |
| `"none"` | 汎用 API を無効化（404） |
| `{ "roles": [...], "roleCategories": [...] }` | 指定ロール ID / カテゴリのみ可（OR 条件） |

解決の優先順位: `operations[操作名]` → `read` / `write` → グローバル既定値。

## フォールバック（fail-closed）

- `apiAccess` 未宣言のドメイン、および domain.json を持たないが serviceRegistry に登録されている
  ドメイン（wallet, setting 等）は **admin カテゴリのみ許可** にフォールバックする
- 既定値は `src/config/app/domain-api-access.config.ts` の `defaultRule` で変更可能
- 開発環境では未宣言ドメインへのアクセス時に警告ログが出る（`warnOnFallback`）

新ドメイン追加時は `dc:init` が read / write の許可範囲を対話で確認し、domain.json に明示宣言する。

## カスタムルートの認可（重要）

ここまでの仕組みは **汎用ルート（`createDomainRoute`）専用**。`createApiRoute` を直接使う
手書きルート（`src/app/api/**/route.ts`）は **認可を書かなくても通る（fail-open）**。
domain.json の `apiAccess` は効かないため、**各ルートのハンドラ内で明示的に認可する**こと。

### 認可ヘルパー

`@/features/core/auth/services/server/requireRole` の以下を**ハンドラ先頭で呼ぶ**。
失敗時は `DomainError` を throw し、`createApiRoute` が 401 / 403 に変換する。
ロール判定は DB 同期される `getSessionUser` を使う（`ctx.session` は token-only のため認可に使わない）。

```ts
import { requireAdmin, requireAuthenticated } from "@/features/core/auth/services/server/requireRole";

export const POST = createApiRoute({ operation: "...", operationType: "write" }, async (req) => {
  await requireAdmin();          // 管理者限定（未認証→401 / 非admin・利用停止→403）
  // または await requireAuthenticated();  // ログイン必須（未認証→401 / 利用停止→403）
  ...
});
```

オーナーシップ（自分のレコードのみ）が必要なら、`requireAuthenticated()` で得た
`user.userId` をハンドラ内で where 条件に使うか、`/api/me/` 系の専用ルートで提供する。

### 未認証で公開するルート

ログイン前処理・署名検証付き webhook・公開マスタ等、未認証が正当なルートは
**理由付きで lint を抑止**して「意図的公開」であることを記録する。

```ts
// eslint-disable-next-line route-authz/require-authz -- 公開: <理由>
export const POST = createApiRoute(...);
```

### lint による検出

`eslint-rules/route-authz.mjs`（`route-authz/require-authz`）が、`createApiRoute` を使うのに
認可ヘルパーも `session` 参照も無いルートを **warn** で検出する。新規ルートで認可を書き忘れると
警告が出るので、認可を足すか、上記の理由付き抑止で公開を明示すること。

## 設計指針

### オーナーシップ制御はできない

ロールガードのみで「自分のレコードだけ」という制御はできない。`"read": "authenticated"` を
設定すると**他ユーザーのレコードも読める**。ユーザー所有データ（notification, wallet 等）の
汎用 API は admin-only のままにし、ユーザー向けアクセスは `/api/me/` 系など所有者スコープを
強制する専用ルートで提供すること。

### 公開 read の判断基準

未認証アクセスを許可してよいのは「全レコードが公開情報」のドメインのみ
（例: 公開記事、商品マスタ）。検索・count・withRelations 展開も含めて全件が見える前提で判断する。

### sample ドメインの例外

`sample` は `/demo` ページ（公開デモ）が update / reorder を使うため、該当操作のみ
`authenticated` に緩和している。フォーク先で demo ページを削除する場合は
`operations` の緩和も削除すること。

## トラブルシューティング

- **管理画面の一覧が 403 になる**: 対象ドメインの domain.json に `apiAccess` が未宣言で、
  ログイン中ユーザーのロールカテゴリが admin でない。apiAccess を宣言するか、ロールを確認する
- **公開ページで一覧取得が 401 になる**: `read: "public"` が未宣言。公開してよいデータか
  確認した上で宣言する
- **dev コンソールに `[domainApiAccess]` 警告が出る**: そのドメインの apiAccess が未宣言。
  fail-closed で動作はするが、明示宣言を推奨
