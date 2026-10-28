# (user)/_layout — ユーザー側の枠の部品

`src/app/(user)/layout.tsx` が描くユーザーアプリの枠(ヘッダー・フッター・ボトムナビ・背景)と、Screen が使うページ枠部品(UserPage・PageTitle)を置く場所。import は別名なしの `@/app/(user)/_layout/<X>`。

## ディレクトリ構成

```
src/app/(user)/_layout/
├── UserLayout.tsx       # 枠全体の既定の組み立て(export UserLayout = slot 付き、互換の UserAppLayout)。(user)/layout.tsx の 1 行スイッチ先
├── UserLayout.test.tsx  # slot と「props なしの描画が 1 行スイッチ化の前と同じ」の検査(pnpm test:user-layout)
├── UserParts.test.tsx   # 部品の slot / props と「props なしの描画が部品 slot 化の前と同じ」の検査(同上)
├── UserPageDefault.test.tsx # UserPage の幅の既定が config に従うことの検査(同上)
├── BackgroundLayer.tsx  # 背景画像・オーバーレイ
├── Banner.tsx           # banner slot の殻(ヘッダーより上の固定の帯。自分の高さを測って UserLayout に返す)
├── UserPage.tsx         # ページコンテナ(fill / immersive モード、幅の既定は config)。Screen が使う
├── PageTitle.tsx        # ページの h1(export UserPageTitle)。Screen が使う
├── Header/              # ヘッダーナビゲーション(既定。export UserNavigation、slot = leading / actions / menuActions)
│   ├── index.tsx / Brand.tsx / HeaderShell.tsx / MenuItemLabel.tsx / MenuItemLink.tsx / animations.ts / types.ts
│   ├── Pc/              # PcNavigation・PcMenuItem
│   └── Sp/              # SpNavigation・SpNavPanel・SpNavOverlay・SpNavSwitch・SpMenuItem
├── Footer/index.tsx     # フッター(既定。export UserFooter)
├── BottomNav/           # スマホ用ボトムナビ(index・BottomNavItem・BottomNavMenu・BottomNavSpacer・types・useBottomNavItems)
└── hooks/               # useHeaderData・useFooterData(ヘッダー・フッターの表示データと状態)
```

まだ `src/components/AppFrames/User/` に残っている物(後の区切りで扱う):

- `controls/`(HideHeader 等と部位一覧 frameParts.ts): 中身は印に入れ替え済み(下の「枠の部位を隠す(Hide* と印)」)。最終の棚は後の議題で決める(今はパスを変えない = fork の import の書き換えなし)
- `contexts/`(表示制御の context): `@deprecated`。Hide* は書かず、枠の部品・hook も読まない(UserLayout が互換の Provider を置くだけ)。旧入口撤去の区切りで削除する。ここの部品は絶対パス `@/components/AppFrames/User/{contexts,controls}` で参照している
- `Sections/HeaderCustom/`・`Sections/FooterCustom/`: config の切り替えで使う旧来のカスタム雛形(廃止予定)。差し替えは UserLayout の header / footer slot へ(下の「layout.tsx と slot」)。旧入口撤去の区切りで削除する
- `src/components/AppFrames/constants.ts`(ヘッダー・フッターの要素 ID): useHeaderHeight の汎用化と一緒に後で動かす

説明は [src/components/AppFrames/User/README.md](../../../components/AppFrames/User/README.md)。

## 所有

