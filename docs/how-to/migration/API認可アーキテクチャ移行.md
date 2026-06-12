# 【移行】API 認可アーキテクチャの構造化（2026-06）

> **これは一時的な移行ドキュメント**です。フォーク先が自プロジェクトを適応させるための手順書で、
> 対応完了後は削除して構いません。恒久的な使い方は
> [APIルート認可実装ガイド](../APIルート認可実装ガイド.md) を参照してください。

## 何が変わったか

API 認可を「規律（書き忘れ可能）」から「構造強制（書き忘れ＝コンパイルエラー）」に格上げした。

1. **serviceRegistry が `{ service, access }` に**（型必須）
   汎用ルートのアクセスポリシーを serviceRegistry の登録エントリに co-location。access を省略できない。
2. **`createApiRoute` の `access` が型必須に**
   手書きルートは access を宣言しないとコンパイルが通らない（fail-open の解消）。
3. **`createMeRoute` 新設**（`/api/me/**`）
   本人専用データのオーナーシップを強制するファクトリー。
4. **wallet 残高をオーナーシップ強制ルートへ移行**
   汎用 `/api/wallet/search`（admin 限定）から `/api/me/wallet`（本人スコープ）へ。

## フォーク先が必要な対応

upstream をマージすると、独自に追加したコードで**型エラーが出る**。以下を対応する。

### 1. serviceRegistry の独自ドメイン登録を `{ service, access }` 形式に

```ts
// Before
myDomain: myDomainService,

// After（access は型必須）
myDomain: { service: myDomainService, access: ADMIN_ONLY }, // または PUBLIC_READ / 個別指定
```

`ADMIN_ONLY` / `PUBLIC_READ` は `@/config/app/domain-api-access.config` からインポート。
自動生成ドメインは `dc:generate` を再実行すれば domain.json の apiAccess から自動展開される。

### 2. 独自カスタムルート（createApiRoute）に `access` を付与

`access` 未宣言の createApiRoute はすべて型エラーになる。各ルートに宣言する:

| ルートの性質 | 宣言 |
|--------------|------|
| 未認証で正当（ログイン前・署名付き webhook・公開マスタ） | `access: "public"` |
| ログインユーザーなら誰でも | `access: "authenticated"` |
| 管理者限定 | `access: { roleCategories: ["admin"] }` |
| 署名検証など独自ガードを自前で行う | `access: "custom"`（ハンドラ内で認可） |

> 既存ハンドラで `requireAdmin()` / `requireAuthenticated()` / `if (!session)` を使っているルートは、
> `access: "custom"` を付ければ挙動を変えずに移行できる（自前認可を維持）。宣言的 access（admin等）に
> 寄せるとハンドラのガードを削れる。

### 3. ユーザー所有データを createMeRoute へ

「自分のデータだけ」を返す独自ルートが汎用 `/api/[domain]` 経由なら、オーナーシップが
強制できていない（where の user_id がクライアント任せ）。`/api/me/**` に createMeRoute で移す:

```ts
export const GET = createMeRoute(
  { operation: "GET /api/me/xxx", operationType: "read" },
  async (_req, { user }) => xxxService.search({
    where: { field: "user_id", op: "eq", value: user.userId }, // サーバー側で固定
  }),
);
```

UI 側の取得フックも、本人用は新しい `/api/me/**` を叩くように差し替える。

## 棚卸し・検証手順

```bash
# 1. 型エラーで未対応箇所を洗い出す（access 未宣言 / registry 形式違い）
pnpm tsc --noEmit

# 2. access:"custom" なのに自前ガードが無いルートを検出
pnpm lint   # route-authz/require-authz の警告

# 3. 未認証アクセスで挙動確認（塞いだルートが 401/403、公開が 200）
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/<route>
```

## チェックリスト

- [ ] serviceRegistry の独自ドメインを `{ service, access }` に更新した
- [ ] `pnpm tsc --noEmit` が通る（access 未宣言の型エラーが無い）
- [ ] `access: "custom"` の独自ルートはハンドラ内で実際に認可している（lint 警告 0）
- [ ] ユーザー所有データの独自ルートを createMeRoute（/api/me）に移した
- [ ] 本人向け UI フックを `/api/me/**` に差し替えた
- [ ] 未認証 curl で塞いだルートが 401/403、公開が 200 を返す
