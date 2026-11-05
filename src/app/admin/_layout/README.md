# admin/_layout — 管理画面の枠の部品

`src/app/admin/layout.tsx`・`admin/(protected)/layout.tsx`・`admin/insane/layout.tsx` が描く管理画面の枠(ヘッダー・サイドバー・フッター)と、Screen が使うページ枠部品(AdminPage。PageTitle は互換だけ)を置く場所。import は別名なしの `@/app/admin/_layout/<X>`・`@/app/admin/(protected)/_layout/<X>`・`@/app/admin/insane/_layout`。

## ディレクトリ構成

部品は、それを描く layout のそばの `_layout/` に置く。(protected) と insane の両方が使う物は共通の祖先 `admin/_layout/` に置く。

```
src/app/admin/_layout/                  # admin/layout.tsx の枠 + admin 全体で共有する物
├── AdminLayout.tsx         # 外枠の既定の組み立て(ヘッダーを描かない器 + 子領域、header slot = 差し替えの口)。admin/layout.tsx が 1 行スイッチで描く
├── AdminHeader.tsx         # ヘッダーの行の部品(ロゴの Link + 題 / 中央 / 右の受け口 + 明暗の切り替え)。AdminPage が描く
├── AdminHeaderContext.tsx  # AdminPageHeader(AdminPage の固定の行)と、header slot で差し替え中は行を描かない印(指令 17 までの橋)
├── Header.tsx              # 互換の Header(props なしの AdminHeader、流れの中の形)。指令 17 で外す
├── HeaderSlots.tsx         # AdminHeaderSlots: ヘッダーの受け口 3 つ(タイトル / 中央 / 右)をまとめて描く
├── AdminPage.tsx           # ページコンテナ(default export。ヘッダーの行 title / center / actions・tabs・main)。Screen が使う
├── AdminEditItemNavigator.tsx  # 編集画面の「前後の項目へ移る」(useDomainItemNavigation + 移るだけの ItemNavigator)。編集の Screen が AdminPage actions に置く
├── AdminPageTitle.tsx      # 題の部品(本文の大見出し AdminPageTitleBody・ヘッダーの圧縮の題 AdminPageTitleCompact・見た目 adminPageTitleVariants)。AdminPage が使う
├── PageTitle.tsx           # @deprecated 互換(placement の題)。上流の使用 0、指令 17 で消す
├── Sidebar/MenuButton.tsx  # サイドバーのボタン(通常 / insane の両サイドバーが使う)
├── Sidebar/AdminSidebarFrame.tsx  # サイドバーの殻が中身に渡す状態(useAdminSidebarFrame)
├── extensions/frameTable.ts  # 枠の宣言の表(生成物。pnpm extensions:generate)
├── AdminLayout.test.tsx    # pnpm test:admin-layout(slot と既定の DOM)
├── AdminFrame.test.tsx     # pnpm test:admin-layout(data-slot の一覧と要素の照合・枠の表の結線)
└── stores/adminLayout/     # 枠固有の store(下の「store」)

src/app/admin/(protected)/_layout/      # admin/(protected)/layout.tsx の枠
├── AdminProtectedLayout.tsx  # サイドバー開閉ボタン + ResizableArea(sidebar / footer の props)
├── ResizableArea.tsx         # サイドバー幅の調整 + 本文 + Footer
├── Footer.tsx
└── Sidebar/                  # BaseSidebar(メニュー本体)・PcSidebar・SpSidebar(PC の列 / SP のドロワーの殻)

src/app/admin/insane/_layout/           # admin/insane/layout.tsx の枠(index.ts で一括 export)
└── InsaneProtectedLayout・InsaneResizableArea・InsaneSidebar・InsanePcSidebar・InsaneSpSidebar
```

範囲の方針は `admin/(protected)/guard.ts`・`admin/insane/guard.ts`(管理者カテゴリ / admin ロール、管理者 0 人なら `/admin/setup`)。両 layout は `await guard()` の 1 行の後に `./_layout` の枠を素の import で描く(1 行スイッチではない)。`_layout/` の部品は枠を描くだけ。

まだ `src/components/AppFrames/` に残っている物(後の区切りで扱う):

- `Admin/Elements/` の PageTitle 以外(AdminHeaderPortal・ListTop・SearchBox・SortSelect・SecTitle・SelectFilter・ItemNavigator): features の画面部品から使われるので、共有部品の棚を決める区切りで一緒に動かす(ダッシュボードだけが使う DeveloperMotivationChart は `src/features/core/admin/dashboard/components/parts/` へ移動済み)。PageTitle.tsx は AdminHeaderPortal を絶対パス `@/components/AppFrames/Admin/Elements/AdminHeaderPortal` で参照している
- `AppFrames/constants.ts`(ヘッダー・フッターの要素 ID と受け口の ID): useHeaderHeight の汎用化と一緒に後で動かす

