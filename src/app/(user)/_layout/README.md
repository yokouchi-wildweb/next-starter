# (user)/_layout — ユーザー側の枠の部品

## Overview

`src/app/(user)/layout.tsx` が描くユーザーアプリの枠(ヘッダー・フッター・ボトムナビ・背景)と、Screen が使うページ枠部品(UserPage・PageTitle)を置く場所。import は別名なしの `@/app/(user)/_layout/<X>`。

`src/components/AppFrames/User/` に残っている物の説明は [src/components/AppFrames/User/README.md](../../../components/AppFrames/User/README.md)。

決まりの元は CLAUDE.md と .claude/rules/core/(screens.md・change.md・style.md)。この README は使い方と仕組み

所有:

- このフォルダの既定の部品 = 提供者(upstream)の所有。fork は直接編集しない(core と同じ扱い。CLAUDE.md CORE_FILES)
- fork の丸ごと置き換えはベースの隣に `<名前>.replace` で置く(例 `UserLayout.replace.tsx`・`Header/index.replace.tsx`)。fork が足したファイル = 採用者(fork)の所有(所有は git の分岐点で見る。名前に fork の印は付けない)。隣に置き換える既定の無い `.replace` は孤立で失敗(`pnpm test src/lib/screens/screens.test.mjs`)
- upstream はここ(と `_screen/`)に点つきの名前のファイルを作らない(Tier1 でだけ検査、fork では skip)。点つきの名前で許すのは `.replace` と `.test` だけ(旧い fork の名前の印は全 Tier で失敗。移し方 = 共有の棚の印の移行の notice)
- lint: 既定の部品は `src/components/**` と同じ upstream 所有 UI の強さ(style-tokens/no-raw-palette・style-tokens/span-in-heading・client-service-boundary/no-direct-import が error)。丸ごと置き換え(`*.replace.tsx`)は app/ の画面と同じ warn。page-authz(layout はサーバー側でデータを取らない)は両方に error

## Usage

### fork の差し替え手順

1. 値で済むもの(背景の 3 値、ヘッダー・フッター・ボトムナビの表示設定やメニュー)は枠の設定の上書きに書く: 値は `src/config/layout/user.config.ts`、メニュー項目・SNS リンク・ログアウトのアイコンは `src/config/layout/user.ui.config.ts`(Extension「設定ファイル」)
2. 部品を替えるときは、fork の部品をルートの `_components/` に印なしの名前で置き(`src/app/(user)/_components/AcmeHeader.tsx`。`_layout/` の中の部品の隣に `.replace` を置かない: 置き換えられるのは 1 行スイッチの向け先と `<名前>.default` の隣だけで、それ以外は `pnpm check extensions` の孤立の検査が止める)、隣に `UserLayout.replace.tsx` を置いて既定の UserLayout に slot を渡し、layout.tsx をそちらへ向ける

```tsx
// src/app/(user)/_layout/UserLayout.replace.tsx(fork 所有)
import type { ReactNode } from "react";

import { AcmeHeader } from "@/app/(user)/_components/AcmeHeader";

import { UserLayout } from "./UserLayout";

export function AcmeUserLayout({ children }: { children: ReactNode }) {
  return <UserLayout header={<AcmeHeader />}>{children}</UserLayout>;
}
```

```tsx
// src/app/(user)/layout.tsx
export { AcmeUserLayout as default } from "./_layout/UserLayout.replace";
```

3. 枠の構造そのもの(部品の並びや外枠)を変えるときだけ、UserLayout.tsx を `UserLayout.replace.tsx` へコピーして編集する(外枠の `data-frame-root` と `useFrameAttributes(frameTable)` の属性、部位の `data-slot` は残す。無いと枠の宣言が効かない)
- 組み立てでガードを書かない(範囲の守りは layout の隣の guard.ts の guard() だけ)。組み立て(スイッチ先)が旧ガード(authGuard 等)を呼ぶとルート地図の生成が失敗する(`pnpm generate routes`、src/lib/screens/README.md「ルート地図（`src/app/route-map.jsonl`）」)

