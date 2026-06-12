# API ルート認可実装ガイド

API ルートを **作る / 守る** ときの実装手順・パターン・チェックリスト。
設計思想と仕組みの詳細は [汎用APIアクセス制御ガイド](./汎用APIアクセス制御ガイド.md) を参照。

> 対象読者: 本テンプレート（および各フォーク）で API ルートを実装する開発者。
> このリポジトリで新規ルートを書く前と、既存ルートの認可を棚卸しするときに読む。

---

## 大前提: 2 種類のルートでガードの効き方が違う

| 種別 | 実装 | デフォルトの安全性 |
|------|------|--------------------|
| 汎用ルート | `createDomainRoute`（`/api/[domain]/**`、自動生成） | **fail-closed**（domain.json の apiAccess で守られる。未宣言は admin 限定） |
| カスタムルート | `createApiRoute`（手書き `route.ts`） | **fail-open**（認可を書かないと誰でも通る） |

**最重要**: カスタムルートは認可を書き忘れると素通しになる。本ガイドの主目的は、この
カスタムルートを正しく・統一的に守ることにある。

---

## 決定木: 新しい API をどう守るか

```
新しいデータ操作を API で公開したい
│
├─ ドメインの標準 CRUD で足りる？
│   └─ YES → 汎用ルートを使う（手書きルート不要）
│            domain.json に apiAccess を宣言する → 「① 汎用ルート」へ
│
└─ NO（独自ロジック・特殊な入出力）→ カスタムルートを書く → 「② カスタムルート」へ
        │
        └─ 公開範囲は？
            ├─ 未認証で正当（ログイン前・webhook・公開マスタ）→ 「②-a public」
            ├─ ログインユーザーなら誰でも　　　　　　　　　　 → 「②-b authenticated」
            ├─ 管理者のみ　　　　　　　　　　　　　　　　　　 → 「②-c admin」
            └─ 自分のレコードのみ（オーナーシップ）　　　　　 → 「②-d owner」
```

---

## ① 汎用ルート: domain.json で宣言

手書きルートは不要。domain.json に `apiAccess` を書くだけで `createDomainRoute` が強制する。

```json
"apiAccess": {
  "read":  "public",
  "write": { "roleCategories": ["admin"] },
  "operations": { "hardDelete": "none" }
}
```

- ルール: `"public"` | `"authenticated"` | `"none"` | `{ "roles": [...], "roleCategories": [...] }`
- 未宣言は **admin 限定にフォールバック**（fail-closed）
- スキーマ詳細: `src/features/README.md`「ApiAccess」

---

## ② カスタムルート: ハンドラ先頭で認可する

認可ヘルパー `@/features/core/auth/services/server/requireRole` を **ハンドラの先頭で呼ぶ**。
失敗時は `DomainError` を throw し、`createApiRoute` が 401 / 403 に変換する。
ロール判定は DB 同期される `getSessionUser` を使う（`ctx.session` は token-only のため認可に使わない）。

### ②-a public（未認証で正当）

ログイン前処理・署名検証付き webhook・公開マスタ等。**理由付きで lint を抑止**して明示する。

```ts
// eslint-disable-next-line route-authz/require-authz -- public: <理由>
export const POST = createApiRoute({ operation: "...", operationType: "write" }, async (req) => {
  // webhook なら署名検証をここで必ず行う
  ...
});
```

### ②-b authenticated（ログイン必須）

```ts
import { requireAuthenticated } from "@/features/core/auth/services/server/requireRole";

export const POST = createApiRoute({ operation: "...", operationType: "write" }, async (req) => {
  await requireAuthenticated();   // 未認証→401 / 利用停止→403
  ...
});
```

### ②-c admin（管理者限定）

```ts
import { requireAdmin } from "@/features/core/auth/services/server/requireRole";

export const POST = createApiRoute({ operation: "...", operationType: "write" }, async (req) => {
  await requireAdmin();           // 未認証→401 / 非admin・利用停止→403
  ...
});
```

### ②-d owner（自分のレコードのみ）

ヘルパーは「ログイン済みか」「管理者か」までしか見ない。**オーナーシップは自前で**。
`requireAuthenticated()` が返す `SessionUser` の `userId` を where 条件に必ず混ぜる。

