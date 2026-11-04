# (user)/_layout — ユーザー側の枠の部品

`src/app/(user)/layout.tsx` が描くユーザーアプリの枠(ヘッダー・フッター・ボトムナビ・背景)と、Screen が使うページ枠部品(UserPage・PageTitle)を置く場所。import は別名なしの `@/app/(user)/_layout/<X>`。

## ディレクトリ構成

```
src/app/(user)/_layout/
├── UserLayout.tsx       # 枠全体の既定の組み立て(export UserLayout = slot 付き)。(user)/layout.tsx の 1 行スイッチ先
├── UserLayout.test.tsx  # slot と「props なしの描画が 1 行スイッチ化の前と同じ」の検査(pnpm test:user-layout)
├── UserParts.test.tsx   # 部品の slot / props と「props なしの描画が部品 slot 化の前と同じ」の検査(同上)
├── UserPageDefault.test.tsx # UserPage の幅の既定が config に従うことの検査(同上)
├── BackgroundLayer.tsx  # 背景画像・オーバーレイ
├── Banner.tsx           # banner slot の殻(ヘッダーより上の固定の帯。自分の高さを測って UserLayout に返す)
├── UserPage.tsx         # ページコンテナ(幅の既定は config、safeArea)。Screen が使う
├── PageTitle.tsx        # ページの h1(export UserPageTitle)。Screen が使う
├── Header/              # ヘッダーナビゲーション(既定。export UserNavigation、slot = leading / actions / menuActions)
│   ├── index.tsx / Brand.tsx / HeaderShell.tsx / MenuItemLabel.tsx / MenuItemLink.tsx / animations.ts / types.ts
│   ├── Pc/              # PcNavigation・PcMenuItem
│   └── Sp/              # SpNavigation・SpNavPanel・SpNavOverlay・SpNavSwitch・SpMenuItem
├── Footer/index.tsx     # フッター(既定。export UserFooter)
├── BottomNav/           # スマホ用ボトムナビ(index・BottomNavItem・BottomNavMenu・BottomNavSpacer・types・useBottomNavItems)
├── hooks/               # useHeaderData・useFooterData(ヘッダー・フッターの表示データと状態)
└── extensions/frameTable.ts # 枠の表(生成物。各ルートの frame.default.ts / frame.ts から pnpm extensions:generate)
```

まだ `src/components/AppFrames/User/` に残っている物(後の区切りで扱う):

- `src/components/AppFrames/constants.ts`(ヘッダー・フッターの要素 ID): useHeaderHeight の汎用化と一緒に後で動かす

説明は [src/components/AppFrames/User/README.md](../../../components/AppFrames/User/README.md)。

## 所有

- このフォルダの既定の部品 = 提供者(upstream)の所有。fork は直接編集しない(core と同じ扱い。CLAUDE.md CORE_FILES)
- fork の丸ごと置き換えはベースの隣に `<名前>.replace` で置く(例 `UserLayout.replace.tsx`・`Header/index.replace.tsx`)。fork が足したファイル = 採用者(fork)の所有(所有は git の分岐点で見る。名前に fork の印は付けない)。隣に置き換える既定の無い `.replace` は孤立で失敗(`pnpm test:screens`)
- upstream はここ(と `_screen/`)に点つきの名前のファイルを作らない(Tier1 でだけ検査、fork では skip)。点つきの名前で許すのは `.replace` と `.test` だけ(旧い fork の名前の印は全 Tier で失敗。移し方 = 共有の棚の印の移行の notice)
- lint: 既定の部品は `src/components/**` と同じ upstream 所有 UI の強さ(style-tokens/no-raw-palette・style-tokens/span-in-heading・client-service-boundary/no-direct-import が error)。丸ごと置き換え(`*.replace.tsx`)は app/ の画面と同じ warn。page-authz(layout はサーバー側でデータを取らない)は両方に error

---

## layout.tsx と slot(枠の差し替え)

- `src/app/(user)/layout.tsx` は 1 行スイッチ: `export { UserLayout as default } from "./_layout/UserLayout";`。page.tsx と同じく採用者(fork)所有・write-once で、upstream は作成後に編集しない。`pnpm test:screens` が page.tsx と同じ検査関数(`src/lib/screens/checks.mjs` の parseSwitchLayout)で全 Tier に対し検査する
- `(protected)/mypage/layout.tsx` も同じ形で `mypage/_layout/MyPageLayout.tsx`(UserPage narrowStack + Stack + PageTransition)を指す
- 既定の組み立て `UserLayout` の slot(すべて省略可能な props):

| slot | 既定(省略時) | 位置 |
|------|----------------|------|
| `background` | `BackgroundLayer`(値は `src/config/ui/user-layout.config.ts`) | 最背面(枠の外側の兄弟) |
| `banner` | なし(省略と `null` は同じ) | `#user-app-container` の先頭、header の前。`#app-banner`(fixed・top-0)の中に描く |
| `header` | config/ui/user-header.config の `UserNavigation`(upstream では既定 Header) | `#user-app-container` の先頭 |
| `footer` | config/ui/user-footer.config の `UserFooter`(upstream では既定 Footer) | `#stretch-wrapper` の後 |
| `bottomNav` | `BottomNavSpacer` + `UserBottomNav`(スペーサーごと差し替える) | フッターの後 |
| `notificationModal` | `UnreadNotificationModal` | 末尾 |

- slot の約束: 省略(undefined) = 既定の部品 / `null` = 描かない / 要素 = それを描く。props なしの描画(DOM・id・順序)は 1 行スイッチ化の前と同じ(test で固定。寸法変数の区切りで入った差分 2 か所は下の「寸法の CSS 変数」)
- banner を渡すと、帯の実測の高さを外枠の `--app-banner-height` に書き、ヘッダーの top と本文(`#stretch-wrapper` の前のスペーサー)をその分押し下げる。SP メニューもヘッダーの下から開く。差し替えたヘッダーは `top-0` の代わりに `top-[var(--app-banner-height,0px)]` を使う(使わないと帯に被る)