### fill のページ(本文が画面の高さを埋める)

ページ自体がスクロールしない「アプリ的」な画面（ゲーム、プレイヤー、エディタ、キオスク、楽器 UI 等）向け。
固定ヘッダー直下からフッター / ボトムナビスペーサー直上までの残り高さちょうどにスナップし、内部スクロールは子に委譲する。
ページの隣の枠の宣言に `page: { fill: true }`(枠も隠すなら `hide`)を書き、本文は自分で `flex-1 min-h-0` を付ける。

```tsx
// 隣の frame.ts(上流のルートに fork が書くなら frame.override.ts の override): export const frame = { page: { fill: true } } satisfies FrameDeclaration;
<UserPage containerType="plain" padding="none" className="flex min-h-0 flex-1 flex-col overflow-clip overscroll-none">
  <Toolbar />                                   {/* 固有高さ */}
  <Block className="flex-1 min-h-0 overflow-y-auto">
    <Playlist />                                {/* ここだけスクロール */}
  </Block>
  <Keyboard />                                  {/* 固有高さ、常に見える */}
</UserPage>
```

| 項目 | 内容 |
|------|------|
| 高さの契約 | 子は `flex-1 min-h-0` だけで残り高さを確保する。`calc(100dvh - ...)` やマジックナンバーは書かない |
| ヘッダー | `--app-header-height`（実測値）で自動補正。枠の宣言でヘッダーを隠せばその分広がる |
| フッター / ボトムナビ | フロー内に残るので fill と高さを分け合う。隠せば広がる（スペーサーも自動で 0） |
| SSR | `--viewport-height` 設定前は `100dvh` にフォールバック |

- 仕組み: 外枠 `[data-slot="app-container"]` は既定 `min-h` で中身ぶん伸びるが、`data-frame-fill` が付くと `src/styles/core/frame.css` の規則で確定高さ + `overflow-clip` に切り替わる
- 没入(ヘッダー・フッター・ボトムナビを全部隠す)は枠の宣言の `hide` に 3 つを書く。枠が全部要らないページは枠の外のルートグループに置く
- `safeArea` を付けると `var(--app-safe-area-*)` ぶんのパディングを付与（横向きスマホのノッチ対策）。枠の部位を隠したページ用(部位が出ている辺は枠が避けるので、出したまま付けると二重になる)

### fullscreen との使い分け

| 欲しいもの | 使うもの |
|-----------|---------|
| フロー内に留まる非スクロールのページ土台（ヘッダー等と共存） | 枠の宣言の `page: { fill: true }` + `UserPage`(上の「fill のページ」) |
| 画面全体を覆う一時的なオーバーレイ（スプラッシュ、背景演出） | `<Main containerType="fullscreen">`（FullScreen による fixed オーバーレイ、z 層指定、body スクロールロック） |
| UserLayout の外（独立ルート群）のビューポート固定ページ枠（卓上端末・サイネージ） | `<KioskFrame>`（[Layout/README.md](../../../components/Layout/README.md)「KioskFrame と 1 画面に収める画面」） |

## API

### layout.tsx と slot(枠の差し替え)

- `src/app/(user)/layout.tsx` は 1 行スイッチ: `export { UserLayout as default } from "./_layout/UserLayout";`。page.tsx と同じく採用者(fork)所有・write-once で、upstream は作成後に編集しない。`pnpm test src/lib/screens/screens.test.mjs` が page.tsx と同じ検査関数(`src/lib/screens/checks.mjs` の parseSwitchLayout)で全 Tier に対し検査する
- `(protected)/mypage/layout.tsx` も同じ形で `mypage/_layout/MyPageLayout.tsx`(UserPage narrowStack + Stack + PageTransition)を指す
- 既定の組み立て `UserLayout` の slot(すべて省略可能な props):