- このフォルダの既定の部品 = 提供者(upstream)の所有。fork は直接編集しない(core と同じ扱い。CLAUDE.md CORE_FILES)
- fork のカスタムはベースの隣にドット区切り名で置く(例 `UserLayout.custom.tsx`・`Header/index.<project>.tsx`)。ドット区切り名のファイル = 採用者(fork)の所有。名前は各プロジェクトで決める(多段の fork で衝突しない名前を推奨)
- upstream はここ(と `_screen/`)にドット区切り名のファイルを作らない。`pnpm test:screens` が Tier1 でだけ検査する(fork では skip)
- lint: 既定の部品は `src/components/**` と同じ upstream 所有 UI の強さ(style-tokens/no-raw-palette・style-tokens/span-in-heading・client-service-boundary/no-direct-import が error)。ドット区切り名のカスタムは app/ の画面と同じ warn。page-authz(layout はサーバー側でデータを取らない)は両方に error

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
| `--app-bottom-nav-height` | `BOTTOM_NAV_HEIGHT`(`src/config/ui/user-bottom-menu.config.ts`)。既定のボトムナビを描き `BOTTOM_NAV_ENABLED` の時と、bottomNav に要素を渡した時。`bottomNav={null}` と無効の時は書かない(0px)。出さないデバイス(`BOTTOM_NAV_VISIBILITY`、既定 PC)と `HideBottomNav` で隠している間は 0px(印の CSS が `!important` で上書き) | UserLayout の外枠の inline / 0 は `src/styles/frame-controls.generated.css` |
| `--app-safe-area-top/right/bottom/left` | `env(safe-area-inset-*, 0px)` | `src/styles/config.css` の `:root` |

- 既定値(0px と safe-area)は `src/styles/config.css` の `:root`。Admin は header だけを書き、ほかは :root の既定を継ぐ
- 外枠の配下(ページ・その中の fixed 要素)は px を直書きせずこれらを使う(例 `bottom-[calc(var(--app-bottom-nav-height)+8px)]`。規則: .claude/rules/core/style.md frame_dims)。ボトムナビを隠したページや PC では自動で 0 になる。`--app-*-height` は inline が勝つので `src/styles/custom/` からは上書きできない
- `--app-header-height` は実測なので、HideHeader で隠すと(display: none で高さ 0)自動で 0 に追随する。`--app-banner-height` は印の対象外
- BottomNavSpacer は `--app-bottom-nav-height` を読む 1 要素。BottomNav の高さ(`style` の height)と BottomNav・UserPage の safe-area(`env()` の直書き)は今の値のまま(値は同じ)
- 既定の DOM の差分(test で固定): Header の class `top-0` → `top-[var(--app-banner-height,0px)]`、外枠の style に `--app-bottom-nav-height:64px`。どちらも banner が無い時の計算値・見た目は同じ
- header / footer の決め方は「slot → config の旧切替の経路 → 既定」の順。config が既定部品を re-export しているので、HeaderCustom / FooterCustom に切り替えた fork もそのまま動く。config の部品 re-export は廃止予定(@deprecated のコメント)で、旧入口撤去の区切りで UserLayout は既定部品を直接 import する
- `UserAppLayout`(旧 export 名・旧 props backgroundImageUrl / overlayColor / overlayOpacity)は互換部品。旧 props を background slot に写して UserLayout を描く。旧入口撤去の区切りで削除する

### fork の差し替え手順

1. 値で済むもの(背景の 3 値、ヘッダー・フッター・ボトムナビの表示設定やメニュー)は `src/config/ui/*.config.ts` の値を変える
2. 部品を替えるときは、隣にドット区切り名のカスタムを置いて既定の UserLayout に slot を渡し、layout.tsx をそちらへ向ける

```tsx
// src/app/(user)/_layout/UserLayout.acme.tsx(fork 所有。名前はプロジェクトで決める)
import type { ReactNode } from "react";

import { UserLayout } from "./UserLayout";
import { AcmeHeader } from "./Header/index.acme";

export function AcmeUserLayout({ children }: { children: ReactNode }) {
  return <UserLayout header={<AcmeHeader />}>{children}</UserLayout>;
}
```

```tsx
// src/app/(user)/layout.tsx
export { AcmeUserLayout as default } from "./_layout/UserLayout.acme";
```

3. 枠の構造そのもの(部品の並びや外枠)を変えるときだけ、UserLayout.tsx をドット区切り名のファイルへコピーして編集する(外枠の `data-frame-root` は残す。無いと Hide* が効かない)
- カスタムの組み立てでガード関数(authGuard 等)を呼ぶと、ルート地図はスイッチ先を 1 段辿って拾う(`pnpm routes:map`、src/lib/screens/README.md §13)。組み立てがさらに import する先は読まない

## 枠の部位を隠す(Hide* と印)

ページ(または部品)が `HideHeader` / `HideHeaderNav` / `HideFooter` / `HideBottomNav`(`@/components/AppFrames/User/controls`)を描いている間だけ、その部位を隠す。