```ts
export const GET = createApiRoute({ operation: "...", operationType: "read" }, async (req) => {
  const user = await requireAuthenticated();
  // userId で必ず絞る（他人のレコードを返さない）
  return someService.search({ where: { user_id: user.userId } });
});
```

ユーザー向けの定型操作は、所有者スコープを内包した `/api/me/` 系の専用ルートにまとめると安全。

---

## lint による検出（route-authz/require-authz）

`eslint-rules/route-authz.mjs` が、`createApiRoute` を使うのに認可ヘルパーも `session` 参照も
無いルートを **warn** で検出する。

- 警告が出たら → 認可ヘルパーを足す、または ②-a の理由付き抑止で公開を明示する
- フォーク先で独自の認可ヘルパーを追加した場合は、`route-authz.mjs` の `AUTH_SIGNALS` に
  その関数名を追加すると誤検知を防げる

---

## PR 前チェックリスト

- [ ] 汎用ルートで足りるなら手書きせず domain.json の apiAccess で宣言したか
- [ ] カスタムルートのハンドラ先頭で `requireAdmin()` / `requireAuthenticated()` を呼んだか
- [ ] 公開ルートは理由付き `eslint-disable` で意図を明示したか
- [ ] オーナーシップが必要なら `user.userId` で where を絞ったか（他人のデータが返らないか）
- [ ] webhook はハンドラ内で署名/トークン検証しているか
- [ ] `pnpm lint` で `route-authz/require-authz` の警告が 0 か

---

## 既存ルートの棚卸し（フォーク先で実施推奨）

各フォークには、本テンプレートに無い独自のカスタムルートがある。認可漏れが残っている
可能性が高いので、以下の手順で一括棚卸しする。

### 1. lint で警告を一覧化

```bash
pnpm lint
# route-authz/require-authz の警告が出るルート = 認可も session 参照も無いルート
```

### 2. 認可シグナルの無いルートを抽出（lint の補助・素朴な確認）

```bash
# createApiRoute を直接使う route.ts で、認可関数も session も触らないものを洗う
grep -rL 'getSessionUser\|requireAdmin\|requireAuthenticated\|authGuard\|session' \
  $(grep -rl 'createApiRoute' src/app/api --include=route.ts | grep -v '/\[domain\]/')
```

> この grep は `eslint-disable` を見ないため、**public 明示済みのルートもヒットする**。
> 正確な「未対応」一覧は手順 1 の lint（`route-authz/require-authz` 警告）が示す。
> grep はあくまで候補の洗い出しで、結果は手順 3 で仕分ける。

### 3. 各ルートを仕分けて対応

| 分類 | 対応 |
|------|------|
| 管理機能（データ移行・全件検索・PII 操作等） | `requireAdmin()` を追加 |
| ログインユーザー向け | `requireAuthenticated()` を追加 |
| 自分のデータのみ | `requireAuthenticated()` + `userId` で where 絞り、または `/api/me/` 化 |
| 未認証で正当（ログイン前・署名付き webhook・公開マスタ） | 理由付き `eslint-disable` で明示 |

### 4. 動作確認

未認証でアクセスして、塞いだルートが 401/403、公開ルートが 200 を返すことを確認する。

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/<塞いだルート>
# → 401 が返れば OK
```

---

## アンチパターン

- **`ctx.session` でロール判定する**: token-only のためロール剥奪・利用停止が即時反映されない。
  認可判定は必ず `requireAdmin()` / `requireAuthenticated()`（= DB 同期の `getSessionUser`）を使う。
- **`operationType: "write"` を認可と勘違いする**: これはデモスキップと監査ログ用で、認可とは無関係。
- **認可ヘルパーをハンドラの途中・末尾で呼ぶ**: 必ず先頭で。途中だと処理が一部実行されうる。
- **オーナーシップをロールだけで代替する**: `authenticated` でも他人のレコードは見える。`userId` 絞り必須。
- **認可漏れを `eslint-disable` で理由なく黙らせる**: 抑止には必ず `-- public: <理由>` を書く。

---

## 関連

- [汎用APIアクセス制御ガイド](./汎用APIアクセス制御ガイド.md) — 設計思想・fail-closed の仕組み・apiAccess スキーマ
- `src/features/core/auth/services/server/requireRole.ts` — 認可ヘルパー実体
- `eslint-rules/route-authz.mjs` — 認可漏れ検出ルール
- `src/features/README.md`「ApiAccess」 — domain.json スキーマ