| slot | 既定(省略時) | 位置 |
|------|----------------|------|
| `background` | `BackgroundLayer`(値は枠の設定 `layout.background`、`./config.ts`) | 最背面(枠の外側の兄弟) |
| `banner` | なし(省略と `null` は同じ) | 外枠(`app-container`)の先頭、header の前。帯(`app-banner`、fixed・top-0)の中に描く |
| `header` | `UserNavigation`(`./Header`、upstream では既定 Header) | 外枠(`app-container`)の先頭 |
| `footer` | `UserFooter`(`./Footer`、upstream では既定 Footer) | 本文の包みの後 |
| `bottomNav` | `BottomNavSpacer` + `UserBottomNav`(スペーサーごと差し替える) | フッターの後 |

- 未読のお知らせのモーダル: 既定の `UserLayout` が外枠の末尾（ボトムナビの後）に messaging の公開の部品 `InboxUnreadModal`（`@/features/core/messaging/components/InboxUnreadModal`）を置く（slot ではない）。
  - お知らせの機能（門 `messagingInbox`）が閉、または `messagingConfig.inbox.showUnreadModal`（既定 入）が切なら何も描かず取りに行かない。
  - 出す住所は `inbox.unreadModalPaths`（既定 `["/"]`、上書き `src/config/features/messaging.config.ts`）。
  - `UserLayout.replace` は既定の `UserLayout` を描けばそのまま付く（自分の枠にもう 1 つ置くと 2 重に出る）。
  - 流れは hook `useInboxUnreadModal`（自前のモーダルを組む時もこれを呼ぶ。門と config もここで見る）
- slot の約束: 省略(undefined) = 既定の部品 / `null` = 描かない / 要素 = それを描く。props なしの描画(DOM・id・順序)は test で固定(寸法の変数のために既定の DOM が持つ 2 か所は下の「寸法の CSS 変数」)
- banner を渡すと、帯の実測の高さを外枠の `--app-banner-height` に書き、ヘッダーの top と本文(本文の包みの前のスペーサー)をその分押し下げる。SP メニューもヘッダーの下から開く。差し替えたヘッダーは `top-0` の代わりに `top-[var(--app-banner-height,0px)]` を使う(使わないと帯に被る)

### UserNavigation の slot

既定ヘッダー `UserNavigation`(`@/app/(user)/_layout/Header`)は 3 つの props を受ける。約束は UserLayout の slot と同じ(省略 = 既定 / `null` = 描かない / 要素 = それを描く)。

| prop | 既定 | 描く位置 |
|------|------|---------|
| `leading` | なし | `header-left` の先頭(ブランドの前)。例: 戻るボタン |
| `actions` | PC だけに出る「お問い合わせ」 | `header-right`(SP メニューの開閉ボタンの前)。要素はそのまま描くので SP のヘッダーにも出る。PC だけにするなら要素側で `hidden sm:flex` 等 |
| `menuActions` | 幅いっぱいの「お問い合わせ」 | SP メニューのパネル下部。`null` で下部の領域ごと描かない |

fork は `UserLayout.replace.tsx` で header slot に渡す(戻るボタン・通知ベル・設定リンク等を Header のファイルを編集せずに足せる):

```tsx
// src/app/(user)/_layout/UserLayout.replace.tsx
<UserLayout header={<UserNavigation leading={<BackButton />} actions={<NotificationBell />} menuActions={null} />}>
  {children}
</UserLayout>
```

slot で足りない構造の違いは `.replace` のコピーで持つ。

### hooks

カスタムのヘッダー・フッターが使うフック(`@/app/(user)/_layout/hooks`)。

#### useHeaderData

ヘッダーに必要なデータ・状態を全て提供します。

```tsx
import { useHeaderData } from "@/app/(user)/_layout/hooks";

const {
  navItems,         // メニュー項目（認証状態反映済み）
  logoLink,         // ロゴのリンク先
  isMenuOpen,       // メニューの開閉状態
  openMenu,         // メニューを開く
  closeMenu,        // メニューを閉じる
  toggleMenu,       // メニューの開閉をトグル
  headerRef,        // ヘッダー要素のref（高さ計算用）
  headerOffset,     // ヘッダーの高さ（px）
} = useHeaderData();
```