### 寸法の CSS 変数

| 変数 | 値 | 書く所 |
|------|----|--------|
| `--app-header-height` | ヘッダー(`#header`)の実測の高さ | UserLayout・AdminLayout の外枠の inline |
| `--app-banner-height` | banner の実測の高さ。banner が無い時は書かない(0px) | UserLayout の外枠の inline(banner がある時だけ) |
| `--app-bottom-nav-height` | `calc(BOTTOM_NAV_HEIGHT px + var(--app-safe-area-bottom))` = ボトムナビが実際に覆う高さ(`BOTTOM_NAV_HEIGHT` は `src/config/ui/user-bottom-menu.config.ts`。iOS では下の safe-area ぶん高い)。`bottomNav={null}` の時は書かない(0px)。ルートの枠の宣言(既定は PC で隠す)で隠している間は 0px(`!important` で上書き) | UserLayout の外枠の inline / 0 は `src/styles/_base/frame.css` |
| `--app-safe-area-top/right/bottom/left` | 端末の切り欠き(CSS の env() の safe-area-inset-*、無ければ 0px)。env() を直接書くのはこの定義だけ | `src/styles/_base/config.css` の `:root` |

- 既定値(0px と safe-area)は `src/styles/_base/config.css` の `:root`。Admin は header だけを書き、ほかは :root の既定を継ぐ
- 外枠の配下(ページ・その中の fixed 要素)は px を直書きせずこれらを使う(例 `bottom-[calc(var(--app-bottom-nav-height)+8px)]`。規則: .claude/rules/core/style.md frame_dims)。ボトムナビを隠したページや PC では自動で 0 になる。`--app-*-height` は inline が勝つので fork の CSS(`src/styles/` 直下)からは上書きできない
- `--app-header-height` は実測なので、枠の宣言でヘッダーを隠すと(display: none で高さ 0)自動で 0 に追随する。`--app-banner-height` は隠す対象外
- BottomNavSpacer は `--app-bottom-nav-height` を読む 1 要素。BottomNav 本体の高さ(`style` の height)も同じ計算(`calc(<px> + var(--app-safe-area-bottom))`、safe-area は padding-bottom で避ける)。変数が safe-area を含むので、使う側で safe-area を足さない
- body 直下へ portal する部品(GlobalToast・fork の BodyPortal の部品)は外枠の変数を継げない(:root の 0px になる) → `useFrameDimsStyle()`(`@/hooks/useFrameDimsStyle`)の style を portal した一番外の要素に付け、中は外枠の中と同じく `var(--app-bottom-nav-height)` などで書く。値は外枠 `[data-frame-root]` の計算値(header / banner / bottom-nav。隠している間・出さないデバイスでは 0)で、表示中の切り替えと画面幅の変化にも追随する。外枠を自分で読まない。GlobalToast もこれを使う
- 既定の DOM の差分(test で固定): Header の class `top-0` → `top-[var(--app-banner-height,0px)]`、外枠の style に `--app-bottom-nav-height:calc(64px + var(--app-safe-area-bottom))`(safe-area の無い端末では 64px と同じ)。banner が無い時の Header の計算値・見た目は同じ
- 端の避け方(viewport-fit=cover が既定、`src/config/seo.config.ts`): 枠の部品が `--app-safe-area-*` で端末の切り欠きを避ける。ヘッダー = 上(banner がある時は banner が上を避け、ヘッダーは `max(0, 上 − banner の高さ)`)と左右、banner = 上と左右、本文 `#stretch-wrapper`・フッター = 左右、ボトムナビ = 下と左右。切り欠きの無い画面では全部 0 で見た目は同じ。ページ側で同じ辺を足さない(UserPage の `safeArea` は枠の部位を隠したページ用)
- header / footer の決め方は「slot → 既定(`./Header` の UserNavigation・`./Footer` の UserFooter)」。config は値だけを持ち、部品を export しない

### fork の差し替え手順

1. 値で済むもの(背景の 3 値、ヘッダー・フッター・ボトムナビの表示設定やメニュー)は `src/config/ui/*.config.ts` の値を変える
2. 部品を替えるときは、隣に `UserLayout.replace.tsx` を置いて既定の UserLayout に slot を渡し、layout.tsx をそちらへ向ける

```tsx
// src/app/(user)/_layout/UserLayout.replace.tsx(fork 所有)
import type { ReactNode } from "react";

import { UserLayout } from "./UserLayout";
import { AcmeHeader } from "./Header/index.replace";

export function AcmeUserLayout({ children }: { children: ReactNode }) {
  return <UserLayout header={<AcmeHeader />}>{children}</UserLayout>;
}
```

```tsx
// src/app/(user)/layout.tsx
export { AcmeUserLayout as default } from "./_layout/UserLayout.replace";
```

3. 枠の構造そのもの(部品の並びや外枠)を変えるときだけ、UserLayout.tsx を `UserLayout.replace.tsx` へコピーして編集する(外枠の `data-frame-root` と `useFrameAttributes(frameTable)` の属性、部位の `data-slot` は残す。無いと枠の宣言が効かない)
- 組み立てでガードを書かない(範囲の守りは layout の隣の guard.ts の guard() だけ)。組み立て(スイッチ先)が旧ガード(authGuard 等)を呼ぶとルート地図の生成が失敗する(`pnpm routes:map`、src/lib/screens/README.md §13)

## 枠の部位を隠す・fill(枠の宣言)

ページや layout の隣の枠の宣言で「そのルートで枠のどの部位を隠すか・本文が画面の高さを埋めるか(fill)」を書く。ルートを作ったリポ(上流)は `frame.default.ts`(`export const frameDefault`)、その下のリポ(fork・中間 Tier)は上流のルートでも自分のルートでも `frame.ts`(`export const frame`、既定の上に重なる)。範囲はキーで名指す: `layout:` = 隣の layout.tsx の下全部、`page:` = 隣の page.tsx だけ。書式・重ね方・照合の順は [src/app/_layout/frame/README.md](../../_layout/frame/README.md)。

