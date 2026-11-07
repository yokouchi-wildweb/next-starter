# admin/_layout — 管理画面の枠の部品

`src/app/admin/layout.tsx`・`admin/(protected)/layout.tsx`・`admin/insane/layout.tsx` が描く管理画面の枠(ヘッダー・サイドバー・フッター)と、Screen が使うページ枠部品(AdminPage。PageTitle は互換だけ)を置く場所。import は別名なしの `@/app/admin/_layout/<X>`・`@/app/admin/(protected)/_layout/<X>`・`@/app/admin/insane/_layout`。

## ディレクトリ構成

部品は、それを描く layout のそばの `_layout/` に置く。(protected) と insane の両方が使う物は共通の祖先 `admin/_layout/` に置く。

```
src/app/admin/_layout/                  # admin/layout.tsx の枠 + admin 全体で共有する物
├── AdminLayout.tsx         # 外枠の既定の組み立て(ヘッダーを描かない器 + 子領域)。admin/layout.tsx が 1 行スイッチで描く
├── AdminHeader.default.tsx # ヘッダーの行の上流の既定(ロゴの Link + 題 / 中央 / 右の位置 + 明暗の切り替え)
├── AdminHeader.tsx         # 1 行スイッチ(./AdminHeader.default を指す。fork は ./AdminHeader.replace へ向ける)。AdminPage が描く
├── AdminPage.tsx           # ページコンテナ(default export。ヘッダーの行 title / center / actions・tabs・main)。Screen が使う
├── AdminEditItemNavigator.tsx  # 編集画面の「前後の項目へ移る」(useDomainItemNavigation + 移るだけの ItemNavigator)。編集の Screen が AdminPage actions に置く
├── AdminPageTitle.tsx      # 題の部品(本文の大見出し AdminPageTitleBody・ヘッダーの圧縮の題 AdminPageTitleCompact・見た目 adminPageTitleVariants)。AdminPage が使う
├── Sidebar/MenuButton.tsx  # サイドバーのボタン(通常 / insane の両サイドバーが使う)
├── Sidebar/AdminSidebarFrame.tsx  # サイドバーの殻が中身に渡す状態(useAdminSidebarFrame)
├── extensions/frameTable.ts  # 枠の宣言の表(生成物。pnpm generate extensions)
├── AdminLayout.test.tsx    # pnpm test src/app/admin/_layout/(slot と既定の DOM)
├── AdminFrame.test.tsx     # pnpm test src/app/admin/_layout/(data-slot の一覧と要素の照合・枠の表の結線)
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

- `Admin/Elements/`(ListTop・SearchBox・SortSelect・SecTitle・SelectFilter・ItemNavigator): features の画面部品から使われるので、共有部品の棚を決める区切りで一緒に動かす(ダッシュボードだけが使う DeveloperMotivationChart は `src/features/core/admin/dashboard/components/parts/` へ移動済み)
- `AppFrames/constants.ts`(ヘッダー・フッターの要素 ID と受け口の ID): useHeaderHeight の汎用化と一緒に後で動かす

## 所有

- このフォルダ(と `(protected)/_layout/`・`insane/_layout/`)の既定の部品 = 提供者(upstream)の所有。fork は直接編集しない(core と同じ扱い。CLAUDE.md CORE_FILES)
- fork の丸ごと置き換えはベースの隣に `<名前>.replace` で置く(例 `AdminHeader.replace.tsx`)。fork が足したファイル = 採用者(fork)の所有(名前に fork の印は付けない)。upstream はここに点つきの名前のファイルを作らない(`pnpm test src/lib/screens/screens.test.mjs` が Tier1 でだけ検査)。隣に既定の無い `.replace`・旧い fork の名前の印は全 Tier で失敗
- lint: 既定の部品は `src/components/**` と同じ upstream 所有 UI の強さ(style-tokens・client-service-boundary が error)。`*.replace.tsx` は app/ の画面と同じ warn。page-authz は両方に error
- `admin/layout.tsx` は採用者所有の 1 行スイッチ(`export { AdminLayout as default } from "./_layout/AdminLayout";`、write-once。`pnpm test src/lib/screens/screens.test.mjs` が全 Tier で検査)
- `admin/(protected)/layout.tsx`・`admin/insane/layout.tsx` はガードと同居するので提供者所有。枠の部品は sidebar / footer の props を持つが、fork から渡す口は proxy の /admin 関所の区切り(F2)まで無い(渡すには提供者所有の layout.tsx を編集することになるため)
- 差し替え部品の置き場: `useAdminSidebarFrame` を使う差し替え部品(ヘッダー・サイドバーの中身)は `src/app/admin/**` の中(この `_layout/` の隣の `<名前>.replace`)に置く。`src/app/<X>/_layout/**` を import してよいのは `src/app/<X>/**` だけ、という規則を後の区切りで検査にするため(features/** に置くとそこで落ちる)

## AdminLayout と AdminHeader(差し替えの口)

- AdminLayout はヘッダーを描かない器(props は children・className だけ。`className`: 外枠に足すクラス名)。ヘッダーの行は各ページの AdminPage が描く
- ヘッダーの行を丸ごと差し替える口 = 1 行スイッチ(既存の `.default` / `.replace` の仕組み、新しい仕組みは作らない D171): 上流は `AdminHeader.default.tsx`(部品)と、それを指す re-export 1 文の `AdminHeader.tsx` を出す。fork は隣に `AdminHeader.replace.tsx` を置き、`AdminHeader.tsx` の 1 行をそちらへ向ける(検査: `pnpm check extensions`・`pnpm test src/lib/screens/screens.test.mjs`)
- 差し替えの約束: 名前 `AdminHeader`、props `{ title?, center?, actions?, className? }`(className = AdminPage が渡す置き方のクラス。`<header>` に付ける)。部位の印は `data-slot`(下の一覧)と `id="header"`(高さの測定・枠の宣言の橋)を残す
- fork が `admin/layout.tsx` を丸ごと置き換えるときは `_layout/AdminLayout.replace.tsx` へ向ける(器の作りを変えたいとき)

```tsx
// src/app/admin/_layout/AdminHeader.replace.tsx(fork)
"use client";
import type { AdminHeaderProps } from "./AdminHeader.default";

export function AdminHeader({ title, center, actions, className }: AdminHeaderProps) {
  return <header id="header" data-slot="admin-header" className={className}>{/* ロゴ・title・center・actions … */}</header>;
}
// src/app/admin/_layout/AdminHeader.tsx: export { AdminHeader, type AdminHeaderProps } from "./AdminHeader.replace";
```

- 寸法の CSS 変数: AdminLayout は寸法の変数を inline に書かない(ヘッダーの高さも測らない)。`--app-header-height` は `src/styles/core/frame.css` が枠の根に行の高さ `--admin-header-row-height`(SP / PC ごとに決まった値、`src/styles/core`)で書く(行を隠す宣言のときは 0)。`--app-banner-height` / `--app-bottom-nav-height` は Admin に banner も bottomNav も無いので `src/styles/core/config.css` の `:root` の 0px を継ぐ。`--app-safe-area-*` も :root。一覧と経緯は User 側の README(`src/app/(user)/_layout/README.md` の「寸法の CSS 変数」)。Admin の banner slot は作っていない(要る例が無い)

## サイドバー・フッター((protected)・insane)

- `sidebar`: 既定 = BaseSidebar(insane は InsaneSidebar)。要素は PC の列と SP のドロワーの殻の中に描く。幅・開閉・リサイズは枠が持ち、中身は `useAdminSidebarFrame()` で `placement`("pc" | "sp")・`width`・`close`(SP のドロワーを閉じる。遷移の後に呼ぶ。PC では何もしない)を読む。null = サイドバー・リサイズのつまみ・SP の開閉ボタンを描かない
- `footer`: (protected) の既定 = `./Footer`、null = 描かない。insane の既定 = 無し(今の insane はフッターを持たない)、要素のときだけ本文の後に描く

## AdminPage(ヘッダーの行・題・中央の差し込み)

- AdminPage はヘッダーの行も描く: 行 = `./AdminHeader` の部品(ロゴの Link・明暗の切り替え。利用者のメニューは無い)。props `center` / `actions` は行の中央・右(明暗の切り替えの前)の位置に入る。`title` は下の「題」。ページごとに変わる中身はページが props で渡す(ヘッダーへ外から差し込む仕組みは無い、D134)
- 行の置き方は利用者の枠のヘッダーと同じ: 上端に固定(`fixed inset-x-0 top-0 header-layer`、全幅でサイドバーの上)、高さは AdminLayout の器が `pt-[var(--app-header-height,0px)]` で空ける
- 行の高さは端末ごとに決まった値 `--admin-header-row-height`(中身で伸び縮みしない、はみ出しは切る)。中身はこの高さに収める: 画面ごとに高い行を宣言する特例は作らない。編集画面の ItemNavigator は SP だけ選択欄を h-8 に詰める(`AdminEditItemNavigator` の `selectClassName`)、PC は既定の大きさのまま。ロゴの箱は読み込みの前から大きさを持つ(`h-6 sm:h-12` + 縦横比 300:61)
- 行の横幅に入りきらないときの決まり(上流が持つ。画面ごとの対応はしない): ロゴと明暗の切り替えは縮めない(`shrink-0`)。題の欄・中央は縮み(`min-w-0`)、題は末尾を … で省く。右の操作(`actions`)は切らない: PC(sm 以上)は縮めず、SP だけ縮む。中に置く部品は縮める先を持つ: 編集画面の ItemNavigator は SP だけ選択欄の最小幅を外して項目名を … で省き、ラベル「切り替え」を見た目だけ隠す(`max-sm:sr-only`、読み上げには残る。`AdminEditItemNavigator` の `selectClassName` / `labelClassName`)。PC の見た目は前のまま
- `main`(既定 true): false = 行だけを描き、children をそのまま続ける。自分のスクロール領域と Main を持つ login・setup だけが使う(未ログインの行はロゴと明暗の切り替えだけ)。AdminPage を使わない管理のページは settings の入口(loader が転送して null)だけ(`AdminFrame.test.tsx` が一覧を出す)
- AdminPage の本文: padding lg / paddingBlock xl の通常ページ。`tabs` は本文の前に下余白 mb-6 で描く。固定ヘッダー直下の残り高さにスナップする非スクロールのページは、ページの隣の枠の宣言に `page: { fill: true }` を書く(下の「枠の宣言」。説明は AdminPage.tsx の JSDoc)
- 題(D135): 管理画面の題は必ず `<AdminPage title="…">` に渡す(位置を選ぶ選択肢は無い。login・setup も)。h1 は 1 つ = 本文の先頭(タブの前)の大見出し `AdminPageTitleBody`(SP で見え、PC は `sm:sr-only` で見た目から消して支援技術向けに残す)。PC で見える題はヘッダーの行のロゴの右隣の `AdminPageTitleCompact`(飾りの文字、aria-hidden)。見た目は前の題の部品(ヘッダーへ差し込む形)と同じ。`main={false}` のときの本文の大見出しは children の前(login・setup では自分のスクロール領域の上)
- 本文の中の見出しはページの題とは別の普通の見出しの部品(`SecTitle` など)。題の無い AdminPage は前から題を持たない insane の 2 画面だけ(本文の見出しは SecTitle)
- 前後の項目へ移る(編集画面): `<AdminPage title="…" actions={<AdminEditItemNavigator domain={domainDisplay} current={record} />}>`(domain = `<domain>/entities/display.ts` の domainDisplay、current = loader の行)。候補は検索の既定の並びの先頭 10 件 + 今の行(`src/lib/crud` の `useDomainItemNavigation`)、選ぶと編集画面へ移るだけで保存しない(D127。未保存の守りは移動の仕組みの側)。雛形(`_template`)の編集画面も同じ形
- 中央の差し込みもページが props で渡す: 銀行振込のレビューの status タブ = `<AdminPage center={<BankTransferStatusTabs />}>`(件数は route の `_screen/useStatusCounts.ts` を一覧の本体と共有)、クーポンのタブ = `<AdminPage center={<CouponSectionTabs variant="header" />}>`

## 枠の宣言(部位の出し入れと fill)

- ページ・ルートの隣の枠の宣言(上流 = ルートを作ったリポの `frame.default.ts` の `frameDefault` / 下のリポ = `frame.ts` の `frame`、型 `AdminFrameDeclaration`)に、隠す部位(`header`・`sidebar`・`footer` × `sp` / `pc`)と `fill` を書く。書式・重ねる順・生成する表: [src/app/_layout/frame/README.md](../../_layout/frame/README.md)
- 仕組み: `pnpm generate extensions` が `extensions/frameTable.ts` を作り、AdminLayout が共通の読み手 `useFrameAttributes(frameTable)`(`src/app/_layout/frame/useFrameAttributes.ts`、`matchFrame(useSelectedLayoutSegments(), frameTable)`)で今のルートの行を外枠の属性 `data-frame-root` + `data-frame-hide="admin-<部位>-<sp|pc> …"` / `data-frame-fill` にする。`src/styles/core/frame.css`(手書き、`:has()` なし)がその属性で部位を `display: none` にする。部品はアンマウントしない
- 部位の印 = 要素の `data-slot`(下の「data-slot の一覧」)。frame.css は `[data-slot="admin-<部位>"]` と id(`#header`・`#footer`・`#admin-sidebar-toggle`。部品を差し替えた fork 向けの一時の橋渡し)を狙う。ヘッダー・フッターを差し替えるときは id を残すか同じ data-slot を付ける
- fill: 外枠は前から確定高さ。`[data-admin-main-wrapper]`(ResizableArea・InsaneResizableArea の本文の直接の親)を flex-col + min-height:0 の束縛モードにし、直下のページの本文 `#main`(AdminPage の Main)を flex-1 min-h-0 の flex-col + 余白トークン(`--admin-page-padding-inline` / `--admin-page-padding-block`)にする。前の `<AdminPage fill>` と同じ見た目。fill の子は `h-full min-h-0 overflow-y-auto` で内部スクロールする
- 上流の管理のページは宣言を持たない(表は空)。端末の境界は 40rem(枠の宣言の約束。サイドバーの PC / SP の切り替えは md だが、隠すのは印の付いた物の全部)
- 以前: `<AdminPage fill>` が本文に `data-admin-fill` を出し、`config.css` の `[data-admin-main-wrapper]:has([data-admin-fill])` が親を切り替えていた。共有の棚の評議会(計画書 02)で子から親を変える `:has()` をやめ、利用者の枠と同じ宣言 + 外枠の属性にした