#### useFooterData

フッターに必要なデータを全て提供します。

```tsx
import { useFooterData } from "@/app/(user)/_layout/hooks";

const {
  enabled,          // フッター機能が有効か
  visibility,       // フッターの表示設定（SP/PC、枠の設定の footer.visibility）
  snsEnabled,       // SNSリンクが有効か
  socialLinks,      // SNSリンク一覧
  linksEnabled,     // フッターリンクが有効か
  footerLinks,      // フッターリンク一覧
  linkSeparator,    // フッターリンクのセパレーター
  copyrightEnabled, // コピーライトが有効か
  copyrightText,    // 生成済みコピーライトテキスト
  visibilityClass,  // footer.visibility から作る表示クラス(ページ単位で隠すのは枠の宣言)
} = useFooterData();
```

### UserPage - ページコンテナ

`Main` の薄いラッパー。`containerType` / `padding` / `verticalAlign` 等の Main の props をそのまま受け付ける。

- `containerType` を渡さないときの幅は枠の設定 `layout.pageContainerType`(`./config.ts`、上書き `src/config/layout/user.config.ts`。既定 `"contentShell"` = Main の既定と同じ)。値はアプリ全体で 1 つ(layout ごとの既定は持たない)。ページが `containerType` を渡せばそちらが勝つ(fill のページは `plain` を渡す)
- 縦位置は Main の `verticalAlign`: `"center"`(既定、余白があれば縦中央)/ `"start"`(上揃え、縦に長いページ向け)。`<UserPage verticalAlign="start">` で渡せる

### BottomNav - スマホ用ボトムナビゲーション

スマホ表示時に画面下部に固定表示されるナビゲーション。

- スマホのみ表示（デフォルト）
- 画面下部に固定（`fixed bottom-0`）
- カレントページは色が変わる
- Lucide-reactアイコンを使用

#### 項目の型(type: "link" | "menu")

項目の型(`BottomNavItem` = `BottomNavLinkItem | BottomNavMenuItem`、`BottomNavMenuAction`)は描画用の設定 `./config.ui.ts` で項目の既定と一緒に定義し、`_layout/BottomNav/types.ts` は re-export と判別関数 `isBottomNavMenuItem` だけを持つ(HeaderMenuItem・SocialLinkItem も `./config.ui.ts`、FooterLinkItem は `./config.ts`)。

| type | 必須 | 描き方 |
|------|------|-------|
| 省略 / `"link"` | key・label・href・icon(任意: matchPaths・badge) | リンク。カレントは色が変わる |
| `"menu"` | key・label・icon・menu(`{ key, label, href, icon? }[]`)(任意: menuTitle・badge) | ボタン。タップで上向きのアクションメニュー(Overlays の ActionPopover)を開き、各アクションは遷移だけ。カレントにはならない |

`BottomNavMenu`(メニュー項目から開くアクションメニュー)は単体でも使える。`side`(`"top"` 既定 / `"bottom"`)で開く向きを選ぶ(画面上の帯などから開くときは `"bottom"`)。

#### カレントページ判定

デフォルトでは`href`との完全一致で判定。
複数パスを判定したい場合は`matchPaths`を使用：

```tsx
{
  key: "mypage",
  label: "マイページ",
  href: "/mypage",
  icon: User,
  matchPaths: ["/mypage", "/mypage/settings", "/mypage/orders"],
}
```

#### スペーサー（BottomNavSpacer）

BottomNavは固定表示のため、フッターなど下部コンテンツが隠れないよう`BottomNavSpacer`が自動でスペースを確保します。

- 高さは `var(--app-bottom-nav-height)`(1 要素 BottomNavSpacer)。枠の宣言で隠している端末・ページでは変数が 0 になり、要素も `src/styles/core/frame.css` で隠れる

## Extension

### 設定ファイル

枠の設定は持ち主(この `_layout/`)と上書き(`src/config/layout/`)の 2 つ組。キーは部位ごとにまとまり(`header` / `footer` / `bottomMenu` / `layout`)、上書きには変えたキーだけを書く。部位の出し入れは枠の宣言(`src/app/(user)/frame.ts`)。