```ts
// src/app/(user)/maintenance/frame.default.ts(上流。fork が変えるときは隣に frame.ts の export const frame)
import type { FrameDeclaration } from "@/app/_layout/frame";

export const frameDefault = {
  page: { hide: { headerNav: { sp: true, pc: true }, footer: { sp: true, pc: true }, bottomNav: { sp: true, pc: true } } },
} satisfies FrameDeclaration;
```

- 隠せる部位: `header` / `headerNav`(ヘッダーは残る)/ `footer` / `bottomNav`(スペーサーごと)。端末 `sp` = 40rem 未満 / `pc` = 40rem 以上
- 枠の全体の既定 = `src/app/(user)/frame.default.ts` の `layout:`(上流: ボトムナビを PC で隠す = スマホだけ。同じファイルの `page:` はトップページ / の fill)。fork が変えるときは隣に `frame.ts`
- 仕組み: `pnpm extensions:generate` が宣言を解決して `extensions/frameTable.ts` を作り、UserLayout が共通の読み手 `useFrameAttributes(frameTable)`(`src/app/_layout/frame/useFrameAttributes.ts`、`matchFrame(useSelectedLayoutSegments(), frameTable)`)で今のルートの行を外枠 `#user-app-container` の属性 `data-frame-hide="<部位>-<sp|pc> …"` / `data-frame-fill` にする。`src/styles/_base/frame.css`(手書きの静的な規則、`:has()` なし)がその属性で部位を `display: none` にし、fill では外枠を確定高さ + `overflow: clip` にする。部品はアンマウントしない
- 効く時点: 属性は外枠そのものに付くので初回の HTML に入る(JavaScript なしでも効く)。client 遷移では loading.tsx の間から次のルートの宣言に切り替わる。戻る・進むも同じ
- 狙う先: 部位の印 `[data-slot="<部位>"]`(下の「data-slot の一覧」)と既定部品の id(`header`・`header-pc-nav`・`header-sp-menu-toggle`・`header-sp-nav`・`footer`・`bottom-nav`・`bottom-nav-spacer`。fork が読むので残す)。差し替えた部品は外側の要素に `data-slot="<部位>"` を付けるか id を残せば従う
- 寸法変数: ボトムナビを隠している間、外枠の `--app-bottom-nav-height` は 0px
- 部位の一覧と CSS の規則の一致・読み手の行の選び方は `src/app/_layout/frame` のテスト(`pnpm test:frame-declaration`)、一覧と要素の data-slot の照合と表の結線は `UserFrame.test.tsx`(`pnpm test:user-layout`)
- フッターの基本の表示は config の `FOOTER_VISIBILITY` の固定の class のまま

## data-slot の一覧

利用者の枠の部位と Main に付ける `data-slot`(余白の議会の一覧の利用者の枠 15 名と Main 3 名 = `src/app/_layout/frame/parts.mjs` の利用者の枠と Main)。fork の CSS はこの名前で狙う(`[data-slot="header-shell"]` など)。今の id と `data-component`(Main)、外枠の `data-user-app-container` は今どおり残す。見出しの名前(`user-page-title` など)はまだ付けない。一覧と要素の照合 = `UserFrame.test.tsx`(片方にしか無い名前・shadcn の data-slot との衝突は失敗)

- `app-container` — UserLayout の外枠 `#user-app-container`(枠の根 `data-frame-root`)
- `app-banner` — Banner の `#app-banner`
- `header` — Header の `<header id="header">`
- `header-shell` — HeaderShell の `#header-shell`
- `header-left` — HeaderShell の `#header-left`
- `header-center` — HeaderShell の `#header-center`
- `header-right` — HeaderShell の `#header-right`
- `header-brand` — Brand の `#header-brand`(ロゴのリンク)
- `header-brand-logo` — Brand の `#header-brand-logo`(画像)
- `header-brand-text` — Brand の `#header-brand-text`(ロゴ画像が無い時の名前)
- `header-nav` — PcNavigation の `#header-pc-nav` と SpNavigation の `#header-sp-nav`。SP の開閉ボタン `#header-sp-menu-toggle` は shadcn の Button(`data-slot="button"`)なので付けず、隠す CSS は id で狙う
- `header-sp-nav-panel` — SpNavPanel の `#header-sp-nav-panel`
- `footer` — Footer の `<footer id="footer">`
- `bottom-nav` — BottomNav の `<nav id="bottom-nav">`(スペーサー `#bottom-nav-spacer` は名前を持たず、隠す CSS は id で狙う)
- `bottom-nav-item` — BottomNavItem のリンクの項目 `#bottom-nav-item-<key>`。メニューの項目は shadcn の Button なので付けない
- `main` — Main(`src/components/Layout/Main.tsx`、両方の枠)の `<main id="main">`
- `main-layout` — Main の `#main-layout`(`data-component="Main:layout"`)
- `main-container` — Main の `#main-container`(`data-component="Main:container"`)

---

## 設定ファイル

各セクションの設定は `src/config/ui/` にあります。

| ファイル | 説明 |
|----------|------|
| `user-layout.config.ts` | 枠全体の値(背景画像・オーバーレイの色と透明度) |
| `user-header.config.ts` | ヘッダーの設定(コンポーネント切り替えは廃止予定 → header slot) |
| `user-footer.config.ts` | フッターの設定(コンポーネント切り替えは廃止予定 → footer slot) |
| `user-bottom-menu.config.ts` | ボトムナビの設定(高さ・メニュー。出し入れは枠の宣言) |

---

## hooks - 共通フック

カスタムヘッダー・フッター作成時に使用するフックを提供します。

### useHeaderData

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

### useFooterData

フッターに必要なデータを全て提供します。

