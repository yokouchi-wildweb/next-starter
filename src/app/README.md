# src/app ルート構造

## 概要

Next.js App Router のルートディレクトリ。Route Group を活用して認証要否・用途別に整理。

## 主要ディレクトリ

| ディレクトリ | 説明 |
|-------------|------|
| `(user)/` | ユーザー向けフロントエンド |
| `admin/` | 管理者向け画面 |
| `debug/` | デバッグ用画面（管理者カテゴリ + デバッガーロール限定、layout が一括ガード） |
| `api/` | API ルート |

## (user)/ の構造

| グループ | 用途 | 例 |
|----------|------|-----|
| `(protected)/` | 認証必須ページ | mypage, profile, wallet |
| `(public)/` | 公開ページ | login, signup, services |
| `(legal)/` | 法的ページ | terms, privacy-policy |
| `demo/` | 開発用デモ機能 | form-components, dummy-payment |
| `maintenance/` | メンテナンス画面 | - |

### 画面の構造（page.tsx スイッチ + `_screen/` + loader）

上流が出荷するユーザー向けページは、次の構造で「下流が core を編集せずに画面を作り直せる」ようになっている（詳細と手順: `src/lib/screens/README.md`）。

```
src/app/(user)/(protected)/wallet/[slug]/
├── page.tsx          1 行スイッチ(下流所有)。export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
├── _screen/          既定画面と loader.ts(上流所有。下流は編集・削除しない)
└── _components/      任意。下流の差し替え画面(<Name>Screen.tsx)、page 専用の部品
```

- 差し替え: `_screen/` の Screen を `_components/<Name>Screen.tsx` にコピーし、loader の import を `../_screen/loader` に直して page.tsx の 1 行を向ける。loader はそのまま呼ぶ
- `pnpm test:screens` が `(user)/**` と `(marketing)/**` の page.tsx を自動検出して検査する（登録不要）。fork が `src/app` 直下に作った独自エリア（`store/` 等）はエリア単位で `src/registry/screenRoutesRegistry.ts` の `FORK_SCAN_ROOTS` に 1 行書く（未登録のまま置くとテストが指摘する）。スイッチ形でない page.tsx は、理由付きの例外リスト（上流: `UPSTREAM_LEGACY_ROUTES`、fork: 同 registry の `FORK_LEGACY_ROUTES`）に無ければ失敗する
- 上流がまだ移行していないルート（現在 38。wallet 3 ルートは移行済み）は `UPSTREAM_LEGACY_ROUTES` に載っており、段階的に移行して `.notices` で通知する

### トップページ（`(user)/page.tsx`）の差し替え

`(user)/page.tsx` は 1 行のスイッチで、中身は `(user)/_components/StarterHome/`（上流所有のデモ用トップ。`_screen/` 方式への移行は後続ステップで `.notices` 付きで行う）。
下流は自前のトップページを `(user)/_components/<Name>/` に作り、page.tsx の import 先だけを差し替える。
上流は page.tsx を今後編集しないため merge が衝突しない。`StarterHome/` は削除・編集しない（詳細: `(user)/_components/StarterHome/README.md`）。

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
| `debug/` | デバッグ用API（`ADMIN_OR_DEBUGGER_RULE` で認可、`ping/` が雛形） |
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

4. デバッグ用（管理者 + デバッガーのみに見せたい）?
   - はい → debug/（layout が admin カテゴリ + debugger ロールで一括ガード）
```

### 推奨する構造（ユーザー向けページ）

```
src/app/(user)/.../<route>/
├── page.tsx                     export { XScreen as default } from "./_screen/XScreen";(metadata / dynamic もここ)
└── _screen/
    ├── XScreen.tsx              Server Component。load<X>Screen(props) を await してセクションコンテナを描く
    └── loader.ts                import "server-only" + cache()。redirect / notFound / 認可 / 取得(サーバー側ロジックがあるときだけ)
```

上流の core ページも下流の独自ページも原則この構造（`pnpm test:screens` が自動検出して検査。未移行は理由付きで例外リストへ）。
loader はドメインの features ではなくルートの中に置く（複数ドメインを組み合わせるページでも同じ）。
`_components/` は page 専用の部品や、下流が上流の画面を差し替えるときの置き場。

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