```tsx
<HideBottomNav />        {/* SP・PC とも隠す */}
<HideFooter sp />        {/* スマホだけ隠す */}
<HideHeaderNav pc />     {/* PC だけヘッダーのナビを隠す(ヘッダーは残る) */}
```

- 仕組み: Hide* は空の印 `<span hidden data-frame-hide="<部位>-<デバイス>">` を描くだけ。`src/styles/frame-controls.generated.css` の規則が「外枠 `[data-frame-root]`(UserLayout の `#user-app-container`)が印を含む間、その部位を `display: none`」にする(`:has()`)。部品はアンマウントしない
- 元は 1 つ: 部位・狙う先・デバイスの境界は `controls/frameParts.ts`。CSS はそこから `pnpm frame:generate` で作ってコミットする(`--check` と `pnpm test:frame-controls` が一致を確かめる)
- client JS なし: SSR の HTML だけで効く(hydration 前に枠が一瞬見えることは無い)。server の Screen・layout からも、client 部品の中からも同じに描ける
- 隠す方向だけ・足し算: 印が 1 つでもあれば隠す。`sp={false}` / `pc={false}` は「そのデバイスでは隠さない」= 何もしない(PC に出す指定ではない)
- 効かない置き方: 外枠の外(portal で body 直下へ出す等)。Suspense の内側(`(user)/loading.tsx` の下は全部)の印は本文が届くまで効かない = loading の間は枠が出て、本文と同時に隠れる
- 遷移の退出アニメ中(PageTransition、最大 0.3 秒)は旧・新ページの印が両方効く(和)
- 狙う先: 既定部品の id(`header`・`header-pc-nav`・`header-sp-menu-toggle`・`header-sp-nav`・`footer`・`bottom-nav`・`bottom-nav-spacer`)と `[data-frame-part~="<部位>"]`(部位 = `header` / `header-nav` / `footer` / `bottom-nav`)。差し替えた部品は id を残すか、外側の要素に `data-frame-part="<部位>"` を付ければ従う
- 寸法変数: ボトムナビを隠す印がある間、外枠の `--app-bottom-nav-height` は 0px(部位一覧の zeroVars)
- 基本の表示との関係: フッター・ヘッダーのナビは config の値(`FOOTER_VISIBILITY`・`HEADER_NAV_ENABLED`)の固定の class、ボトムナビは UserLayout が `BOTTOM_NAV_VISIBILITY` で出さないデバイスの印を自分で描く(高さ変数も同じ印で 0 になるため。差し替えたボトムナビも従う)

---

## 設定ファイル

各セクションの設定は `src/config/ui/` にあります。

| ファイル | 説明 |
|----------|------|
| `user-layout.config.ts` | 枠全体の値(背景画像・オーバーレイの色と透明度) |
| `user-header.config.ts` | ヘッダーの設定(コンポーネント切り替えは廃止予定 → header slot) |
| `user-footer.config.ts` | フッターの設定(コンポーネント切り替えは廃止予定 → footer slot) |
| `user-bottom-menu.config.ts` | ボトムナビの設定(表示するデバイス `BOTTOM_NAV_VISIBILITY` を含む) |

---

## hooks - 共通フック

カスタムヘッダー・フッター作成時に使用するフックを提供します。

### useHeaderData

ヘッダーに必要なデータ・状態を全て提供します。

```tsx
import { useHeaderData } from "@/app/(user)/_layout/hooks";

const {
  enabled,          // ヘッダー機能が有効か
  navItems,         // メニュー項目（認証状態反映済み）
  navEnabled,       // ナビメニューの有効設定（SP/PC）
  visibility,       // @deprecated 常に SP/PC とも true(隠すのは Hide* の印の CSS)
  navVisibility,    // @deprecated 常に SP/PC とも true(ナビの可否は navEnabled)
  logoLink,         // ロゴのリンク先
  isMenuOpen,       // メニューの開閉状態
  openMenu,         // メニューを開く
  closeMenu,        // メニューを閉じる
  toggleMenu,       // メニューの開閉をトグル
  headerRef,        // ヘッダー要素のref（高さ計算用）
  headerOffset,     // ヘッダーの高さ（px）
  visibilityClass,  // @deprecated 常に ""(隠すのは Hide* の印の CSS)
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
  visibilityClass,  // FOOTER_VISIBILITY から作る表示クラス(ページ単位で隠すのは Hide* の印の CSS)
} = useFooterData();
```

