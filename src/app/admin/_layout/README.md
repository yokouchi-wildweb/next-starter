# admin/_layout — 管理画面の枠の部品

`src/app/admin/layout.tsx`・`admin/(protected)/layout.tsx`・`admin/insane/layout.tsx` が描く管理画面の枠(ヘッダー・サイドバー・フッター)と、Screen が使うページ枠部品(AdminPage・PageTitle)を置く場所。import は別名なしの `@/app/admin/_layout/<X>`・`@/app/admin/(protected)/_layout/<X>`・`@/app/admin/insane/_layout`。

## ディレクトリ構成

部品は、それを描く layout のそばの `_layout/` に置く。(protected) と insane の両方が使う物は共通の祖先 `admin/_layout/` に置く。

```
src/app/admin/_layout/                  # admin/layout.tsx の枠 + admin 全体で共有する物
├── AdminOuterLayout.tsx    # 外枠(固定ヘッダー + 子領域)。admin/layout.tsx が描く
├── Header.tsx              # 管理画面ヘッダー(ロゴ・タイトル / 中央 / 右の受け口・ダークモード切替)
├── AdminPage.tsx           # ページコンテナ(default export。fill モード)。Screen が使う
├── PageTitle.tsx           # ページの h1(default export。placement = "page" | "header")。Screen が使う
├── Sidebar/MenuButton.tsx  # サイドバーのボタン(通常 / insane の両サイドバーが使う)
└── stores/adminLayout/     # 枠固有の store(下の「store」)

src/app/admin/(protected)/_layout/      # admin/(protected)/layout.tsx の枠
├── AdminProtectedLayout.tsx  # サイドバー開閉ボタン + ResizableArea
├── ResizableArea.tsx         # サイドバー幅の調整 + 本文 + Footer
├── Footer.tsx
└── Sidebar/                  # BaseSidebar(メニュー本体)・PcSidebar・SpSidebar

src/app/admin/insane/_layout/           # admin/insane/layout.tsx の枠(index.ts で一括 export)
└── InsaneProtectedLayout・InsaneResizableArea・InsaneSidebar・InsanePcSidebar・InsaneSpSidebar
```

ガード(hasAdminUser + authGuard)は `admin/(protected)/layout.tsx`・`admin/insane/layout.tsx` 本体に残っている。`_layout/` の部品は枠を描くだけ。

まだ `src/components/AppFrames/` に残っている物(後の区切りで扱う):

- `Admin/Elements/` の PageTitle 以外(AdminHeaderPortal・ListTop・SearchBox・SortSelect・SecTitle・SelectFilter・ItemNavigator・DeveloperMotivationChart): features の画面部品から使われるので、共有部品の棚を決める区切りで一緒に動かす。PageTitle.tsx は AdminHeaderPortal を絶対パス `@/components/AppFrames/Admin/Elements/AdminHeaderPortal` で参照している
- `AppFrames/constants.ts`(ヘッダー・フッターの要素 ID と受け口の ID): useHeaderHeight の汎用化と一緒に後で動かす

## 所有

- このフォルダ(と `(protected)/_layout/`・`insane/_layout/`)の既定の部品 = 提供者(upstream)の所有。fork は直接編集しない(core と同じ扱い。CLAUDE.md CORE_FILES)
- fork のカスタムはベースの隣にドット区切り名で置く(例 `Header.<project>.tsx`)。ドット区切り名のファイル = 採用者(fork)の所有。upstream はここにドット区切り名のファイルを作らない(`pnpm test:screens` が Tier1 でだけ検査)
- lint: 既定の部品は `src/components/**` と同じ upstream 所有 UI の強さ(style-tokens・client-service-boundary が error)。ドット区切り名は app/ の画面と同じ warn。page-authz は両方に error
- `admin/layout.tsx` は採用者所有、`admin/(protected)/layout.tsx`・`admin/insane/layout.tsx` はガードと同居するので提供者所有。fork がサイドバー・フッターを差し替える口は後の区切りで用意する

## AdminPage と PageTitle

- AdminPage: `fill` で固定ヘッダー直下の残り高さにスナップする土台(非スクロールのページ。説明は AdminPage.tsx の `fill` の JSDoc)。既定は padding lg / paddingBlock xl の通常ページ
- PageTitle: 既定 `placement="page"` で本文上部に h1。`placement="header"` で sm 以上はヘッダーのタイトル受け口に描き込み(AdminHeaderPortal 経由)、sm 未満は本文に出す

## store

- `stores/adminLayout/`(useAdminLayoutStore): 外枠に足すクラス名(extraClassName)を持つ。InsaneProtectedLayout が書き、AdminOuterLayout が読む。使うのは管理画面の枠だけなので、app 全体の `src/stores/` でなく枠のそばに置く(CLAUDE.md STORES: one-frame-only → `_layout/stores/`)
- 構成は src/stores と同じ(index.ts・internalStore.ts・useStore.ts、internalStore は useStore からだけ使う)

---

## 移動の経緯

- 以前は `src/components/AppFrames/Admin/`(Layout・Sections・Insane・Elements/PageTitle)と `src/stores/adminLayout/` にあった。共有フォルダの置き場と所有を決めた評議会の報告書(20261019-213253-shared-folders-placement-ownership §2)で AppFrames の解体が決まり、ユーザー側(notice frame-move-user、[src/app/(user)/_layout/README.md](<../../(user)/_layout/README.md>))に続いて管理画面の枠も「使う layout のそばの `_layout/`」へ移した(notice frame-move-admin)
- 綴り: 旧 `Sections/SIdebar/` は移動先で `Sidebar/` に直した
- 移し方: 移動だけの区切り。中身は移動で壊れる相対 import の行だけを書き換え、旧パス 18 か所に `@deprecated 旧パス互換` の re-export shim を残した(default export の AdminPage・PageTitle は `export { default }` も)。`src/stores/adminLayout` は index.ts だけ shim。fork の差分は /flux が notice の `moved:` で新パスへ当て直す
- 旧パスのまま残した物: 3 つの admin の layout.tsx(1 行スイッチ化の区切りで扱う)、AdminOuterLayout.tsx・InsaneProtectedLayout.tsx の `@/stores/adminLayout` import と各ファイル先頭の旧パスのコメント(中身を変えないため。後の区切りで直す)
- shim と eslint `deprecated-imports/no-deprecated-path` の旧パス一覧は、区切り 2 を全 fork が取り込んだことを確かめた後の「旧入口撤去」の区切りで削除する

## 採らなかった案

- MenuButton を `(protected)/_layout/` に置く: insane のサイドバーも使うので、insane → (protected) の横向きの参照になる。両方の祖先 `admin/_layout/` に置いた
- store を `src/stores/` に残す: src/stores は app 全体の store の棚で、この store を使うのは管理画面の枠の 2 部品だけ。枠と一緒に置けば持ち主がパスで分かる
- AdminHeaderPortal を同時に動かす: features の画面部品(ItemNavigator など)が使う送り側で、今 `_layout/` へ移すと components・features → app の参照ができる。受け口を持つ Header だけを移し、送り側は共有部品の棚と一緒に決める
