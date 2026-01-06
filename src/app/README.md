# src/app ルート構造

## 概要

Next.js App Router のルートディレクトリ。Route Group を活用して認証要否・用途別に整理。

## 主要ディレクトリ

| ディレクトリ | 説明 |
|-------------|------|
| `(user)/` | ユーザー向けフロントエンド |
| `admin/` | 管理者向け画面 |
| `api/` | API ルート |

## (user)/ の構造

| グループ | 用途 | 例 |
|----------|------|-----|
| `(protected)/` | 認証必須ページ | mypage, profile, wallet |
| `(public)/` | 公開ページ | login, signup, services |
| `(legal)/` | 法的ページ | terms, privacy-policy |
| `demo/` | 開発用デモ機能 | form-components, dummy-payment |
| `maintenance/` | メンテナンス画面 | - |

## admin/ の構造

| グループ | 用途 | 例 |
|----------|------|-----|
| `(protected)/` | 認証必須ページ | users, samples, settings |
| `(insane)/` | 特殊権限ページ | insane |
| `login/` | ログインページ | - |
| `setup/` | 初期設定 | - |
| `_template/` | コード生成テンプレート | - |

## api/ の構造

| パス | 説明 |
|------|------|
| `[domain]/` | 汎用CRUDエンドポイント（動的ルート） |
| `auth/` | 認証関連 |
| `admin/` | 管理者専用API |
| `storage/` | ファイル操作 |
| `wallet/` | ウォレット操作 |
| `webhook/` | 外部サービス連携 |

---

## ルート追加ガイドライン

### 配置ルール

```
新規ページを追加する際の判断フロー：

1. ユーザー向け or 管理者向け?
   - ユーザー向け → (user)/
   - 管理者向け → admin/

2. 認証が必要?
   - 必要 → (protected)/
   - 不要 → (public)/
   - 法的ページ → (legal)/

3. 開発/デモ用?
   - はい → (user)/demo/
```

### Route Group の使い分け

- `(xxx)`: URLに影響せず、レイアウト・ミドルウェアを共有
- `xxx`: 通常のルートセグメント（URLに反映）
- `_xxx`: Next.js に無視される（テンプレート等）

### 命名規則

- ルートセグメント: `kebab-case`
- Route Group: `(lowercase)`
- ファイル: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`

### レイアウト継承

```
(user)/
├── layout.tsx          ← 全ユーザーページ共通
├── (protected)/
│   └── layout.tsx      ← 認証チェック付きレイアウト
└── (public)/
    └── layout.tsx      ← 公開ページ用レイアウト
```

### API ルート追加

- 汎用CRUD: `api/[domain]/` で自動対応（routeFactory使用）
- 個別API: 用途別ディレクトリに配置
- routeFactory必須: `createApiRoute` / `createDomainRoute` を使用