```tsx
import { useFooterData } from "@/app/(user)/_layout/hooks";

const {
  enabled,          // フッター機能が有効か
  visibility,       // フッターの表示設定（SP/PC、config の FOOTER_VISIBILITY）
  snsEnabled,       // SNSリンクが有効か
  socialLinks,      // SNSリンク一覧
  linksEnabled,     // フッターリンクが有効か
  footerLinks,      // フッターリンク一覧
  linkSeparator,    // フッターリンクのセパレーター
  copyrightEnabled, // コピーライトが有効か
  copyrightText,    // 生成済みコピーライトテキスト
  visibilityClass,  // FOOTER_VISIBILITY から作る表示クラス(ページ単位で隠すのは枠の宣言)
} = useFooterData();
```

---

## Header - ヘッダーナビゲーション

### 設定ファイル

**`src/config/ui/user-header.config.ts`**

値だけを持つ(部品の差し替えは UserLayout の header slot、ヘッダー・ナビの出し入れは枠の宣言の `header` / `headerNav`)。

```tsx
// メニュー設定
export const AUTHENTICATED_MENU_ITEMS: HeaderMenuItem[] = [...];
export const GUEST_MENU_ITEMS: HeaderMenuItem[] = [...];
```

### 設定項目

| 項目 | 説明 |
|------|------|
| `HEADER_LOGO_LINK` | ロゴクリック時の遷移先 |
| `AUTHENTICATED_MENU_ITEMS` | ログイン中ユーザー用メニュー |
| `GUEST_MENU_ITEMS` | 未ログインユーザー用メニュー |
| `SHOW_LOGOUT_BUTTON` | ログアウトボタンの表示 |

### 部品の slot(UserNavigation の props)

既定ヘッダー `UserNavigation`(`@/app/(user)/_layout/Header`)は 3 つの props を受ける。約束は UserLayout の slot と同じ(省略 = 既定 / `null` = 描かない / 要素 = それを描く)。

| prop | 既定 | 描く位置 |
|------|------|---------|
| `leading` | なし | `#header-left` の先頭(ブランドの前)。例: 戻るボタン |
| `actions` | PC だけに出る「お問い合わせ」 | `#header-right`(SP メニューの開閉ボタンの前)。要素はそのまま描くので SP のヘッダーにも出る。PC だけにするなら要素側で `hidden sm:flex` 等 |
| `menuActions` | 幅いっぱいの「お問い合わせ」 | SP メニューのパネル下部(`#header-sp-nav-footer`)。`null` で下部の領域ごと描かない |

fork は `UserLayout.replace.tsx` で header slot に渡す(戻るボタン・通知ベル・設定リンク等を Header のファイルを編集せずに足せる):

```tsx
// src/app/(user)/_layout/UserLayout.replace.tsx
<UserLayout header={<UserNavigation leading={<BackButton />} actions={<NotificationBell />} menuActions={null} />}>
  {children}
</UserLayout>
```

slot で足りない構造の違いは `.replace` のコピーで持つ。

---

## Footer - フッター

### 設定ファイル

**`src/config/ui/user-footer.config.ts`**

値だけを持つ(部品の差し替えは UserLayout の footer slot)。

```tsx
// 表示設定
export const FOOTER_ENABLED = true;
export const FOOTER_VISIBILITY = { sp: true, pc: true };

// SNSリンク設定
export const SNS_ENABLED = true;
export const SOCIAL_LINKS: SocialLinkItem[] = [...];

// フッターリンク設定
export const FOOTER_LINKS_ENABLED = true;
export const FOOTER_LINKS: FooterLinkItem[] = [...];

// コピーライト設定
export const COPYRIGHT_ENABLED = true;
export const COPYRIGHT_YEAR = "2025";
export const COPYRIGHT_FORMAT = "simple";
```

### 設定項目

| 項目 | 説明 |
|------|------|
| `FOOTER_ENABLED` | `false`でフッター全体を非表示 |
| `FOOTER_VISIBILITY` | SP/PC別の表示制御 |
| `SNS_ENABLED` | SNSリンクの表示 |
| `SOCIAL_LINKS` | SNSリンク一覧（react-iconsを使用） |
| `FOOTER_LINKS_ENABLED` | フッターリンクの表示 |
| `FOOTER_LINKS` | リンク一覧（利用規約等） |
| `COPYRIGHT_FORMAT` | `simple` / `allRights` / `full` / `custom` |

---
## BottomNav - スマホ用ボトムナビゲーション

スマホ表示時に画面下部に固定表示されるナビゲーション。

### 特徴

- スマホのみ表示（デフォルト）
- 画面下部に固定（`fixed bottom-0`）
- カレントページは色が変わる
- Lucide-reactアイコンを使用

### 設定ファイル

**`src/config/ui/user-bottom-menu.config.ts`**

```tsx
// 基本設定(出し入れは枠の宣言の bottomNav。既定 = スマホだけ: src/app/(user)/frame.default.ts)
export const BOTTOM_NAV_HEIGHT = 64;

// メニュー設定(type 省略 = リンク項目)
export const AUTHENTICATED_MENU_ITEMS: BottomNavItem[] = [
  { key: "home", label: "ホーム", href: "/", icon: Home },
  { type: "menu", key: "create", label: "作成", icon: Plus, menu: [{ key: "post", label: "投稿", href: "/posts/new" }] },
  { key: "mypage", label: "マイページ", href: "/mypage", icon: User },
];

export const GUEST_MENU_ITEMS: BottomNavItem[] = [
  { key: "home", label: "ホーム", href: "/", icon: Home },
  { key: "login", label: "ログイン", href: "/login", icon: LogIn },
];
```

### 設定項目

| 項目 | 説明 |
|------|------|
| `BOTTOM_NAV_HEIGHT` | ナビの高さ（px） |
| `AUTHENTICATED_MENU_ITEMS` | ログイン中ユーザー用メニュー |
| `GUEST_MENU_ITEMS` | 未ログインユーザー用メニュー |