---

## Header - ヘッダーナビゲーション

### 設定ファイル

**`src/config/ui/user-header.config.ts`**

```tsx
// コンポーネント切り替え(廃止予定。差し替えは UserLayout の header slot へ)
export { UserNavigation } from "@/components/AppFrames/User/Sections/Header";
// カスタム版を使う場合(旧来。旧入口撤去の区切りで削除)：
// export { UserNavigation } from "@/components/AppFrames/User/Sections/HeaderCustom";

// 表示設定
export const HEADER_ENABLED = true;
export const HEADER_NAV_ENABLED = { sp: true, pc: true };

// メニュー設定
export const AUTHENTICATED_MENU_ITEMS: HeaderMenuItem[] = [...];
export const GUEST_MENU_ITEMS: HeaderMenuItem[] = [...];
```

### 設定項目

| 項目 | 説明 |
|------|------|
| `HEADER_ENABLED` | `false`でヘッダー全体を非表示 |
| `HEADER_NAV_ENABLED` | SP/PC別にナビメニューの表示制御 |
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

fork はドット区切り名のカスタムで header slot に渡す(戻るボタン・通知ベル・設定リンク等を Header のファイルを編集せずに足せる):

```tsx
// src/app/(user)/_layout/UserLayout.acme.tsx
<UserLayout header={<UserNavigation leading={<BackButton />} actions={<NotificationBell />} menuActions={null} />}>
  {children}
</UserLayout>
```

slot を持つのは既定の UserNavigation だけ(廃止予定の HeaderCustom には無い)。slot で足りない構造の違いはドット区切り名のコピーで持つ。

---

## Footer - フッター

### 設定ファイル

**`src/config/ui/user-footer.config.ts`**

```tsx
// コンポーネント切り替え(廃止予定。差し替えは UserLayout の footer slot へ)
export { UserFooter } from "@/components/AppFrames/User/Sections/Footer";
// カスタム版を使う場合(旧来。旧入口撤去の区切りで削除)：
// export { UserFooter } from "@/components/AppFrames/User/Sections/FooterCustom";

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
// 基本設定
export const BOTTOM_NAV_ENABLED = true;
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
| `BOTTOM_NAV_ENABLED` | `false`でボトムナビ全体を無効化 |
| `BOTTOM_NAV_HEIGHT` | ナビの高さ（px） |
| `BOTTOM_NAV_VISIBILITY` | 表示するデバイス(既定 `{ sp: true, pc: false }`)。PC にも出すなら `pc: true`。差し替えたボトムナビにも効く |
| `AUTHENTICATED_MENU_ITEMS` | ログイン中ユーザー用メニュー |
| `GUEST_MENU_ITEMS` | 未ログインユーザー用メニュー |

### 項目の型(type: "link" | "menu")

項目の型(`BottomNavItem` = `BottomNavLinkItem | BottomNavMenuItem`、`BottomNavMenuAction`)は config(`user-bottom-menu.config.ts`)で定義し、`_layout/BottomNav/types.ts` は re-export と判別関数 `isBottomNavMenuItem` だけを持つ(config → app の依存を作らない。HeaderMenuItem と同じ向き)。

| type | 必須 | 描き方 |
|------|------|-------|
| 省略 / `"link"` | key・label・href・icon(任意: matchPaths・badge) | リンク。カレントは色が変わる |
| `"menu"` | key・label・icon・menu(`{ key, label, href, icon? }[]`)(任意: menuTitle・badge) | ボタン。タップで上向きのアクションメニュー(Overlays の ActionPopover)を開き、各アクションは遷移だけ。カレントにはならない |

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

- 高さは `var(--app-bottom-nav-height)`(1 要素 `#bottom-nav-spacer`)。出さないデバイスと `HideBottomNav` で隠している間は変数が 0 になり、要素も印の CSS で隠れる

---

## UserPage - ページコンテナ