## 所有

- このフォルダ(と `(protected)/_layout/`・`insane/_layout/`)の既定の部品 = 提供者(upstream)の所有。fork は直接編集しない(core と同じ扱い。CLAUDE.md CORE_FILES)
- fork の丸ごと置き換えはベースの隣に `<名前>.replace` で置く(例 `Header.replace.tsx`)。fork が足したファイル = 採用者(fork)の所有(名前に fork の印は付けない)。upstream はここに点つきの名前のファイルを作らない(`pnpm test:screens` が Tier1 でだけ検査)。隣に既定の無い `.replace`・旧い fork の名前の印は全 Tier で失敗
- lint: 既定の部品は `src/components/**` と同じ upstream 所有 UI の強さ(style-tokens・client-service-boundary が error)。`*.replace.tsx` は app/ の画面と同じ warn。page-authz は両方に error
- `admin/layout.tsx` は採用者所有の 1 行スイッチ(`export { AdminLayout as default } from "./_layout/AdminLayout";`、write-once。`pnpm test:screens` が全 Tier で検査)
- `admin/(protected)/layout.tsx`・`admin/insane/layout.tsx` はガードと同居するので提供者所有。枠の部品は sidebar / footer の props を持つが、fork から渡す口は proxy の /admin 関所の区切り(F2)まで無い(渡すには提供者所有の layout.tsx を編集することになるため)
- 差し替え部品の置き場: `useAdminSidebarFrame` / `AdminHeaderSlots` を使う差し替え部品(ヘッダー・サイドバーの中身)は `src/app/admin/**` の中(この `_layout/` の隣の `<名前>.replace`)に置く。`src/app/<X>/_layout/**` を import してよいのは `src/app/<X>/**` だけ、という規則を後の区切りで検査にするため(features/** に置くとそこで落ちる)

## AdminLayout と slot

- slot の約束(User の UserLayout と同じ): 省略(undefined) = 既定の部品 / null = 描かない / 要素 = それを描く
- `header`(差し替えの口。指令 17 で AdminHeader の差し替えに置き換える): 省略 = 器はヘッダーを描かず、各ページの AdminPage が行を描く / 要素 = 器の先頭(前と同じ場所、流れの中)に描き、AdminPage は自分の行を描かない(`./AdminHeaderContext`)/ null = どちらも描かない。`className`: 外枠に足すクラス名
- fork の置き換え: `admin/layout.tsx` を `_layout/AdminLayout.replace.tsx` へ向け、そこで既定の AdminLayout に slot を渡す

```tsx
// src/app/admin/_layout/AdminLayout.replace.tsx
import type { ReactNode } from "react";

import { AdminLayout } from "./AdminLayout";
import { ProjectAdminHeader } from "./Header.replace";

export function ProjectAdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayout header={<ProjectAdminHeader />}>{children}</AdminLayout>;
}
// admin/layout.tsx: export { ProjectAdminLayout as default } from "./_layout/AdminLayout.replace";
```

- ヘッダーを差し替えるときは `<header id={APP_HEADER_ELEMENT_ID}>`(`@/components/AppFrames/constants`)の中で、ロゴ等の後に `<AdminHeaderSlots trailing={…} />` を描く。受け口が無いと PageTitle placement="header" の見出し(sm 以上)と AdminHeaderPortal の中身が出ない。受け口の id は test:admin-layout が固定している

- 寸法の CSS 変数: AdminLayout が外枠の inline に書くのは `--app-header-height`(ヘッダーの実測の高さ)だけで、測れた時だけ書く(`useHeaderHeight()` が null = 測る前は書かず、`src/styles/core/frame.css` の外枠の初期値 = 今の行の高さが効くので最初の表示とページを移る間も本文が固定の行に重ならない)。`--app-banner-height` / `--app-bottom-nav-height` は Admin に banner も bottomNav も無いので書かず、`src/styles/core/config.css` の `:root` の 0px を継ぐ。`--app-safe-area-*` も :root。一覧と経緯は User 側の README(`src/app/(user)/_layout/README.md` の「寸法の CSS 変数」)。Admin の banner slot は作っていない(要る例が無い)

## サイドバー・フッター((protected)・insane)

- `sidebar`: 既定 = BaseSidebar(insane は InsaneSidebar)。要素は PC の列と SP のドロワーの殻の中に描く。幅・開閉・リサイズは枠が持ち、中身は `useAdminSidebarFrame()` で `placement`("pc" | "sp")・`width`・`close`(SP のドロワーを閉じる。遷移の後に呼ぶ。PC では何もしない)を読む。null = サイドバー・リサイズのつまみ・SP の開閉ボタンを描かない
- `footer`: (protected) の既定 = `./Footer`、null = 描かない。insane の既定 = 無し(今の insane はフッターを持たない)、要素のときだけ本文の後に描く

## AdminPage(ヘッダーの行・題・中央の差し込み)

- AdminPage はヘッダーの行も描く: 行 = `./AdminHeader` の部品(ロゴの Link・明暗の切り替え。利用者のメニューは無い)。props `center` / `actions` は行の中央・右(明暗の切り替えの前)の受け口の中に入る。`title` は下の「題」。受け口の id(`#admin-header-*-slot`)と data-slot は行の中に今の名前で残し、AdminHeaderPortal・PageTitle placement="header"・ItemNavigator の差し込みもここに着地する(帯を足す段。portal と id を消すのは指令 17)
- 行の置き方は利用者の枠のヘッダーと同じ: 上端に固定(`fixed inset-x-0 top-0 header-layer`、全幅でサイドバーの上)、高さは AdminLayout の器が `pt-[var(--app-header-height,0px)]` で空ける(測る前は frame.css の初期値 = 今の行の高さ、測った後は実測。下の「寸法の CSS 変数」。ブラウザの確かめは指令 21)
- `main`(既定 true): false = 行だけを描き、children をそのまま続ける。自分のスクロール領域と Main を持つ login・setup だけが使う(未ログインの行はロゴと明暗の切り替えだけ)。AdminPage を使わない管理のページは settings の入口(loader が転送して null)だけ(`AdminFrame.test.tsx` が一覧を出す)
- AdminPage の本文: padding lg / paddingBlock xl の通常ページ。`tabs` は本文の前に下余白 mb-6 で描く。固定ヘッダー直下の残り高さにスナップする非スクロールのページは、ページの隣の枠の宣言に `page: { fill: true }` を書く(下の「枠の宣言」。説明は AdminPage.tsx の JSDoc)
- 題(D135): 管理画面の題は必ず `<AdminPage title="…">` に渡す(位置を選ぶ選択肢は無い。login・setup も)。h1 は 1 つ = 本文の先頭(タブの前)の大見出し `AdminPageTitleBody`(SP で見え、PC は `sm:sr-only` で見た目から消して支援技術向けに残す)。PC で見える題はヘッダーの行のロゴの右隣の `AdminPageTitleCompact`(飾りの文字、aria-hidden)。見た目は前の PageTitle placement="header" と同じ。`main={false}` のときの本文の大見出しは children の前(login・setup では自分のスクロール領域の上)
- 本文の中の見出しはページの題とは別の普通の見出しの部品(`SecTitle` など)。題の無い AdminPage は前から題を持たない insane の 2 画面だけ(本文の見出しは SecTitle)
- 前後の項目へ移る(編集画面): `<AdminPage title="…" actions={<AdminEditItemNavigator domain={domainDisplay} current={record} />}>`(domain = `<domain>/entities/display.ts` の domainDisplay、current = loader の行)。候補は検索の既定の並びの先頭 10 件 + 今の行(`src/lib/crud` の `useDomainItemNavigation`)、選ぶと編集画面へ移るだけで保存しない(D127。未保存の守りは移動の仕組みの側)。雛形(`_template`)の編集画面も同じ形
- 中央の差し込みもページが props で渡す: 銀行振込のレビューの status タブ = `<AdminPage center={<BankTransferStatusTabs />}>`(件数は route の `_screen/useStatusCounts.ts` を一覧の本体と共有)、クーポンのタブ = `<AdminPage center={<CouponSectionTabs variant="header" />}>`
- 互換(指令 17 で消す、上流の使用 0): `PageTitle`(`placement="header"` = 前と同じ AdminHeaderPortal で題の受け口へ、`"page"` = 本文の大見出し)・`CouponSectionTabs placement="header"`(AdminHeaderPortal で中央の受け口へ)。fork はこの間に `title` / `center` へ移す

## 枠の宣言(部位の出し入れと fill)

- ページ・ルートの隣の枠の宣言(上流 = ルートを作ったリポの `frame.default.ts` の `frameDefault` / 下のリポ = `frame.ts` の `frame`、型 `AdminFrameDeclaration`)に、隠す部位(`header`・`sidebar`・`footer` × `sp` / `pc`)と `fill` を書く。書式・重ねる順・生成する表: [src/app/_layout/frame/README.md](../../_layout/frame/README.md)
- 仕組み: `pnpm extensions:generate` が `extensions/frameTable.ts` を作り、AdminLayout が共通の読み手 `useFrameAttributes(frameTable)`(`src/app/_layout/frame/useFrameAttributes.ts`、`matchFrame(useSelectedLayoutSegments(), frameTable)`)で今のルートの行を外枠の属性 `data-frame-root` + `data-frame-hide="admin-<部位>-<sp|pc> …"` / `data-frame-fill` にする。`src/styles/core/frame.css`(手書き、`:has()` なし)がその属性で部位を `display: none` にする。部品はアンマウントしない
- 部位の印 = 要素の `data-slot`(下の「data-slot の一覧」)。frame.css は `[data-slot="admin-<部位>"]` と id(`#header`・`#footer`・`#admin-sidebar-toggle`。部品を差し替えた fork 向けの一時の橋渡し)を狙う。ヘッダー・フッターを差し替えるときは id を残すか同じ data-slot を付ける
- fill: 外枠は前から確定高さ。`[data-admin-main-wrapper]`(ResizableArea・InsaneResizableArea の本文の直接の親)を flex-col + min-height:0 の束縛モードにし、直下のページの本文 `#main`(AdminPage の Main)を flex-1 min-h-0 の flex-col + 余白トークン(`--admin-page-padding-inline` / `--admin-page-padding-block`)にする。前の `<AdminPage fill>` と同じ見た目。fill の子は `h-full min-h-0 overflow-y-auto` で内部スクロールする
- 上流の管理のページは宣言を持たない(表は空)。端末の境界は 40rem(枠の宣言の約束。サイドバーの PC / SP の切り替えは md だが、隠すのは印の付いた物の全部)
- 以前: `<AdminPage fill>` が本文に `data-admin-fill` を出し、`config.css` の `[data-admin-main-wrapper]:has([data-admin-fill])` が親を切り替えていた。共有の棚の評議会(計画書 02)で子から親を変える `:has()` をやめ、利用者の枠と同じ宣言 + 外枠の属性にした

## data-slot の一覧

管理の枠の部位に付ける `data-slot`(余白の議会の一覧の管理の枠の 8 名 = `src/app/_layout/frame/parts.mjs` の管理の枠)。fork の CSS はこの名前で狙う(`[data-slot="admin-header"]` など)。今の id(`#header`・`#footer`・受け口の `#admin-header-*-slot`)と `data-admin-main-wrapper` は今どおり残す。一覧と要素の照合 = `AdminFrame.test.tsx`(片方にしか無い名前・shadcn の data-slot との衝突は失敗)

- `admin-app-container` — AdminLayout の外枠(枠の根 `data-frame-root`)
- `admin-header` — AdminHeader(AdminPage の行・互換の Header)の `<header id="header">`
- `admin-header-title` — AdminHeader の中の HeaderSlots のタイトルの受け口 `#admin-header-title-slot`
- `admin-header-center` — AdminHeader の中の HeaderSlots の中央の受け口 `#admin-header-center-slot`
- `admin-header-right` — AdminHeader の中の HeaderSlots の右の受け口 `#admin-header-right-slot`
- `admin-sidebar` — PcSidebar の列・SpSidebar のドロワーと背景・ResizableArea のリサイズのつまみ・SP の開閉ボタンの包み(AdminProtectedLayout・InsaneProtectedLayout。insane の Insane* も同じ)。開閉ボタンは Form/Button が自分の `data-slot="button"` を持つので上書きせず、箱を作らない包み(`display: contents`)が印を持つ。ボタンの `id="admin-sidebar-toggle"` はサイドバーを差し替えた fork 向けの一時の橋渡し(frame.css)
- `admin-main` — ResizableArea の本文の親 `[data-admin-main-wrapper]`(insane は InsaneResizableArea のスクロール領域)
- `admin-footer` — (protected) の Footer の `<footer id="footer">`

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
- shim と eslint `deprecated-imports/no-deprecated-path` の旧パス一覧、旧名の互換 AdminOuterLayout / AdminLayoutClientProps は、区切り 2 を全 fork が取り込んだことを確かめた後の「旧入口撤去」の区切り(notice old-entry-removal)で削除した

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
