# admin/_layout — 管理画面の枠の部品

## Overview

- `src/app/admin/layout.tsx`・`admin/(protected)/layout.tsx` が描く管理画面の枠(ヘッダー・サイドバー・フッター)と、Screen が使うページ枠部品(AdminPage)を置く場所。import は別名なしの `@/app/admin/_layout/<X>`・`@/app/admin/(protected)/_layout/<X>`。
- 部品は、それを描く layout のそばの `_layout/` に置く。admin 全体(login・setup も)で共有する物は共通の祖先 `admin/_layout/` に置く。
- 範囲の方針は `admin/(protected)/guard.ts`(管理者カテゴリ、管理者 0 人なら `/admin/setup`)。layout は `await guard()` の後、管理の門番の値(`GateProvider`・`AdminCommandGateBridge`)で包んで `./_layout` の枠を素の import で描く(1 行スイッチではない)。`_layout/` の部品は枠を描くだけ。
- 管理の画面部品(ListTop・SearchBox・SortSelect・SecTitle・SelectFilter・ItemNavigator。features の画面部品から使われる)は `src/components/Admin/`。ダッシュボードだけが使う DeveloperMotivationChart は `src/features/core/admin/dashboard/components/parts/` にある

## Usage

### AdminPage(ヘッダーの行・題・中央の差し込み)

- AdminPage はヘッダーの行も描く: 行 = `./AdminHeader` の部品(ロゴの Link・明暗の切り替え。利用者のメニューは無い)。props `center` / `actions` は行の中央・右(明暗の切り替えの前)の位置に入る。`title` は下の「題」。ページごとに変わる中身はページが props で渡す(ヘッダーへ外から差し込む仕組みは無い)
- 行の置き方は利用者の枠のヘッダーと同じ: 上端に固定(`fixed inset-x-0 top-0 header-layer`、全幅でサイドバーの上)、高さは AdminLayout の器が `pt-[var(--app-header-height,0px)]` で空ける
- 行の高さは端末ごとに決まった値 `--admin-header-row-height`(中身で伸び縮みしない、はみ出しは切る)。中身はこの高さに収める: 画面ごとに高い行を宣言する特例は作らない。編集画面の ItemNavigator は SP だけ選択欄を h-8 に詰める(`AdminEditItemNavigator` の `selectClassName`)、PC は既定の大きさのまま。ロゴの箱は読み込みの前から大きさを持つ(`h-6 sm:h-12` + 縦横比 300:61)
- 行の横幅に入りきらないときの決まり(上流が持つ。画面ごとの対応はしない): ロゴと明暗の切り替えは縮めない(`shrink-0`)。題の欄・中央は縮み(`min-w-0`)、題は末尾を … で省く。右の操作(`actions`)は切らない: PC(sm 以上)は縮めず、SP だけ縮む。中に置く部品は縮める先を持つ: 編集画面の ItemNavigator は SP だけ選択欄の最小幅を外して項目名を … で省き、ラベル「切り替え」を見た目だけ隠す(`max-sm:sr-only`、読み上げには残る。`AdminEditItemNavigator` の `selectClassName` / `labelClassName`)
- `main`(既定 true): false = 行だけを描き、children をそのまま続ける。自分のスクロール領域と Main を持つ login・setup だけが使う(未ログインの行はロゴと明暗の切り替えだけ)。管理のページは全部 AdminPage を返す(loader が転送する settings の入口も題だけの AdminPage。`AdminFrame.test.tsx` が検査)
- AdminPage の本文: padding md(sm 以上 lg)/ paddingBlock lg(sm 以上 2xl)の通常ページ。`tabs` は本文の前に下余白 mb-6 で描く。固定ヘッダー直下の残り高さにスナップする非スクロールのページは、ページの隣の枠の宣言に `page: { fill: true }` を書く(下の「枠の宣言」。説明は AdminPage.tsx の JSDoc)
- 題: 管理画面の題は必ず `<AdminPage title="…">` に渡す(位置を選ぶ選択肢は無い。login・setup も)。h1 は 1 つ = 本文の先頭(タブの前)の大見出し `AdminPageTitleBody`(SP で見え、PC は `sm:sr-only` で見た目から消して支援技術向けに残す)。PC で見える題はヘッダーの行のロゴの右隣の `AdminPageTitleCompact`(飾りの文字、aria-hidden)。`main={false}` のときの本文の大見出しは children の前(login・setup では自分のスクロール領域の上)
- 本文の中の見出しはページの題とは別の普通の見出しの部品(`SecTitle` など)。題の無い AdminPage は無い
- 前後の項目へ移る(編集画面): `<AdminPage title="…" actions={<AdminEditItemNavigator domain={domainDisplay} current={record} />}>`(domain = `<domain>/entities/display.ts` の domainDisplay、current = loader の行)。候補は検索の既定の並びの先頭 10 件 + 今の行(`src/lib/crud` の `useDomainItemNavigation`)、選ぶと編集画面へ移るだけで保存しない(未保存の守りは移動の仕組みの側)。雛形(`_template`)の編集画面も同じ形
- 中央の差し込みもページが props で渡す: 銀行振込のレビューの status タブ = `<AdminPage center={<BankTransferStatusTabs />}>`(件数は route の `_screen/useStatusCounts.ts` を一覧の本体と共有)、クーポンのタブ = `<AdminPage center={<AdminCouponSectionTabs variant="header" />}>`