| 持ち主(キーと既定) | 上書き(fork が書く) | 中身 |
|----------|------|------|
| `./config.ts`(`userLayoutConfig`) | `src/config/layout/user.config.ts` | 値: ヘッダーのロゴの遷移先・ログアウト、フッター、ボトムナビの高さとカレントの色、`layout.background`(背景画像・オーバーレイの色と透明度)、`layout.pageContainerType` |
| `./config.ui.ts`(`userLayoutUiConfig`) | `src/config/layout/user.ui.config.ts` | 描画用: ヘッダーとボトムナビのメニュー項目、SNS リンク、ログアウトのアイコン、項目の型 |

fork だけのキーは上書きファイルの `export type Extra` に型を足して書く(各上書きファイルの冒頭)。

### Header の設定

値は枠の設定 `header`(`./config.ts`、上書き `src/config/layout/user.config.ts`)、メニュー項目とログアウトのアイコンは描画用の `header`(`./config.ui.ts`、上書き `src/config/layout/user.ui.config.ts`)。部品の差し替えは UserLayout の header slot、ヘッダー・ナビの出し入れは枠の宣言の `header` / `headerNav`。

| 鍵 | 置き場 | 説明 |
|------|------|------|
| `header.logoLink` | config.ts | ロゴクリック時の遷移先 |
| `header.menuIconsEnabled` | config.ts | メニューにアイコンを出すか |
| `header.logout.show` / `.label` / `.redirectTo` | config.ts | ログアウトボタンの表示・ラベル・ログアウト後の遷移先 |
| `header.logout.icon` | config.ui.ts | ログアウトボタンのアイコン |
| `header.authenticatedMenuItems` | config.ui.ts | ログイン中ユーザー用メニュー(`HeaderMenuItem[]`) |
| `header.guestMenuItems` | config.ui.ts | 未ログインユーザー用メニュー |

メニューの配列は上書きで丸ごと置き換わる。バッジは項目の `badge`(固定の ReactNode)で渡す。

- 今の認証の状態の項目が空(`[]`)なら、ナビの部品(PC のナビ・SP の開閉ボタンとメニューのパネル)を描かない。ヘッダー・ブランド・右の CTA は残る(例: ログイン中のメニューをボトムナビだけに出す)

### Footer の設定

値は枠の設定 `footer`(`./config.ts`)、SNS リンクの一覧(react-icons の部品を持つ)だけ描画用の `footer.sns.links`(`./config.ui.ts`)。部品の差し替えは UserLayout の footer slot。

| 鍵 | 置き場 | 説明 |
|------|------|------|
| `footer.enabled` | config.ts | `false` でフッター全体を非表示 |
| `footer.visibility` | config.ts | SP/PC 別の表示制御(`{ sp, pc }`) |
| `footer.sns.enabled` | config.ts | SNS リンクの表示 |
| `footer.sns.links` | config.ui.ts | SNS リンク一覧(`SocialLinkItem[]`、react-icons を使用) |
| `footer.linksEnabled` / `footer.links` / `footer.linkSeparator` | config.ts | フッターリンクの表示・一覧(利用規約等)・区切り |
| `footer.copyright.enabled` / `.year` / `.format` / `.customText` | config.ts | コピーライト(format = `simple` / `allRights` / `full` / `custom`) |

### BottomNav の設定

高さとカレントの色は枠の設定 `bottomMenu`(`./config.ts`)、メニュー項目は描画用の `bottomMenu`(`./config.ui.ts`)。出し入れは枠の宣言の `bottomNav`(既定 = スマホだけ: `src/app/(user)/frame.ts`)。

- 今の認証の状態の項目が空(`[]`)なら、既定のボトムナビ(slot 省略)はスペーサーごと描かず、`--app-bottom-nav-height` も書かない(0px。GlobalToast・`useFrameDimsStyle` も 0 を読む)。枠の宣言はルートごとで認証の状態に依れないので、認証で出し分けるときは項目を空にする