## data-slot の一覧

管理の枠の部位に付ける `data-slot`(余白の議会の一覧の管理の枠の 8 名 = `src/app/_layout/frame/parts.mjs` の管理の枠)。fork の CSS はこの名前で狙う(`[data-slot="admin-header"]` など)。今の id(`#header`・`#footer`)と `data-admin-main-wrapper` は今どおり残す(ヘッダーの題・中央・右の位置に id は無い)。一覧と要素の照合 = `AdminFrame.test.tsx`(片方にしか無い名前・shadcn の data-slot との衝突は失敗)

- `admin-app-container` — AdminLayout の外枠(枠の根 `data-frame-root`)
- `admin-header` — AdminHeader(AdminPage の行)の `<header id="header">`
- `admin-header-title` — AdminHeader のタイトルの位置(ロゴの右隣)
- `admin-header-center` — AdminHeader の中央の位置
- `admin-header-right` — AdminHeader の右の位置(明暗の切り替えの前)
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
- slot 化: User の枠(notice frame-slots-user・frame-parts-user)と同じ形に揃えた。admin/layout.tsx を 1 行スイッチにし、外枠を AdminLayout(header slot)に、(protected)・insane の枠に sidebar / footer、AdminPage に tabs、ページの題の既定をヘッダーに(報告書 D1: ヘッダーに出す指定が upstream で 45 か所、指定なしは repo あたり 1〜2 件)。props なしの DOM は前と同じ(pnpm test src/app/admin/_layout/ が slot 化の前の HTML で固定)
- shim と eslint `deprecated-imports/no-deprecated-path` の旧パス一覧、旧名の互換 AdminOuterLayout / AdminLayoutClientProps は、区切り 2 を全 fork が取り込んだことを確かめた後の「旧入口撤去」の区切り(notice old-entry-removal)で削除した

