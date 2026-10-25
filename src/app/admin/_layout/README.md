# admin/_layout — 管理画面の枠の部品

`src/app/admin/layout.tsx`・`admin/(protected)/layout.tsx`・`admin/insane/layout.tsx` が描く管理画面の枠(ヘッダー・サイドバー・フッター)と、Screen が使うページ枠部品(AdminPage・PageTitle)を置く場所。import は別名なしの `@/app/admin/_layout/<X>`・`@/app/admin/(protected)/_layout/<X>`・`@/app/admin/insane/_layout`。

## ディレクトリ構成

部品は、それを描く layout のそばの `_layout/` に置く。(protected) と insane の両方が使う物は共通の祖先 `admin/_layout/` に置く。

```
src/app/admin/_layout/                  # admin/layout.tsx の枠 + admin 全体で共有する物
├── AdminLayout.tsx         # 外枠の既定の組み立て(固定ヘッダー + 子領域、header slot)。admin/layout.tsx が 1 行スイッチで描く
├── AdminOuterLayout.tsx    # 旧 export 名の互換(@deprecated、AdminLayout へ委譲。旧入口撤去の区切りで削除)
├── Header.tsx              # 管理画面ヘッダー(ロゴ + AdminHeaderSlots + ダークモード切替)
├── HeaderSlots.tsx         # AdminHeaderSlots: ヘッダーの受け口 3 つ(タイトル / 中央 / 右)をまとめて描く
├── AdminPage.tsx           # ページコンテナ(default export。fill モード・tabs)。Screen が使う
├── PageTitle.tsx           # ページの h1(default export。placement = "header"(既定)| "page")。Screen が使う
├── Sidebar/MenuButton.tsx  # サイドバーのボタン(通常 / insane の両サイドバーが使う)
├── Sidebar/AdminSidebarFrame.tsx  # サイドバーの殻が中身に渡す状態(useAdminSidebarFrame)
├── AdminLayout.test.tsx    # pnpm test:admin-layout(slot と既定の DOM)
└── stores/adminLayout/     # 枠固有の store(下の「store」)

src/app/admin/(protected)/_layout/      # admin/(protected)/layout.tsx の枠
├── AdminProtectedLayout.tsx  # サイドバー開閉ボタン + ResizableArea(sidebar / footer の props)
├── ResizableArea.tsx         # サイドバー幅の調整 + 本文 + Footer
├── Footer.tsx
└── Sidebar/                  # BaseSidebar(メニュー本体)・PcSidebar・SpSidebar(PC の列 / SP のドロワーの殻)

src/app/admin/insane/_layout/           # admin/insane/layout.tsx の枠(index.ts で一括 export)
└── InsaneProtectedLayout・InsaneResizableArea・InsaneSidebar・InsanePcSidebar・InsaneSpSidebar
```

ガード(hasAdminUser + authGuard)は `admin/(protected)/layout.tsx`・`admin/insane/layout.tsx` 本体に残っている。両 layout はガードの後に `./_layout` の枠を素の import で描く(1 行スイッチではない)。`_layout/` の部品は枠を描くだけ。

まだ `src/components/AppFrames/` に残っている物(後の区切りで扱う):

- `Admin/Elements/` の PageTitle 以外(AdminHeaderPortal・ListTop・SearchBox・SortSelect・SecTitle・SelectFilter・ItemNavigator・DeveloperMotivationChart): features の画面部品から使われるので、共有部品の棚を決める区切りで一緒に動かす。PageTitle.tsx は AdminHeaderPortal を絶対パス `@/components/AppFrames/Admin/Elements/AdminHeaderPortal` で参照している
- `AppFrames/constants.ts`(ヘッダー・フッターの要素 ID と受け口の ID): useHeaderHeight の汎用化と一緒に後で動かす

## 所有

