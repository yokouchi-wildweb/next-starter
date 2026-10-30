# src/app ルート構造

## 概要

Next.js App Router のルートディレクトリ。Route Group を活用して認証要否・用途別に整理。

## 主要ディレクトリ

| ディレクトリ | 説明 |
|-------------|------|
| `(user)/` | ユーザー向けフロントエンド |
| `(marketing)/` | ランディングページ等。`(user)/` の枠(ヘッダー・フッター)の外の兄弟の枝 |
| `admin/` | 管理者向け画面 |
| `debug/` | デバッグ用画面（管理者カテゴリ + デバッガーロール限定、layout が一括ガード） |
| `api/` | API ルート |

## (user)/ の構造

| グループ | 用途 | 例 |
|----------|------|-----|
| `(protected)/` | 認証必須ページ | mypage, profile, wallet |
| `(public)/` | 公開ページ | services |
| `(auth)/` | ログイン・登録の流れ | login, signup, logout, forgot-password |
| `(legal)/` | 法的ページ | terms, privacy-policy |
| `demo/` | 開発用デモ機能 | form-components, dummy-payment |
| `maintenance/` | メンテナンス画面 | - |

### 画面の構造（page.tsx スイッチ + `_screen/` + loader）

上流が出荷するページ（ユーザー向け・管理画面とも）は、次の構造で「下流が core を編集せずに画面を作り直せる」ようになっている（詳細と手順: `src/lib/screens/README.md`）。

```
src/app/(user)/(protected)/wallet/[slug]/
├── page.tsx          1 行スイッチ(下流所有)。export { WalletBalanceScreen as default } from "./_screen/WalletBalanceScreen";
├── _screen/          既定画面と loader.ts(上流所有。下流は編集・削除しない)
└── _components/      任意。下流の差し替え画面(<Name>Screen.tsx)、page 専用の部品
```

- 差し替え: `_screen/` の Screen を `_components/<Name>Screen.tsx` にコピーし、loader の import を `../_screen/loader` に直して page.tsx の 1 行を向ける。loader はそのまま呼ぶ
- `pnpm test:screens` が `src/app` 全体のページ（`_` で始まるディレクトリと `api/` を除く）を自動検出して検査する（登録不要。fork の独自エリアや debug / admin に足したページも対象）。検査から外すディレクトリだけ `src/registry/screenRoutesRegistry.ts` の `FORK_SCAN_EXCLUDES` に書く。スイッチ形でない page.tsx は失敗する（未移行の例外リストは無い）
- ルート地図 `route-map.jsonl`（このディレクトリ直下）は全ページの守りの鎖（page → Screen → loader の access → guard.ts の段）を 1 行 1 JSON にした生成物（機械が読む）。ページ・loader・guard.ts を変えたら `pnpm routes:map` で作り直してコミットする（ずれは `pnpm test:route-map` が失敗にする。merge で衝突したら作り直す。詳細は `pnpm routes:show`、仕様は src/lib/screens/README.md §13）
- 上流の core ルートは全て移行済み（wallet 9 / mypage 10 / legal 3 / services / maintenance / entry / トップ / auth 16 / 手書きの管理画面 33）。新しい core ルートはスイッチ形で作る
- `_screen/` には Screen と loader のほかに、既定 Screen 専用の部品を置いてよい（直下でもサブディレクトリでも。例: `(user)/_screen/StarterHome/`、`(marketing)/entry/_screen/CampaignSection.tsx`）。部品は契約外。`_components/` は下流の場所で、上流のルートでは上流が何も置かない

### トップページ（`(user)/page.tsx`）の差し替え

`(user)/page.tsx` は 1 行のスイッチで、既定画面は `(user)/_screen/StarterHomeScreen.tsx`（上流所有のデモ用トップ。部品は `_screen/StarterHome/`）。
下流は自前のトップページを `(user)/_components/<Name>Screen.tsx` に作り、page.tsx の import 先だけを差し替える。
上流は page.tsx を今後編集しないため merge が衝突しない。`_screen/` は削除・編集しない（詳細: `(user)/_screen/README.md`）。

## admin/ の構造

| グループ | 用途 | 例 |
|----------|------|-----|
| `(protected)/` | 認証必須ページ | users, samples, settings |
| `insane/` | 特殊権限ページ | insane |
| `login/` | ログインページ | - |
| `setup/` | 初期設定 | - |
| `_template/` | コード生成テンプレート | - |
| `(protected)/tabs-demo/` | タブのデモ（他のページと同じ 1 行スイッチ + `_screen/` + loader） | - |

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