```tsx
// src/config/layout/user.ui.config.ts(type 省略 = リンク項目。配列は丸ごと置き換わる)
import { Home, LogIn, Plus, User } from "lucide-react";
export default {
  bottomMenu: {
    authenticatedMenuItems: [
      { key: "home", label: "ホーム", href: "/", icon: Home },
      { type: "menu", key: "create", label: "作成", icon: Plus, menu: [{ key: "post", label: "投稿", href: "/posts/new" }] },
      { key: "mypage", label: "マイページ", href: "/mypage", icon: User },
    ],
    guestMenuItems: [
      { key: "home", label: "ホーム", href: "/", icon: Home },
      { key: "login", label: "ログイン", href: "/login", icon: LogIn },
    ],
  },
} satisfies UserLayoutUiOverride;
```

| 鍵 | 置き場 | 説明 |
|------|------|------|
| `bottomMenu.height` | config.ts | ナビの高さ(px) |
| `bottomMenu.activeColorType` | config.ts | カレントの色(primary / secondary / accent) |
| `bottomMenu.authenticatedMenuItems` | config.ui.ts | ログイン中ユーザー用メニュー |
| `bottomMenu.guestMenuItems` | config.ui.ts | 未ログインユーザー用メニュー |

### 寸法の CSS 変数

| 変数 | 値 | 書く所 |
|------|----|--------|
| `--app-header-height` | ヘッダー(`[data-slot="header"]` / `[data-slot="admin-header"]`。差し替えたヘッダーもこの印で測られる)の高さ。初期値 = 今の行の高さ(外枠ごと・端末ごと、測る前の最初の表示とページを移る間に使う)、測った値が上書きする。枠の宣言で隠している端末は 0px | 初期値と隠す間の 0 は `src/styles/core/frame.css`、測った値は UserLayout・AdminLayout の外枠の inline(`useHeaderHeight()` が値を返した時だけ) |
| `--app-banner-height` | banner の実測の高さ。banner が無い時は書かない(0px) | UserLayout の外枠の inline(banner がある時だけ) |
| `--app-bottom-nav-height` | `calc(bottomMenu.height px + var(--app-safe-area-bottom))` = ボトムナビが実際に覆う高さ(`bottomMenu.height` は枠の設定 `./config.ts`。iOS では下の safe-area ぶん高い)。`bottomNav={null}` の時と、既定のボトムナビの項目が空の時は書かない(0px)。ルートの枠の宣言(既定は PC で隠す)で隠している間は 0px(`!important` で上書き) | UserLayout の外枠の inline / 0 は `src/styles/core/frame.css` |
| `--app-safe-area-top/right/bottom/left` | 端末の切り欠き(CSS の env() の safe-area-inset-*、無ければ 0px)。env() を直接書くのはこの定義だけ | `src/styles/core/config.css` の `:root` |