## 採らなかった案

- MenuButton を `(protected)/_layout/` に置く: insane のサイドバーも使うので、insane → (protected) の横向きの参照になる。両方の祖先 `admin/_layout/` に置いた
- store を `src/stores/` に残す: src/stores は app 全体の store の棚で、この store を使うのは管理画面の枠の 2 部品だけ。枠と一緒に置けば持ち主がパスで分かる
- サイドバーの slot を Pc / Sp の殻ごと差し替える: 幅・開閉・SP の開閉ボタンとの連動を差し替え側が作り直すことになる。殻は枠が持ち、中身だけを受けて状態は useAdminSidebarFrame で渡す
- サイドバーを描画関数(render prop)で受ける: slot はすべて ReactNode という User 側の約束から外れる(User の「slot をコンポーネント型で受ける」不採用と同じ)
- ガード付きの layout.tsx をスイッチにしてガードを `_layout/` へ移す: ガードは提供者所有の layout.tsx に残す(報告書 §7。形は F2 で guard.ts と一緒に決める)
- ガード付きの layout.tsx が枠を絶対パスで import する(スイッチの検出を変えない): fork が相対で書くと 1 行スイッチの検査で落ちる罠が残る。検出を `./_layout/` への re-export だけに絞った
- 47 画面の見出し位置を固定の一覧で test する: fork ごとに画面が違う。変更の前後で同じ走査の結果が一致することだけを確かめ、描画の違いは題の部品の test で固定した
- ヘッダーの中身を外から差し込む仕組み(portal・名前つきの受け口・context)を残す: ページの状態をそのまま渡せず最初の HTML に入らない。ページが AdminPage の props で渡す形にして消した(D134、指令 17)
- ヘッダーの差し替えに AdminLayout の prop を使う: 器が行を描かないので受け手が無い。行の部品の 1 行スイッチにした(D171)