- このフォルダ(と `(protected)/_layout/`・`insane/_layout/`)の既定の部品 = 提供者(upstream)の所有。fork は直接編集しない(core と同じ扱い。CLAUDE.md CORE_FILES)
- fork のカスタムはベースの隣にドット区切り名で置く(例 `Header.<project>.tsx`)。ドット区切り名のファイル = 採用者(fork)の所有。upstream はここにドット区切り名のファイルを作らない(`pnpm test:screens` が Tier1 でだけ検査)
- lint: 既定の部品は `src/components/**` と同じ upstream 所有 UI の強さ(style-tokens・client-service-boundary が error)。ドット区切り名は app/ の画面と同じ warn。page-authz は両方に error
- `admin/layout.tsx` は採用者所有の 1 行スイッチ(`export { AdminLayout as default } from "./_layout/AdminLayout";`、write-once。`pnpm test:screens` が全 Tier で検査)
- `admin/(protected)/layout.tsx`・`admin/insane/layout.tsx` はガードと同居するので提供者所有。枠の部品は sidebar / footer の props を持つが、fork から渡す口は proxy の /admin 関所の区切り(F2)まで無い(渡すには提供者所有の layout.tsx を編集することになるため)
- 差し替え部品の置き場: `useAdminSidebarFrame` / `AdminHeaderSlots` を使う差し替え部品(ヘッダー・サイドバーの中身)は `src/app/admin/**` の中(この `_layout/` の隣のドット区切り名)に置く。`src/app/<X>/_layout/**` を import してよいのは `src/app/<X>/**` だけ、という規則を後の区切りで検査にするため(features/** に置くとそこで落ちる)

## AdminLayout と slot

- slot の約束(User の UserLayout と同じ): 省略(undefined) = 既定の部品 / null = 描かない / 要素 = それを描く
- `header`: 既定 = `./Header`。`className`: 外枠に足すクラス名(旧 AdminOuterLayout と同じ)
- fork のカスタム: `admin/layout.tsx` を `_layout/AdminLayout.<project>.tsx` へ向け、そこで既定の AdminLayout に slot を渡す

```tsx
// src/app/admin/_layout/AdminLayout.<project>.tsx
import type { ReactNode } from "react";

import { AdminLayout } from "./AdminLayout";
import { ProjectAdminHeader } from "./Header.<project>";

export function ProjectAdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayout header={<ProjectAdminHeader />}>{children}</AdminLayout>;
}
// admin/layout.tsx: export { ProjectAdminLayout as default } from "./_layout/AdminLayout.<project>";
```

- ヘッダーを差し替えるときは `<header id={APP_HEADER_ELEMENT_ID}>`(`@/components/AppFrames/constants`)の中で、ロゴ等の後に `<AdminHeaderSlots trailing={…} />` を描く。受け口が無いと PageTitle placement="header" の見出し(sm 以上)と AdminHeaderPortal の中身が出ない。受け口の id は test:admin-layout が固定している

- 寸法の CSS 変数: AdminLayout が外枠の inline に書くのは `--app-header-height`(ヘッダーの実測の高さ)だけ。`--app-banner-height` / `--app-bottom-nav-height` は Admin に banner も bottomNav も無いので書かず、`src/styles/config.css` の `:root` の 0px を継ぐ。`--app-safe-area-*` も :root。一覧と経緯は User 側の README(`src/app/(user)/_layout/README.md` の「寸法の CSS 変数」)。Admin の banner slot は作っていない(要る例が無い)

## サイドバー・フッター((protected)・insane)

- `sidebar`: 既定 = BaseSidebar(insane は InsaneSidebar)。要素は PC の列と SP のドロワーの殻の中に描く。幅・開閉・リサイズは枠が持ち、中身は `useAdminSidebarFrame()` で `placement`("pc" | "sp")・`width`・`close`(SP のドロワーを閉じる。遷移の後に呼ぶ。PC では何もしない)を読む。null = サイドバー・リサイズのつまみ・SP の開閉ボタンを描かない
- `footer`: (protected) の既定 = `./Footer`、null = 描かない。insane の既定 = 無し(今の insane はフッターを持たない)、要素のときだけ本文の後に描く

## AdminPage と PageTitle

- AdminPage: `fill` で固定ヘッダー直下の残り高さにスナップする土台(非スクロールのページ。説明は AdminPage.tsx の `fill` の JSDoc)。既定は padding lg / paddingBlock xl の通常ページ。`tabs` は本文の前に下余白 mb-6 で描く(fill でも同じ)
- PageTitle: 既定 `placement="header"` で sm 以上はヘッダーのタイトル受け口に描き込み(AdminHeaderPortal 経由)、sm 未満は本文に出す。`placement="page"` で本文上部に h1(ヘッダーの無い login・setup の画面はこれを明示)
- ヘッダーが無い・受け口を持たないヘッダーのときの PageTitle の挙動(と pageTitle slot)は、共有層の議題の後に決める

## store

- `stores/adminLayout/`(useAdminLayoutStore): 外枠に足すクラス名(extraClassName)を持つ。InsaneProtectedLayout が書き、AdminOuterLayout が読む。使うのは管理画面の枠だけなので、app 全体の `src/stores/` でなく枠のそばに置く(CLAUDE.md STORES: one-frame-only → `_layout/stores/`)
- 構成は src/stores と同じ(index.ts・internalStore.ts・useStore.ts、internalStore は useStore からだけ使う)

---

## 移動の経緯

- 以前は `src/components/AppFrames/Admin/`(Layout・Sections・Insane・Elements/PageTitle)と `src/stores/adminLayout/` にあった。共有フォルダの置き場と所有を決めた評議会の報告書(20261019-213253-shared-folders-placement-ownership §2)で AppFrames の解体が決まり、ユーザー側(notice frame-move-user、[src/app/(user)/_layout/README.md](<../../(user)/_layout/README.md>))に続いて管理画面の枠も「使う layout のそばの `_layout/`」へ移した(notice frame-move-admin)
- 綴り: 旧 `Sections/SIdebar/` は移動先で `Sidebar/` に直した
- 移し方: 移動だけの区切り。中身は移動で壊れる相対 import の行だけを書き換え、旧パス 18 か所に `@deprecated 旧パス互換` の re-export shim を残した(default export の AdminPage・PageTitle は `export { default }` も)。`src/stores/adminLayout` は index.ts だけ shim。fork の差分は /flux が notice の `moved:` で新パスへ当て直す
- 移動の区切りで旧パスのまま残した物(3 つの admin の layout.tsx の import、AdminOuterLayout.tsx・InsaneProtectedLayout.tsx の `@/stores/adminLayout` import、各ファイル先頭の旧パスのコメント)は、slot 化の区切り(notice frame-slots-admin)で新パスに直した
- slot 化: User の枠(notice frame-slots-user・frame-parts-user)と同じ形に揃えた。admin/layout.tsx を 1 行スイッチにし、外枠を AdminLayout(header slot)に、(protected)・insane の枠に sidebar / footer、AdminPage に tabs、PageTitle の既定を header に(報告書 D1: header 指定が upstream で 45 か所、指定なしは repo あたり 1〜2 件)。props なしの DOM は前と同じ(test:admin-layout が slot 化の前の HTML で固定)
- shim と eslint `deprecated-imports/no-deprecated-path` の旧パス一覧は、区切り 2 を全 fork が取り込んだことを確かめた後の「旧入口撤去」の区切りで削除する

## 採らなかった案

- MenuButton を `(protected)/_layout/` に置く: insane のサイドバーも使うので、insane → (protected) の横向きの参照になる。両方の祖先 `admin/_layout/` に置いた
- store を `src/stores/` に残す: src/stores は app 全体の store の棚で、この store を使うのは管理画面の枠の 2 部品だけ。枠と一緒に置けば持ち主がパスで分かる
- サイドバーの slot を Pc / Sp の殻ごと差し替える: 幅・開閉・SP の開閉ボタンとの連動を差し替え側が作り直すことになる。殻は枠が持ち、中身だけを受けて状態は useAdminSidebarFrame で渡す
- サイドバーを描画関数(render prop)で受ける: slot はすべて ReactNode という User 側の約束から外れる(User の「slot をコンポーネント型で受ける」不採用と同じ)
- 受け口を 3 つの別部品にする: 並びと右側のまとまりを差し替え側が組み直すことになる。1 つの AdminHeaderSlots で今の DOM を保つ
- PageTitle の既定を page のままにする: upstream の利用は header 指定が大多数で、指定なしは login・setup の 2 画面だけ
- ガード付きの layout.tsx をスイッチにしてガードを `_layout/` へ移す: ガードは提供者所有の layout.tsx に残す(報告書 §7。形は F2 で guard.ts と一緒に決める)
- ガード付きの layout.tsx が枠を絶対パスで import する(スイッチの検出を変えない): fork が相対で書くと 1 行スイッチの検査で落ちる罠が残る。検出を `./_layout/` への re-export だけに絞った
- 47 画面の見出し位置を固定の一覧で test する: fork ごとに画面が違う。変更の前後で同じ走査の結果が一致することだけを確かめ、描画の違いは PageTitle の test で固定した
- AdminHeaderPortal を同時に動かす: features の画面部品(ItemNavigator など)が使う送り側で、今 `_layout/` へ移すと components・features → app の参照ができる。受け口を持つ Header だけを移し、送り側は共有部品の棚と一緒に決める