- 既定値(0px と safe-area)は `src/styles/core/config.css` の `:root`。Admin は header だけを書き、ほかは :root の既定を継ぐ
- 外枠の配下(ページ・その中の fixed 要素)は px を直書きせずこれらを使う(例 `bottom-[calc(var(--app-bottom-nav-height)+8px)]`。規則: .claude/rules/core/style.md frame_dims)。ボトムナビを隠したページや PC では自動で 0 になる。`--app-*-height` は inline が勝つので fork の CSS(`src/styles/` 直下)からは上書きできない
- `--app-header-height` は枠の宣言でヘッダーを隠すと測る前から 0(frame.css)、測った後も display: none で 0 に追随する。`--app-banner-height` は隠す対象外
- BottomNavSpacer は `--app-bottom-nav-height` を読む 1 要素。BottomNav 本体の高さ(`style` の height)も同じ計算(`calc(<px> + var(--app-safe-area-bottom))`、safe-area は padding-bottom で避ける)。変数が safe-area を含むので、使う側で safe-area を足さない
- body 直下へ portal する部品(GlobalToast・fork の BodyPortal の部品)は外枠の変数を継げない(:root の 0px になる) → `useFrameDimsStyle()`(`@/lib/frameDims`。変数の名前と外枠の印は `src/config/lib/frameDims.config.ts` で上書き)の style を portal した一番外の要素に付け、中は外枠の中と同じく `var(--app-bottom-nav-height)` などで書く。値は外枠 `[data-frame-root]` の計算値(header / banner / bottom-nav。隠している間・出さないデバイスでは 0)で、表示中の切り替えと画面幅の変化にも追随する。外枠を自分で読まない。GlobalToast もこれを使う
- 既定の DOM の差分(test で固定): Header の class `top-0` → `top-[var(--app-banner-height,0px)]`、外枠の style に `--app-bottom-nav-height:calc(64px + var(--app-safe-area-bottom))`(safe-area の無い端末では 64px と同じ)。banner が無い時の Header の計算値・見た目は同じ
- 端の避け方(viewport-fit=cover が既定、root の枠の設定 `src/app/_layout/config.ts`(上書き `src/config/layout/root.config.ts`)): 枠の部品が `--app-safe-area-*` で端末の切り欠きを避ける。ヘッダー = 上(banner がある時は banner が上を避け、ヘッダーは `max(0, 上 − banner の高さ)`)と左右、banner = 上と左右、本文の包み・フッター = 左右、ボトムナビ = 下と左右。切り欠きの無い画面では全部 0 で見た目は同じ。ページ側で同じ辺を足さない(UserPage の `safeArea` は枠の部位を隠したページ用)
- header / footer の決め方は「slot → 既定(`./Header` の UserNavigation・`./Footer` の UserFooter)」。config は値だけを持ち、部品を export しない

### 枠の部位を隠す・fill(枠の宣言)

ページや layout の隣の枠の宣言で「そのルートで枠のどの部位を隠すか・本文が画面の高さを埋めるか(fill)」を書く。ルートを作ったリポ(上流、fork の自分のルート)は `frame.ts`(`export const frame`)、その下のリポ(fork・中間 Tier)は上流のルートの隣に `frame.override.ts`(`export const override`、`frame.ts` の上に重なる)。範囲はキーで名指す: `layout:` = 隣の layout.tsx の下全部、`page:` = 隣の page.tsx だけ。書式・重ね方・照合の順は [src/app/_layout/frame/README.md](../../_layout/frame/README.md)。

```ts
// src/app/(user)/maintenance/frame.ts(上流。fork が変えるときは隣に frame.override.ts の export const override)
import type { FrameDeclaration } from "@/app/_layout/frame";

export const frame = {
  page: { hide: { headerNav: { sp: true, pc: true }, footer: { sp: true, pc: true }, bottomNav: { sp: true, pc: true } } },
} satisfies FrameDeclaration;
```

- 隠せる部位: `header` / `headerNav`(ヘッダーは残る)/ `footer` / `bottomNav`(スペーサーごと)。端末 `sp` = 40rem 未満 / `pc` = 40rem 以上
- 枠の全体の既定 = `src/app/(user)/frame.ts` の `layout:`(上流: ボトムナビを PC で隠す = スマホだけ。同じファイルの `page:` はトップページ / の fill)。fork が変えるときは隣に `frame.override.ts`
- 仕組み: `pnpm generate extensions` が宣言を解決して `extensions/frameTable.ts` を作り、UserLayout が共通の読み手 `useFrameAttributes(frameTable)`(`src/app/_layout/frame/useFrameAttributes.ts`、`matchFrame(useSelectedLayoutSegments(), frameTable)`)で今のルートの行を外枠 `#user-app-container` の属性 `data-frame-hide="<部位>-<sp|pc> …"` / `data-frame-fill` にする。
  - `src/styles/core/frame.css`(手書きの静的な規則、`:has()` なし)がその属性で部位を `display: none` にし、fill では外枠を確定高さ + `overflow: clip` にする。
  - 部品はアンマウントしない