### 項目の型(type: "link" | "menu")

項目の型(`BottomNavItem` = `BottomNavLinkItem | BottomNavMenuItem`、`BottomNavMenuAction`)は config(`user-bottom-menu.config.ts`)で定義し、`_layout/BottomNav/types.ts` は re-export と判別関数 `isBottomNavMenuItem` だけを持つ(config → app の依存を作らない。HeaderMenuItem と同じ向き)。

| type | 必須 | 描き方 |
|------|------|-------|
| 省略 / `"link"` | key・label・href・icon(任意: matchPaths・badge) | リンク。カレントは色が変わる |
| `"menu"` | key・label・icon・menu(`{ key, label, href, icon? }[]`)(任意: menuTitle・badge) | ボタン。タップで上向きのアクションメニュー(Overlays の ActionPopover)を開き、各アクションは遷移だけ。カレントにはならない |

`BottomNavMenu`(メニュー項目から開くアクションメニュー)は単体でも使える。`side`(`"top"` 既定 / `"bottom"`)で開く向きを選ぶ(画面上の帯などから開くときは `"bottom"`)。

menu 型の項目を独自の型・判別で実装していた場合は、`type: "menu"` に置き換えて独自の型・判別を削除する。

### カレントページ判定

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

### スペーサー（BottomNavSpacer）

BottomNavは固定表示のため、フッターなど下部コンテンツが隠れないよう`BottomNavSpacer`が自動でスペースを確保します。

- 高さは `var(--app-bottom-nav-height)`(1 要素 `#bottom-nav-spacer`)。枠の宣言で隠している端末・ページでは変数が 0 になり、要素も `src/styles/_base/frame.css` で隠れる

---

## UserPage - ページコンテナ

`Main` の薄いラッパー。`containerType` / `padding` / `verticalAlign` 等の Main の props をそのまま受け付ける。

### 幅の既定と縦位置

- `containerType` を渡さないときの幅は `src/config/ui/user-layout.config.ts` の `USER_PAGE_CONTAINER_TYPE`(既定 `"contentShell"` = Main の既定と同じ)。値はアプリ全体で 1 つ(layout ごとの既定は持たない)。ページが `containerType` を渡せばそちらが勝つ(fill のページは `plain` を渡す)
- 縦位置は Main の `verticalAlign`: `"center"`(既定、余白があれば縦中央)/ `"start"`(上揃え、縦に長いページ向け)。`<UserPage verticalAlign="start">` で渡せる

### fill のページ(本文が画面の高さを埋める)

ページ自体がスクロールしない「アプリ的」な画面（ゲーム、プレイヤー、エディタ、キオスク、楽器 UI 等）向け。
固定ヘッダー直下からフッター / ボトムナビスペーサー直上までの残り高さちょうどにスナップし、内部スクロールは子に委譲する。
ページの隣の枠の宣言に `page: { fill: true }`(枠も隠すなら `hide`)を書き、本文は自分で `flex-1 min-h-0` を付ける。