`Main` の薄いラッパー。`containerType` / `padding` / `verticalAlign` 等の Main の props をそのまま受け付ける。

### 幅の既定と縦位置

- `containerType` を渡さないときの幅は `src/config/ui/user-layout.config.ts` の `USER_PAGE_CONTAINER_TYPE`(既定 `"contentShell"` = Main の既定と同じ)。値はアプリ全体で 1 つ(layout ごとの既定は持たない)。ページが `containerType` を渡せばそちらが勝つ。fill / immersive は従来どおり `plain`
- 縦位置は Main の `verticalAlign`: `"center"`(既定、余白があれば縦中央)/ `"start"`(上揃え、縦に長いページ向け)。`<UserPage verticalAlign="start">` で渡せる

### fill - ビューポート充填モード

ページ自体がスクロールしない「アプリ的」な画面（ゲーム、プレイヤー、エディタ、キオスク、楽器 UI 等）向け。
固定ヘッダー直下からフッター / ボトムナビスペーサー直上までの残り高さちょうどにスナップし、内部スクロールは子に委譲する。

```tsx
import { UserPage } from "@/app/(user)/_layout/UserPage";

export default function PlayerPage() {
  return (
    <UserPage fill>
      <Toolbar />                                   {/* 固有高さ */}
      <Block className="flex-1 min-h-0 overflow-y-auto">
        <Playlist />                                {/* ここだけスクロール */}
      </Block>
      <Keyboard />                                  {/* 固有高さ、常に見える */}
    </UserPage>
  );
}
```

| 項目 | 内容 |
|------|------|
| 高さの契約 | 子は `flex-1 min-h-0` だけで残り高さを確保する。`calc(100dvh - ...)` やマジックナンバーは書かない |
| 余白 | 既定 `padding="none"`（端まで使う用途が主）。Main の padding props で上書き可 |
| ヘッダー | `--app-header-height`（実測値）で自動補正。`HideHeader` で隠せばその分 fill が広がる |
| フッター / ボトムナビ | フロー内に残るので fill と高さを分け合う。隠せば fill が広がる（スペーサーも自動で 0） |
| SSR | `--viewport-height` 設定前は `100dvh` にフォールバック |
| `fill` 未指定 | 従来と完全に同一の出力 |

仕組み: UserLayout の外枠 `[data-user-app-container]` は既定 `min-h` で中身ぶん伸びるが、配下に `data-user-fill` があると `src/styles/config.css` の `:has()` ルールで確定高さ + `overflow-clip` に切り替わる（AdminPage の fill と同じ手法）。

### immersive - 没入モード

`fill` + `HideHeader` + `HideFooter` + `HideBottomNav` を一発で有効化。ページ全体がビューポートちょうどになる。

```tsx
<UserPage immersive>
  <AppBar />                                       {/* 必要なら downstream が先頭の子として置く */}
  <Block className="flex-1 min-h-0"><Stage /></Block>
</UserPage>
```

- `safeArea` を付けると `env(safe-area-inset-*)` ぶんのパディングを付与（横向きスマホのノッチ対策）
- Hide* は印なので SSR の HTML だけで隠れる(初回描画でヘッダー等が見えることは無い)

### fullscreen との使い分け

| 欲しいもの | 使うもの |
|-----------|---------|
| フロー内に留まる非スクロールのページ土台（ヘッダー等と共存） | `<UserPage fill>` / `<UserPage immersive>` |
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
- 移行の間の形: header / footer は config の経路を通して描くので、config を HeaderCustom に切り替えている fork も見た目が変わらない。UserAppLayout も旧 props のまま動く。どちらも旧入口撤去の区切りで削除する
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