### 配置の規則(形は自由、守りは検査)

ルートの形(どの group・フォルダの下に置くか)は決め打ちにしない。守るべきことは検査が落とし、それ以外は推奨と自由に分ける。

必須(検査で落ちる):

- ページは `src/app` 全体から自動で見つかる(`_` で始まるディレクトリと `api/` を除く)。登録は要らない。ページを足す・消す、loader・guard.ts を変えたら `pnpm routes:map` でルート地図 `route-map.jsonl` を作り直してコミットする(ずれは `pnpm test:route-map` が失敗にする)
- layout のガードとセッション・ガード API を呼べる場所、layout がサーバー側でデータを取らないこと(services/server・DB・loader を import しない)は lint `page-authz` が全 Tier で error にする(下の「レイアウト継承」)
- 画面の構造(page.tsx スイッチ + `_screen/` + loader)は `pnpm test:screens` が検査する(上の「画面の構造」)
- (後で入る)すべての Screen の loader がアクセス方針を宣言し、公開ページも public と書く

推奨(守らなくても動く):

- layout を置く範囲が URL フォルダの配下と一致するなら URL フォルダの layout、ずれるときだけ group にする(例: `(user)` は共通の URL の先頭が無いので group、`admin` は全ページが `/admin` なので URL フォルダ)
- 方針(ログイン要否など)の違うページで枠を共有するなら、枠をガードの外に置く。その方針専用の枠ならガードと同居してよい
- 枠を出したくないページは、枠の外の兄弟の枝に置く(例: `(marketing)/` は `(user)/` の枠の外)。元の group の `loading` / `error` / `not-found` も外れるので、要るなら兄弟側に置く。枠の一部を隠すだけなら印(Hide*、`src/app/(user)/_layout/README.md`「枠の部位を隠す」)
- group の名前は今の語彙を使う: `(protected)` ログインが要る / `(public)` 公開 / `(auth)` ログイン・登録の流れ / `(legal)` 法的ページ / `(marketing)` 枠の外のランディング
- root layout は 1 つ(`src/app/layout.tsx`)。複数にすると root layout をまたぐ遷移が full reload になる

自由: 段の数、名前、group か URL フォルダか、入れ子の順序、枠と認証の混在、ラベルだけの group(どれも禁止しない)。

フォルダ名(`(protected)` 等)は検査にも認可にも意味を持たない。認可は範囲の `guard.ts`(layout の隣、親子 AND)と loader の `access` で決まり、ルート地図(`route-map.jsonl`)が鎖を確かめる(src/lib/screens/README.md §4・§13)。

決まった置き場:

- 開発・デモ用ページ → `(user)/demo/`
- デバッグ用(管理者カテゴリ + デバッガーロールだけに見せる)→ `debug/`(layout が一括でガード)

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
src/app/
├── layout.tsx              ← root layout(1 つだけ。Provider の入れ子は @/wiring/AppProviders)
├── guard.ts                ← root の範囲(public。全ページを覆う)
├── (user)/
│   ├── layout.tsx          ← ユーザー側の枠(1 行スイッチ → _layout/)
│   ├── (protected)/
│   │   ├── guard.ts        ← 範囲の方針(ログイン必須・status 別の行き先)。root の src/app/guard.ts を extend
│   │   └── layout.tsx      ← await guard() の 1 行。枠はガードの外 = (user)/layout.tsx
│   ├── (public)/ (auth)/ (legal)/   ← layout なし。(user) の枠をそのまま継ぐ
│   └── demo/ maintenance/
├── (marketing)/
│   └── layout.tsx          ← (user) の枠の外の兄弟の枝
├── admin/                  ← URL フォルダの layout(枠 = 1 行スイッチ → _layout/。ガードは (protected)/・insane/ の layout)
└── debug/
    └── layout.tsx          ← 管理者カテゴリ + デバッガーのガード
```

- layout はサーバー側でデータを取らない（services/server・DB・loader を import しない。認可は authorization の関数だけ）。取得は loader で行う。lint `page-authz`、詳細: [auth README「置き場所の検査」](../features/core/auth/README.md)

### API ルート追加

- 汎用CRUD: `api/[domain]/` で自動対応（routeFactory使用）
- 個別API: 用途別ディレクトリに配置
- routeFactory必須: `createApiRoute` / `createDomainRoute` を使用