### サイドバー・フッター((protected))

- `sidebar`: 既定 = BaseSidebar。要素は PC の列と SP のドロワーの殻の中に描く。幅・開閉・リサイズは枠が持ち、中身は `useAdminSidebarFrame()` で `placement`("pc" | "sp")・`width`・`close`(SP のドロワーを閉じる。遷移の後に呼ぶ。PC では何もしない)を読む。null = サイドバー・リサイズのつまみ・SP の開閉ボタンを描かない
- `footer`: 既定 = `./Footer`、null = 描かない

## API

### 部品

- `src/app/admin/_layout/`(admin/layout.tsx の枠 + admin 全体で共有する物):
  - `AdminLayout`: 外枠の既定の組み立て(ヘッダーを描かない器 + 子領域)。admin/layout.tsx が 1 行スイッチで描く
  - `AdminHeader.default` / `AdminHeader`: ヘッダーの行の上流の既定(ロゴの Link + 題 / 中央 / 右の位置 + 明暗の切り替え)と、それを指す 1 行スイッチ。AdminPage が描く
  - `AdminPage`: ページコンテナ(default export。ヘッダーの行 title / center / actions・tabs・main)。Screen が使う
  - `AdminEditItemNavigator`: 編集画面の「前後の項目へ移る」(useDomainItemNavigation + 移るだけの ItemNavigator)。編集の Screen が AdminPage actions に置く
  - `AdminPageTitle`: 題の部品(本文の大見出し AdminPageTitleBody・ヘッダーの圧縮の題 AdminPageTitleCompact・見た目 adminPageTitleVariants)。AdminPage が使う
  - `Sidebar/MenuButton`(サイドバーのボタン)・`Sidebar/AdminSidebarFrame`(サイドバーの殻が中身に渡す状態 useAdminSidebarFrame)
  - `extensions/frameTable.ts`: 枠の宣言の表(生成物。pnpm generate extensions)
  - `stores/adminLayout/`: 枠固有の store(Internals「store」)
- `src/app/admin/(protected)/_layout/`(admin/(protected)/layout.tsx の枠):
  - `AdminProtectedLayout`: サイドバー開閉ボタン + ResizableArea(sidebar / footer の props)
  - `ResizableArea`: サイドバー幅の調整 + 本文 + Footer
  - `Footer`
  - `Sidebar/`: BaseSidebar(枠の部品 + メニュー。中身は useAdminMenu = src/features/core/admin/menu/)・PcSidebar・SpSidebar(PC の列 / SP のドロワーの殻)・frameValues.ts(枠の値: アイコンの有無・枠のリンク・ログアウトのアイコン)

### data-slot の一覧

管理の枠の部位に付ける `data-slot`(管理の枠の 8 名 = `src/app/_layout/frame/parts.mjs` の管理の枠)と、この枠の部品が描く見出しの印 `admin-page-title`(一覧の見出しのうち source がこのフォルダのもの)。fork の CSS はこの名前で狙う(`[data-slot="admin-header"]` など)。枠の部品は見た目のための id・`data-admin-main-wrapper` を持たない(狙う先は data-slot だけ)。一覧と要素の照合 = `AdminFrame.test.tsx`(片方にしか無い名前・Primitives の部品の data-slot との衝突は失敗)