- 報告書 §2 の枠の制御 =「細部だけ違う → 1 行の印」(server で描く data-frame-* の空要素 + 外枠 1 か所の CSS `:has()`、client JS なし、どこからでも書ける、隠す方向のみ、足し算。CSS 規則と印の属性は 1 つの部位一覧から生成)
- 以前の Hide* は "use client" の部品で、useEffect で表示制御の context に書き、枠の部品が context を読んで class を付けていた。そのため hydration まで枠が一瞬見え、Hide* のあるページ同士の遷移では旧ページの後始末が新ページの指定を消す競合が起きた(呼び出し元ごとの上書き setOverride で直した。その notice の「setVisibility + reset を setOverride へ」は印で置き換わる)
- 印は DOM にある間だけ効き、旧ページの印は旧ページと一緒に消える = 後始末の処理そのものが無いので競合が起きない
- Hide* の名前・props・export・パスは変えていない(fork の呼び出しの書き換えなし)。表示方向(`pc={false}` = 表示)は使用例が無く捨てた
- 生成 CSS は global.css が config.css の後に読む。layer に入れない(部品の `sm:flex` 等のユーティリティより優先)。目印の変数 `--frame-controls-generated` を持つので、ビルド出力からこのファイルが抜けると `pnpm build` の styles:check-build が落ちる
- 既定の DOM の差分(test で固定): 外枠に `data-frame-root`、Header・Footer・BottomNav・スペーサー・ナビの部品に `data-frame-part`

## 寸法の 0 と context 離れの経緯(notice frame-marks-dims)

- 印の区切りの 2 手目。隠す印があるデバイスで `--app-bottom-nav-height` を 0 にする(生成 CSS、外枠の inline に勝つため `!important`)。BottomNavSpacer は sp/pc の px 2 本をやめ、変数を読む 1 要素にした
- PC の既定(ボトムナビを出さない)は、表示制御の context の既定値 `{ sp: true, pc: false }` にあった。context をやめたので config の `BOTTOM_NAV_VISIBILITY`(FOOTER_VISIBILITY と同じ形)へ移し、UserLayout がその値から「隠す印」を描く。表示も高さ変数も同じ規則に乗り、差し替えたボトムナビも従う。描く条件は高さ変数を書く条件(既定のボトムナビ有効、または bottomNav の差し替えあり)と同じ
- 表示方向(`HideBottomNav pc={false}` = PC にも出す)は印で表せないので捨て、PC にも出す受け皿をこの config の値にした
- 枠の部品と hook(BottomNav・BottomNavSpacer・Header・useHeaderData・useFooterData)は context を読まない。useHeaderData の `visibility` / `navVisibility` / `visibilityClass` は差し替え部品が読むので型を残し、固定値の `@deprecated` にした。useFooterData の `visibility` / `visibilityClass` は config の値だけから作る
- contexts と Provider は `@deprecated` の互換で残す(fork の部品が直接呼んでも落ちない)。削除は旧入口撤去の区切り
- 既定の DOM の差分(test で固定): 外枠の先頭に基本の印 `bottom-nav-pc`、スペーサーが 1 要素、Header の class 末尾の空白が無くなった

## 採らなかった案(寸法の 0)

- 生成 CSS が config の BOTTOM_NAV_VISIBILITY を読んで PC の 0 を書く: 生成 CSS は upstream のコミット物なので、fork が値を変えると生成物が upstream と食い違い、merge のたびに衝突する
- UserLayout が inline にデバイス別の変数を書く: inline ではメディアクエリが書けず、変数が 2 本に増える
- 変数を `--app-bottom-nav-height-base` に分けて CSS で合成する: 変数名が増える。`!important` は生成規則の変数だけに限る
- フッター・ヘッダーのナビの基本の表示も印に揃える: 寸法変数に関わらず、既定 DOM が変わるだけ(config の固定の class のまま)

## 採らなかった案(印)

- 表示制御の context に呼び出し元ごとの上書きを積む(今までの形): client JS が要り、hydration まで枠が見える。Hide* を client 部品の中にしか置けない
- config に「ルート → 隠す部位」の表を持つ: ページの事情がページから離れ、ルートを足すたびに config を編集する(fork の衝突点になる)
- proxy の `x-pathname` / `usePathname` で layout が判断する: layout が全ページの事情を知る形になり、client 遷移での追随も要る
- parallel routes(`@header` 等)で枠をページごとに差し替える: 隠すだけの用途には重く、ルートの構造が変わる
- UserLayout が `<style>` を描く(生成物なし): styles の README から見えず、別の枠に使い回せない
- 狙う先を `data-frame-part` だけにする: 差し替えた Header・Footer に属性を足す書き換えが要る(id を残していれば今のまま従う)

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