```tsx
// 隣の frame.default.ts(fork は frame.ts の frame): export const frameDefault = { page: { fill: true } } satisfies FrameDeclaration;
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

- 仕組み: 外枠 `[data-user-app-container]` は既定 `min-h` で中身ぶん伸びるが、`data-frame-fill` が付くと `src/styles/_base/frame.css` の規則で確定高さ + `overflow-clip` に切り替わる
- 没入(ヘッダー・フッター・ボトムナビを全部隠す)は枠の宣言の `hide` に 3 つを書く。枠が全部要らないページは枠の外のルートグループに置く
- `safeArea` を付けると `var(--app-safe-area-*)` ぶんのパディングを付与（横向きスマホのノッチ対策）。枠の部位を隠したページ用(部位が出ている辺は枠が避けるので、出したまま付けると二重になる)

### fullscreen との使い分け

| 欲しいもの | 使うもの |
|-----------|---------|
| フロー内に留まる非スクロールのページ土台（ヘッダー等と共存） | 枠の宣言の `page: { fill: true }` + `UserPage`(上の「fill のページ」) |
| 画面全体を覆う一時的なオーバーレイ（スプラッシュ、背景演出） | `<Main containerType="fullscreen">`（FullScreen による fixed オーバーレイ、z 層指定、body スクロールロック） |
| UserLayout の外（独立ルート群）のビューポート固定ページ枠（卓上端末・サイネージ） | `<KioskFrame>`（[AppFrames/Kiosk/README.md](../../../components/AppFrames/Kiosk/README.md)） |

---

## 移動の経緯

- 以前は `src/components/AppFrames/User/` にあった。共有フォルダの置き場と所有を決めた評議会の報告書(20261019-213253-shared-folders-placement-ownership §2)で AppFrames の解体が決まり、レイアウトの部品とページ枠部品は「使う layout のそばの `_layout/`」へ移すことになった
- 理由: 枠の部品は特定の layout だけが描く物で、共有部品の棚(src/components)に置くと「誰の物か・どこで差し替えるか」が見えない。layout.tsx の隣に置けば、page.tsx ↔ `_screen/` と同じ形で layout.tsx ↔ `_layout/` が対になり、fork が差し替える場所も一つに決まる
- 移し方: 最初の区切り(notice frame-move-user)は移動だけ。中身は移動で壊れる相対 import の行だけを書き換え、旧パス 27 か所に `@deprecated 旧パス互換` の re-export shim を残した(`grep -rl "@deprecated 旧パス互換" src`)。fork が旧パスで編集していた差分は /flux が notice の `moved:` で新パスへ当て直す。中身の変更(1 行スイッチ・slot 化・config を値だけにする等)は後の区切りで、新パス上の普通の変更として入る
- shim と eslint `deprecated-imports/no-deprecated-path` の旧パス一覧は、区切り 2 を全 fork が取り込んだことを確かめた後の「旧入口撤去」の区切りで削除する(前例: ui-layers-rename → ui-layers-shim-removal)
- 採用者所有のファイル(`src/app/(user)/layout.tsx`・`(protected)/mypage/layout.tsx`・`src/config/ui/user-*.config.ts`)は、移動の区切りでは旧パスのまま(shim 経由)にし、次の区切り(notice frame-slots-user)で扱った
- `Header/index.tsx` が自分の Pc / Sp 部品を旧パスの絶対 import で読んでいたのは、移動の区切りで中身を変えないため(fork の差分が当たりやすい)。部品の slot の区切り(notice frame-parts-user)で相対 import に直した

## 1 行スイッチと slot の経緯(notice frame-slots-user)

- 報告書 §2 の差し替え方式 =「1 行スイッチ + 部品 props」。枠を描く layout.tsx は採用者所有・write-once の 1 行スイッチになり、提供者の既定の組み立て(`_layout/UserLayout.tsx`)が部品を省略可能な props(slot)で受ける。fork はふつう既定を包む数行のカスタムを書き、構造ごと変えるときだけコピーする。受け口の優先順は 値(config)→ slot / props → コピー
- 以前は (user)/layout.tsx に背景の 3 値と UserAppLayout の呼び出しが直書きされ、fork はこの layout.tsx か config の部品切替(HeaderCustom / FooterCustom)を編集していた。upstream が枠を変えるたびにそれらが衝突した
- 背景の 3 値は layout.tsx が 1 行になるので `src/config/ui/user-layout.config.ts`(枠全体の値の受け皿として新設)へ移した
- 移行の間の形: header / footer は config の経路を通して描くので、config を HeaderCustom に切り替えている fork も見た目が変わらない。UserAppLayout も旧 props のまま動く。どちらも旧入口撤去の区切り(notice old-entry-removal)で削除した
- ルート地図(src/lib/screens/routeMap.mjs)は layout.tsx の本文しか読んでいなかったので、スイッチ先の `_layout/` を 1 段辿るようにした(fork がカスタムの組み立てに書いたガードを地図から落とさないため)
- 部品そのものの slot は次の区切り(notice frame-parts-user)、banner・寸法の CSS 変数はその後の区切り(notice frame-dims)で入った

## 部品の slot の経緯(notice frame-parts-user)

- fork は部品の中を編集していた: ヘッダー右の CTA の差し替え、戻るボタン・通知ベル・設定リンクの追加、menu 型のボトムナビ項目の自前実装、Main の縦揃えと UserPage の既定幅。どれも upstream の部品の変更と衝突した
- Header: `leading` / `actions` / `menuActions` を UserNavigation の props に。PC 右と SP メニュー下部を別々に上書き・片方だけ外せる
- BottomNav: 項目に判別キー `type`(省略 = link)。名前(menu・menuTitle・BottomNavMenuAction)は fork の既存の自前実装に揃え、fork の書き換えを項目に `type: "menu"` を足すだけにした。項目の型は config へ移した(config → app の依存を作らない)
- Main(core)に `verticalAlign`。名前と値は fork の既存の実装と同じ(fork の衝突は上流版を採るだけ)。center の class 文字列は従来と同じ並び
- UserPage の幅の既定は config の値 `USER_PAGE_CONTAINER_TYPE`
- props を渡さない既定の DOM は前と同じ(id・class を含む。`UserParts.test.tsx` に前の HTML を固定)

## banner と寸法変数の経緯(notice frame-dims)

- 報告書 §2(D1・D7)の slot 一覧の banner(ヘッダーより上の帯、押し下げ、既定なし、高さは寸法変数)と、寸法の CSS 変数 header / bottomNav / banner / safe-area
- fork はヘッダーより上の帯を root layout から fixed で出したり、ボトムナビを避ける位置を `bottom-[72px]` のような px で書いたりしていた。upstream がヘッダーやボトムナビの高さを変えると黙ってずれる
- 帯は fixed で出して自分の高さを測る(Banner.tsx)。測り方は useElementSize(ResizeObserver)。useHeaderHeight は要素が見つかるまで requestAnimationFrame を回し続けるので、banner の無い画面で回りっぱなしになるため使わない。Banner は banner がある時だけ描くので、測定もその時だけ
- 本文はスペーサー(`h-[var(--app-banner-height,0px)]`)で押し下げる。`#stretch-wrapper` の padding-top(ヘッダー分)の class を変えずに済み、fill の高さの連鎖にもそのまま乗る(BottomNavSpacer と同じ考え方)
- bottomNav の高さは TS の config の値なので、CSS の :root では持てない(写すと二重になり、fork が config を変えても追随しない)。外枠の inline に書く

## 印の経緯(notice frame-marks)

> 印(Hide*)・生成 CSS・`:has()` は後の区切りで枠の宣言(frame.default.ts / frame.ts)に置き換わった(下の「宣言の経緯」)。以下はその前の記録

- 報告書 §2 の枠の制御 =「細部だけ違う → 1 行の印」(server で描く data-frame-* の空要素 + 外枠 1 か所の CSS `:has()`、client JS なし、どこからでも書ける、隠す方向のみ、足し算。CSS 規則と印の属性は 1 つの部位一覧から生成)
- 以前の Hide* は "use client" の部品で、useEffect で表示制御の context に書き、枠の部品が context を読んで class を付けていた。そのため hydration まで枠が一瞬見え、Hide* のあるページ同士の遷移では旧ページの後始末が新ページの指定を消す競合が起きた(呼び出し元ごとの上書き setOverride で直した。その notice の「setVisibility + reset を setOverride へ」は印で置き換わる)
- 印は DOM にある間だけ効き、旧ページの印は旧ページと一緒に消える = 後始末の処理そのものが無いので競合が起きない
- Hide* の名前・props・export・パスは変えていない(fork の呼び出しの書き換えなし)。表示方向(`pc={false}` = 表示)は使用例が無く捨てた
- 生成 CSS は global.css が config.css の後に読む。layer に入れない(部品の `sm:flex` 等のユーティリティより優先)。目印の変数 `--frame-controls-generated` を持つので、ビルド出力からこのファイルが抜けると `pnpm build` の styles:check-build が落ちる
- 既定の DOM の差分(test で固定): 外枠に `data-frame-root`、Header・Footer・BottomNav・スペーサー・ナビの部品に `data-frame-part`(後の data-slot の区切りで `data-slot` に置き換わった)
- ブラウザでの確かめ(区切り 3 の確認): JS 有効では印の到着と本文の到着が同じフレームで、その後に枠が見えたフレームは 0。通信を遅くした client 遷移でも、loading の間は枠が出て本文と同時に隠れる。JS 無効では本文が Suspense の隠し領域(外枠の外)に残り、ページ側の印は効かない(外枠の基本の印は効く)