- `admin-app-container` — AdminLayout の外枠(枠の根 `data-frame-root`)
- `admin-header` — AdminHeader(AdminPage の行)の `<header>`
- `admin-header-title` — AdminHeader のタイトルの位置(ロゴの右隣)
- `admin-header-center` — AdminHeader の中央の位置
- `admin-header-right` — AdminHeader の右の位置(明暗の切り替えの前)
- `admin-sidebar` — PcSidebar の列・SpSidebar のドロワーと背景(Overlays/Sheet に `slot` / `overlaySlot` で渡す)・ResizableArea のリサイズのつまみ・SP の開閉ボタンの包み(AdminProtectedLayout)。開閉ボタンは Form/Button が自分の `data-slot="button"` を持つので上書きせず、箱を作らない包み(`display: contents`)が印を持つ。ボタンは id を持たない
- `admin-main` — ResizableArea の本文の親(管理の fill の的)
- `admin-footer` — (protected) の Footer の `<footer>`
- `admin-page-title` — AdminPageTitle.tsx のページの題の h1(AdminPageTitleHeading、AdminPage の title の本文側 AdminPageTitleBody)。TextBlocks/PageTitle に `slot="admin-page-title"` を渡して付ける(照合はその字面と `src/components/TextBlocks/headingSlots.test.tsx` の描画)。sm 以上の `sm:sr-only` でも印は残る。ヘッダーの圧縮の題 AdminPageTitleCompact には付けない(見出しではない飾りの文字)。消す・名前を変えるのは notice

## Extension

### 設定

- 上書き: `src/config/layout/admin.config.ts`(`enableSidebarResizing`: サイドバーの幅のドラッグ、`globalMenu.submenuHideDelayMs`: サブメニューが閉じるまでの遅れ)。既定は `./config.ts`

### 所有

- このフォルダ(と `(protected)/_layout/`)の既定の部品 = 提供者(upstream)の所有。fork は直接編集しない(core と同じ扱い)
- fork の丸ごと置き換えはベースの隣に `<名前>.replace` で置く(例 `AdminHeader.replace.tsx`)。fork が足したファイル = 採用者(fork)の所有(名前に fork の印は付けない)。upstream はここに `.replace` / `.override` のファイルを作らない(`.default` は出す。`pnpm test src/lib/screens/screens.test.mjs` が Tier1 でだけ検査)。隣に既定の無い `.replace`・旧い fork の名前の印は全 Tier で失敗
- lint: 既定の部品は `src/components/**` と同じ upstream 所有 UI の強さ(style-tokens・client-service-boundary が error)。`*.replace.tsx` は app/ の画面と同じ warn。page-authz は両方に error
- `admin/layout.tsx` は採用者所有の 1 行スイッチ(`export { AdminLayout as default } from "./_layout/AdminLayout";`、write-once。`pnpm test src/lib/screens/screens.test.mjs` が全 Tier で検査)
- `admin/(protected)/layout.tsx` はガードと同居するので提供者所有。枠の部品は sidebar / footer の props を持つが、fork から渡す口は今は無い(渡すには提供者所有の layout.tsx を編集することになるため)
- 差し替え部品の置き場: `useAdminSidebarFrame` を使う差し替え部品(ヘッダー・サイドバーの中身)は `src/app/admin/**` の中(この `_layout/` の隣の `<名前>.replace`)に置く。`src/app/<X>/_layout/**` を import してよいのは `src/app/<X>/**` だけ

### AdminLayout と AdminHeader(差し替えの口)

- AdminLayout はヘッダーを描かない器(props は children・className だけ。`className`: 外枠に足すクラス名)。ヘッダーの行は各ページの AdminPage が描く
- ヘッダーの行を丸ごと差し替える口 = 1 行スイッチ(既存の `.default` / `.replace` の仕組み): 上流は `AdminHeader.default.tsx`(部品)と、それを指す re-export 1 文の `AdminHeader.tsx` を出す。fork は隣に `AdminHeader.replace.tsx` を置き、`AdminHeader.tsx` の 1 行をそちらへ向ける(検査: `pnpm check extensions`・`pnpm test src/lib/screens/screens.test.mjs`)
- 差し替えの約束: 名前 `AdminHeader`、props `{ title?, center?, actions?, className? }`(className = AdminPage が渡す置き方のクラス。`<header>` に付ける)。部位の印は `data-slot`(下の一覧。高さの測定 useHeaderHeight と枠の宣言の隠す CSS もこの印で読む)を残す
- fork が `admin/layout.tsx` を丸ごと置き換えるときは `_layout/AdminLayout.replace.tsx` へ向ける(器の作りを変えたいとき)

