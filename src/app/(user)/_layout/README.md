# (user)/_layout — ユーザー側の枠の部品

`src/app/(user)/layout.tsx` が描くユーザーアプリの枠(ヘッダー・フッター・ボトムナビ・背景)と、Screen が使うページ枠部品(UserPage・PageTitle)を置く場所。import は別名なしの `@/app/(user)/_layout/<X>`。

## ディレクトリ構成

```
src/app/(user)/_layout/
├── UserLayout.tsx       # 枠全体の既定の組み立て(export UserLayout = slot 付き、互換の UserAppLayout)。(user)/layout.tsx の 1 行スイッチ先
├── UserLayout.test.tsx  # slot と「props なしの描画が 1 行スイッチ化の前と同じ」の検査(pnpm test:user-layout)
├── BackgroundLayer.tsx  # 背景画像・オーバーレイ
├── UserPage.tsx         # ページコンテナ(fill / immersive モード)。Screen が使う
├── PageTitle.tsx        # ページの h1(export UserPageTitle)。Screen が使う
├── Header/              # ヘッダーナビゲーション(既定。export UserNavigation)
│   ├── index.tsx / Brand.tsx / HeaderShell.tsx / MenuItemLabel.tsx / MenuItemLink.tsx / animations.ts / types.ts
│   ├── Pc/              # PcNavigation・PcMenuItem
│   └── Sp/              # SpNavigation・SpNavPanel・SpNavOverlay・SpNavSwitch・SpMenuItem
├── Footer/index.tsx     # フッター(既定。export UserFooter)
├── BottomNav/           # スマホ用ボトムナビ(index・BottomNavItem・BottomNavSpacer・types・useBottomNavItems)
└── hooks/               # useHeaderData・useFooterData(ヘッダー・フッターの表示データと状態)
```

まだ `src/components/AppFrames/User/` に残っている物(後の区切りで扱う):

- `contexts/`(表示制御の context)・`controls/`(HideHeader 等): 枠の制御の区切りで中身を入れ替え、context は不要になった後に削除する。ここの部品は絶対パス `@/components/AppFrames/User/{contexts,controls}` で参照している
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
| `header` | config/ui/user-header.config の `UserNavigation`(upstream では既定 Header) | `#user-app-container` の先頭 |
| `footer` | config/ui/user-footer.config の `UserFooter`(upstream では既定 Footer) | `#stretch-wrapper` の後 |
| `bottomNav` | `BottomNavSpacer` + `UserBottomNav`(スペーサーごと差し替える) | フッターの後 |
| `notificationModal` | `UnreadNotificationModal` | 末尾 |

- slot の約束: 省略(undefined) = 既定の部品 / `null` = 描かない / 要素 = それを描く。props なしの描画(DOM・id・順序)は 1 行スイッチ化の前と同じ(test で固定)
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

3. 枠の構造そのもの(部品の並びや外枠)を変えるときだけ、UserLayout.tsx をドット区切り名のファイルへコピーして編集する
- カスタムの組み立てでガード関数(authGuard 等)を呼ぶと、ルート地図はスイッチ先を 1 段辿って拾う(`pnpm routes:map`、src/lib/screens/README.md §13)。組み立てがさらに import する先は読まない

---

## 設定ファイル

各セクションの設定は `src/config/ui/` にあります。

| ファイル | 説明 |
|----------|------|
| `user-layout.config.ts` | 枠全体の値(背景画像・オーバーレイの色と透明度) |
| `user-header.config.ts` | ヘッダーの設定(コンポーネント切り替えは廃止予定 → header slot) |
| `user-footer.config.ts` | フッターの設定(コンポーネント切り替えは廃止予定 → footer slot) |
| `user-bottom-menu.config.ts` | ボトムナビの設定 |

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
  visibility,       // ヘッダーの表示状態（SP/PC）
  navVisibility,    // ナビメニューの表示状態（SP/PC）
  logoLink,         // ロゴのリンク先
  isMenuOpen,       // メニューの開閉状態
  openMenu,         // メニューを開く
  closeMenu,        // メニューを閉じる
  toggleMenu,       // メニューの開閉をトグル
  headerRef,        // ヘッダー要素のref（高さ計算用）
  headerOffset,     // ヘッダーの高さ（px）
  visibilityClass,  // SP/PC両方の表示クラス
} = useHeaderData();
```

### useFooterData

フッターに必要なデータを全て提供します。

```tsx
import { useFooterData } from "@/app/(user)/_layout/hooks";

const {
  enabled,          // フッター機能が有効か
  visibility,       // フッターの表示状態（SP/PC）
  snsEnabled,       // SNSリンクが有効か
  socialLinks,      // SNSリンク一覧
  linksEnabled,     // フッターリンクが有効か
  footerLinks,      // フッターリンク一覧
  linkSeparator,    // フッターリンクのセパレーター
  copyrightEnabled, // コピーライトが有効か
  copyrightText,    // 生成済みコピーライトテキスト
  visibilityClass,  // SP/PC両方の表示クラス
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

// メニュー設定
export const AUTHENTICATED_MENU_ITEMS: BottomNavItem[] = [
  { key: "home", label: "ホーム", href: "/", icon: Home },
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
| `AUTHENTICATED_MENU_ITEMS` | ログイン中ユーザー用メニュー |
| `GUEST_MENU_ITEMS` | 未ログインユーザー用メニュー |

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

- BottomNavが**表示されている時だけ**高さを持つ
- `HideBottomNav`で非表示にした場合、スペーサーも自動で0になる
- SP/PCそれぞれの表示状態に連動

---

## UserPage - ページコンテナ

`Main` の薄いラッパー。`containerType` / `padding` 等の Main の props をそのまま受け付ける。

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
- Hide* は useEffect 駆動のため、初回描画の一瞬だけヘッダー等が見える（既存コントロールと同じ）

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
- `Header/index.tsx` が自分の Pc / Sp 部品を旧パスの絶対 import で読んでいるのは、移動の区切りで中身を変えないため(fork の差分が当たりやすい)。後の区切りで新パスへ直す

## 1 行スイッチと slot の経緯(notice frame-slots-user)

- 報告書 §2 の差し替え方式 =「1 行スイッチ + 部品 props」。枠を描く layout.tsx は採用者所有・write-once の 1 行スイッチになり、提供者の既定の組み立て(`_layout/UserLayout.tsx`)が部品を省略可能な props(slot)で受ける。fork はふつう既定を包む数行のカスタムを書き、構造ごと変えるときだけコピーする。受け口の優先順は 値(config)→ slot / props → コピー
- 以前は (user)/layout.tsx に背景の 3 値と UserAppLayout の呼び出しが直書きされ、fork はこの layout.tsx か config の部品切替(HeaderCustom / FooterCustom)を編集していた。upstream が枠を変えるたびにそれらが衝突した
- 背景の 3 値は layout.tsx が 1 行になるので `src/config/ui/user-layout.config.ts`(枠全体の値の受け皿として新設)へ移した
- 移行の間の形: header / footer は config の経路を通して描くので、config を HeaderCustom に切り替えている fork も見た目が変わらない。UserAppLayout も旧 props のまま動く。どちらも旧入口撤去の区切りで削除する
- ルート地図(src/lib/screens/routeMap.mjs)は layout.tsx の本文しか読んでいなかったので、スイッチ先の `_layout/` を 1 段辿るようにした(fork がカスタムの組み立てに書いたガードを地図から落とさないため)
- 部品そのものの slot(Header の actions / leading、BottomNav の項目の type)・banner・寸法の CSS 変数は後の区切りで入る

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