## 寸法の 0 と context 離れの経緯(notice frame-marks-dims)

- 印の区切りの 2 手目。隠す印があるデバイスで `--app-bottom-nav-height` を 0 にする(生成 CSS、外枠の inline に勝つため `!important`)。BottomNavSpacer は sp/pc の px 2 本をやめ、変数を読む 1 要素にした
- PC の既定(ボトムナビを出さない)は、表示制御の context の既定値 `{ sp: true, pc: false }` にあった。context をやめたので config の表示する端末の値(FOOTER_VISIBILITY と同じ形。今は枠の宣言に置き換わった)へ移し、UserLayout がその値から「隠す印」を描く。表示も高さ変数も同じ規則に乗り、差し替えたボトムナビも従う。描く条件は高さ変数を書く条件(既定のボトムナビ有効、または bottomNav の差し替えあり)と同じ
- 表示方向(ボトムナビの Hide* の `pc={false}` = PC にも出す)は印で表せないので捨て、PC にも出す受け皿をこの config の値にした
- 枠の部品と hook(BottomNav・BottomNavSpacer・Header・useHeaderData・useFooterData)は context を読まない。useHeaderData の `visibility` / `navVisibility` / `visibilityClass` は差し替え部品が読むので型を残し、固定値の `@deprecated` にした。useFooterData の `visibility` / `visibilityClass` は config の値だけから作る
- contexts と Provider は `@deprecated` の互換で残した(fork の部品が直接呼んでも落ちない)。旧入口撤去の区切り(notice old-entry-removal-contexts)で削除した
- 既定の DOM の差分(test で固定): 外枠の先頭に基本の印 `bottom-nav-pc`、スペーサーが 1 要素、Header の class 末尾の空白が無くなった

## 宣言の経緯(frame.default.ts / frame.ts)

- 共有の棚の評議会(計画書 02)で、ページから枠を変える手段をルートの隣の宣言 1 つにした(ルートを作ったリポは `frame.default.ts`、その下のリポは `frame.ts`、範囲はキー `layout:` / `page:` で名指す)。Hide*(子が描く印を親が `:has()` で読む)・CSS の生成スクリプト(package.json の script ごと)・UserPage の `fill` / `immersive`・枠の設定の重なる切り替え 4 つ(ボトムナビの有効と表示する端末、ヘッダーの有効、ヘッダーのナビの表示する端末)を消した
- 理由: 子が親を変える仕組みは、ページが外枠に何をしているかが外から読めない(どのページが何を隠すかは全ページを開かないと分からない)。宣言は生成した表 1 つに集まり、fork の宣言も隣の `frame.ts` で既定の上に部位ごとに重なる(隣に何があるかで意味を変えない)
- CSS は部位 4 × 端末 2 の静的な規則なので手書きにした(生成をやめた)。部位の一覧との一致はテストで見る
- 既定の DOM の差分: 外枠に `data-frame-hide`(上流の既定 `bottom-nav-pc`)と fill のページの `data-frame-fill`、先頭の基本の印 `<span hidden>` は無くなった。ヘッダー・ナビ・ボトムナビは設定で消さず常に描き、隠すのは CSS
- 試作(prototype/frame-declaration)で確かめたこと: 読み手 `useSelectedLayoutSegments` は rewrite 先のルートを返す、属性は初回の HTML に入る(cacheComponents なし)、loading の間と戻る・進むで正しく切り替わる

## 採らなかった案(寸法の 0)

- 生成 CSS が config の表示する端末の値を読んで PC の 0 を書く: 生成 CSS は upstream のコミット物なので、fork が値を変えると生成物が upstream と食い違い、merge のたびに衝突する
- UserLayout が inline にデバイス別の変数を書く: inline ではメディアクエリが書けず、変数が 2 本に増える
- 変数を `--app-bottom-nav-height-base` に分けて CSS で合成する: 変数名が増える。`!important` は生成規則の変数だけに限る
- フッター・ヘッダーのナビの基本の表示も印に揃える: 寸法変数に関わらず、既定 DOM が変わるだけ(config の固定の class のまま)

## 採らなかった案(印)

- 表示制御の context に呼び出し元ごとの上書きを積む(今までの形): client JS が要り、hydration まで枠が見える。Hide* を client 部品の中にしか置けない
- config に「ルート → 隠す部位」の表を持つ: ページの事情がページから離れ、ルートを足すたびに config を編集する(fork の衝突点になる)
- proxy の `x-pathname` / `usePathname` で layout が判断する: layout が全ページの事情を知る形になり、client 遷移での追随も要る
- parallel routes(`@header` 等)で枠をページごとに差し替える: 隠すだけの用途には重く、ルートの構造が変わる
- UserLayout が `<style>` を描く(生成物なし): styles の README から見えず、別の枠に使い回せない
- 狙う先を部位の印の属性だけにする: 差し替えた Header・Footer に属性を足す書き換えが要る(id を残していれば今のまま従う)

## 採らなかった案(banner と寸法変数)