- 効く時点: 属性は外枠そのものに付くので初回の HTML に入る(JavaScript なしでも効く)。client 遷移では loading.tsx の間から次のルートの宣言に切り替わる。戻る・進むも同じ
- 狙う先: 部位の印 `[data-slot="<部位>"]`(下の「data-slot の一覧」)だけで全部隠せる。差し替えた部品は外側の要素に `data-slot="<部位>"` を付ければ従う
- 寸法変数: ボトムナビを隠している間、外枠の `--app-bottom-nav-height` は 0px
- 部位の一覧と CSS の規則の一致・読み手の行の選び方は `src/app/_layout/frame` のテスト(`pnpm test src/app/_layout/frame/`)、一覧と要素の data-slot の照合と表の結線は `UserFrame.test.tsx`(`pnpm test 'src/app/(user)/_layout/'`)
- フッターの基本の表示は枠の設定 `footer.visibility` の固定の class のまま

### data-slot の一覧

利用者の枠の部位と Main に付ける `data-slot`(部位の一覧 `src/app/_layout/frame/parts.mjs` の利用者の枠の 15 個と Main の 3 個)と、この枠の部品が描く見出しの印 `user-page-title`(一覧の見出しのうち source がこのフォルダのもの)。
fork の CSS はこの名前で狙う(`[data-slot="header-shell"]` など)。
枠の部品と Main は見た目のための id・`data-component` を持たない(狙う先は data-slot だけ。残る id は下の一覧の注記)。
ほかの見出しの印(`page-title`・`sec-title` など)は TextBlocks の部品が付ける(`src/components/TextBlocks/README.md`)。
一覧と要素の照合 = `UserFrame.test.tsx`(片方にしか無い名前・Primitives の部品の data-slot との衝突は失敗)

- `app-container` — UserLayout の外枠(枠の根 `data-frame-root`)
- `app-banner` — Banner の `#app-banner`
- `header` — Header の `<header>`
- `header-shell` — HeaderShell の行の箱
- `header-left` — HeaderShell の左(ブランド)
- `header-center` — HeaderShell の中央(PC のナビ)
- `header-right` — HeaderShell の右(CTA・SP の開閉ボタン)
- `header-brand` — Brand のロゴのリンク
- `header-brand-logo` — Brand の画像
- `header-brand-text` — Brand の名前(ロゴ画像が無い時)
- `header-nav` — PcNavigation の `<nav>`、SpNavigation の開いたメニュー、SP の開閉ボタンの包み(SpNavSwitch。ボタンは Primitives/Button で自分の `data-slot="button"` を持つので、`display: contents` の包みが名前を持つ)
- `header-sp-nav-panel` — SpNavPanel のパネル
- `footer` — Footer の `<footer>`
- `bottom-nav` — BottomNav の `<nav>` とスペーサー(BottomNavSpacer。同じ部位なので同じ名前。fork の CSS で本体だけを狙うときは `nav[data-slot="bottom-nav"]`)
- `bottom-nav-item` — BottomNavItem の項目(リンクもメニューも)。メニューの項目は Button に型つきの `slot` で渡す。`id="bottom-nav-item-<key>"` も残る(項目ごとに狙うとき)
- `main` — Main(`src/components/Layout/Main.tsx`、両方の枠)の `<main>`
- `main-layout` — Main の内側の段(`plain`・`fullscreen` 以外)
- `main-container` — Main の外側の段(`plain`・`fullscreen` 以外)
- `user-page-title` — UserPageTitle(`PageTitle.tsx`)の外側の `<header>`(中の h1 は `page-title`)。`srOnly` の時は外側を描かないので付かない(h1 の `page-title` は残る)。消す・名前を変えるのは notice

## Verification

- `pnpm test 'src/app/(user)/_layout/'`(slot と props なしの描画・部品の slot・UserPage の幅の既定・data-slot の一覧と要素の照合 `UserFrame.test.tsx`)
- `pnpm test src/app/_layout/frame/`(部位の一覧と CSS の規則の一致・読み手の行の選び方)
- `pnpm test src/lib/screens/screens.test.mjs`(1 行スイッチ・孤立した `.replace`)