```tsx
// src/app/admin/_layout/AdminHeader.replace.tsx(fork)
"use client";
import type { AdminHeaderProps } from "./AdminHeader.default";

export function AdminHeader({ title, center, actions, className }: AdminHeaderProps) {
  return <header data-slot="admin-header" className={className}>{/* ロゴ・title・center・actions … */}</header>;
}
// src/app/admin/_layout/AdminHeader.tsx: export { AdminHeader, type AdminHeaderProps } from "./AdminHeader.replace";
```

### 枠の宣言(部位の出し入れと fill)

- ページ・ルートの隣の枠の宣言(ルートを作ったリポ = 隣の `frame.ts` の `frame` / 下のリポ = `frame.override.ts` の `override`、型 `AdminFrameDeclaration`)に、隠す部位(`header`・`sidebar`・`footer` × `sp` / `pc`)と `fill` を書く。書式・重ねる順・生成する表: [src/app/_layout/frame/README.md](../../_layout/frame/README.md)
- 仕組み: `pnpm generate extensions` が `extensions/frameTable.ts` を作る
- AdminLayout が共通の読み手 `useFrameAttributes(frameTable)`(`src/app/_layout/frame/useFrameAttributes.ts`、`matchFrame(useSelectedLayoutSegments(), frameTable)`)で今のルートの行を外枠の属性 `data-frame-root` + `data-frame-hide="admin-<部位>-<sp|pc> …"` / `data-frame-fill` にする
- `src/styles/core/frame.css`(手書き、`:has()` なし)がその属性で部位を `display: none` にする。部品はアンマウントしない
- 部位の印 = 要素の `data-slot`(下の「data-slot の一覧」)。frame.css は `[data-slot="admin-<部位>"]` だけを狙う(id では狙わない)。ヘッダー・フッターを差し替えるときは同じ data-slot を付ける
- fill: 外枠は確定高さ。`[data-slot="admin-main"]`(ResizableArea の本文の直接の親)を flex-col + min-height:0 の束縛モードにし、直下のページの本文 `[data-slot="main"]`(AdminPage の Main)を flex-1 min-h-0 の flex-col + 余白トークン(`--admin-page-padding-inline` / `--admin-page-padding-block`)にする。fill の子は `h-full min-h-0 overflow-y-auto` で内部スクロールする
- 上流の管理のページは宣言を持たない(表は空)。端末の境界は 40rem(枠の宣言の約束。サイドバーの PC / SP の切り替えは md だが、隠すのは印の付いた物の全部)

## Internals

### 寸法の CSS 変数

- AdminLayout は寸法の変数を inline に書かない(ヘッダーの高さも測らない)
- `--app-header-height` は `src/styles/core/frame.css` が枠の根に行の高さ `--admin-header-row-height`(SP / PC ごとに決まった値、`src/styles/core`)で書く(行を隠す宣言のときは 0)
- `--app-banner-height` / `--app-bottom-nav-height` は Admin に banner も bottomNav も無いので `src/styles/core/config.css` の `:root` の 0px を継ぐ。`--app-safe-area-*` も :root。Admin の banner slot は作っていない(要る例が無い)
- 一覧は User 側の README(`src/app/(user)/_layout/README.md` の「寸法の CSS 変数」)

### store

- `stores/adminLayout/`(useAdminLayoutStore): 外枠に足すクラス名(extraClassName)を持つ。AdminLayout が読む(上流に書き手は無く、fork の枠の部品が書ける)。使うのは管理画面の枠だけなので枠のそばに置く
- 構成は(index.ts・internalStore.ts・useStore.ts、internalStore は useStore からだけ使う)

## Verification

- `pnpm test src/app/admin/_layout/`: `AdminLayout.test.tsx`(slot と既定の DOM)・`AdminFrame.test.tsx`(data-slot の一覧と要素の照合・枠の表の結線)