- banner を flow に置くだけ: スクロールで帯が流れ、固定ヘッダーとの間に隙間ができる
- banner と header を一つの fixed の箱に入れる: header が fixed をやめることになり、既定の DOM が大きく変わる。差し替えたヘッダーも作り直しになる
- Header の class を変えず、config.css に `[data-user-app-container] #header { top: … }` を書く: core の CSS が部品の位置を裏から上書きする形になり、部品を読んでも気づけない
- `--app-bottom-nav-height` を :root に 64px で持つ: config の BOTTOM_NAV_HEIGHT と二重になる
- `#stretch-wrapper` の padding-top を header + banner の calc にする: 既定の class が変わる。スペーサーなら banner が無い時の DOM が変わらない
- AdminLayout にも同じ変数を inline で書く: Admin には banner も bottomNav も無く、:root の 0px と同じ値を書くだけ(既定の DOM が変わる)
- Admin の banner slot: 要る例が無い(報告書の banner は User の slot)
- BottomNav・UserPage を同時に変数へ寄せる: 既定の DOM が変わる。部品の非表示で 0 にする扱いと一緒に後の区切りで

## 採らなかった案(部品の slot)

- Header の actions を `{ pc, sp }` の 1 つの object で受ける: 平らな 2 つの props の方が「省略 = 既定 / null = なし」をそのまま書ける
- actions を PC 専用の入れ物で包む: 通知ベル等を SP のヘッダー右に出せなくなる
- UserPage の幅の既定を layout から context・CSS 変数・UserLayout の props で配る: UserPage は server component(Screen が server で描く)で useContext が使えない。CSS 変数は Main の inline の maxWidth を変える = 既定の DOM が変わる。UserLayout の props は Screen の子へ届かない。枠全体の値の受け皿(user-layout.config.ts)の 1 値にした
- BottomNavItem 型を `_layout` に置いたまま config が import する: config → app の依存になる
- menu の判別を `menu?: undefined` で行う: `type` キーなら省略時 link を型で表せ、判別が 1 か所に集まる
- Main の `overflow-clip` を `overflow-x-clip` に同時に変える: 既定の class が変わる。必要が示されたら別に扱う

## 採らなかった案(1 行スイッチと slot)

- layout.tsx に組み立ての JSX を書いたまま fork に編集させる / 部品ごとの切替 index を置く: 報告書で不採用。layout.tsx が upstream と fork の両方の編集対象になり、枠の変更のたびに衝突する
- config の部品切替(HeaderCustom / FooterCustom)を続ける: config は値だけに戻す(報告書 §2)。部品を config から export すると config → 部品の依存ができ、雛形のコピーが upstream の変更から取り残される
- slot をコンポーネント型(`header={AcmeHeader}`)で受ける: 要素(ReactNode)で受ければ props 付きの部品も null(描かない)もそのまま表せ、server で描いた要素も渡せる
- 既定 Header を UserLayout で直接 import し、config の値と比べて旧経路かを判定する: 同じ物を 2 経路で持つだけ。config を 1 回読めば「旧経路 → 既定」の順を満たす
- UserLayout を server の組み立て + client の殻に分ける: 中身の変更が大きく、この区切りの「props なしの描画が同じ」の確認範囲が広がる。今の UserAppLayout と同じ "use client" の境界のままにした
- bottomNav slot をボトムナビ本体だけにする: スペーサーは既定ボトムナビの表示状態と高さに結び付いており、独自のボトムナビには合わない。スペーサーごと差し替える

## 採らなかった案(置き場)

報告書 OPTIONS_CONSIDERED の不採用案と、この置き場を選んだ根拠(報告書 RATIONALE)。

- AppFrames のまま残す: AppFrames を使う側で仕分けると「layout だけが使う物・グループ配下のページだけが使う物・features が使う物」に分かれ、一つの棚にまとめる理由が無かった。fork はヘッダー右の CTA を内部ファイルの直接編集で変え(3 fork)、通知ベルを別々に自作していた(2 fork)= 持ち主と差し替え口が見えない
- src/components の中に枠用の別の棚を作る: 置き場の名前が変わるだけで、使う layout から離れたままになる。部品を使う layout の隣に置けば、page.tsx ↔ `_screen/` と同じ対(layout.tsx ↔ `_layout/`)で持ち主と差し替え口がパスで分かる
- 組み立て物を 1 フォルダに集める: 報告書で不採用(比較は評議会の記録)

## 旧入口撤去の経緯(notice old-entry-removal)

- 区切り 1・2 で枠の部品を `src/components/AppFrames/` から `_layout/` へ移したとき、旧パスの shim・config の部品 re-export と旧経路・旧名の互換(UserAppLayout・AdminOuterLayout)・旧来の雛形(HeaderCustom / FooterCustom)を 1 checkpoint 残した。全 fork が区切り 2 を取り込んだのを確かめて、それらを削除した(撤去は tsc で止まる)
- UserLayout の header / footer の既定は config の re-export を通さず `./Header`・`./Footer` を直接描く。全 fork の config が既定部品を re-export していたので、見た目は変わらない
- 雛形を自分の版にしていた fork は、それを fork の場所(`src/app/(user)/_components/<Name>/`)へ移し、header / footer slot から渡す(notice の required_actions)
- 表示制御の context(contexts 5 ファイル、setOverride / clearOverride を含む)・UserLayout の Provider 4 段・useHeaderData の `visibility` / `navVisibility` / `visibilityClass`(固定値の @deprecated)は、次の区切り(notice old-entry-removal-contexts)で削除した。区切り 3 の取り込みを全 fork で待たなかったのは、/flux が区切りごとに止まり、未取り込みの fork も区切り 3(context を読まない形)を先に通るため。数え直した直接使用は 0 件で、残る 1 件(fork の版のヘッダーの雛形が古い戻り値を読む)は tsc が止め、notice の手順で直す
- useFooterData の `visibility` / `visibilityClass` は残る(FOOTER_VISIBILITY から作る現役の値で、既定の Footer が読む)
