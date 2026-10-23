# (user)/_layout — ユーザー側の枠の部品

`src/app/(user)/layout.tsx` が描くユーザーアプリの枠(ヘッダー・フッター・ボトムナビ・背景)と、Screen が使うページ枠部品(UserPage・PageTitle)を置く場所。import は別名なしの `@/app/(user)/_layout/<X>`。

## ディレクトリ構成

```
src/app/(user)/_layout/
├── UserLayout.tsx       # 枠全体の組み立て(export UserAppLayout。Header + Footer + BottomNav + 表示制御の Provider)
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
- `Sections/HeaderCustom/`・`Sections/FooterCustom/`: config の切り替えで使う旧来のカスタム雛形。後の区切りで header / footer の slot に置き換わり、旧入口撤去の区切りで削除する
- `src/components/AppFrames/constants.ts`(ヘッダー・フッターの要素 ID): useHeaderHeight の汎用化と一緒に後で動かす

説明は [src/components/AppFrames/User/README.md](../../../components/AppFrames/User/README.md)。

## 所有

- このフォルダの既定の部品 = 提供者(upstream)の所有。fork は直接編集しない(core と同じ扱い。CLAUDE.md CORE_FILES)
- fork のカスタムはベースの隣にドット区切り名で置く(例 `UserLayout.custom.tsx`・`Header/index.<project>.tsx`)。ドット区切り名のファイル = 採用者(fork)の所有。名前は各プロジェクトで決める(多段の fork で衝突しない名前を推奨)
- upstream はここ(と `_screen/`)にドット区切り名のファイルを作らない。`pnpm test:screens` が Tier1 でだけ検査する(fork では skip)
- lint: 既定の部品は `src/components/**` と同じ upstream 所有 UI の強さ(style-tokens/no-raw-palette・style-tokens/span-in-heading・client-service-boundary/no-direct-import が error)。ドット区切り名のカスタムは app/ の画面と同じ warn。page-authz(layout はサーバー側でデータを取らない)は両方に error

---

## 設定ファイル

各セクションの設定は `src/config/ui/` にあります。

| ファイル | 説明 |
|----------|------|
| `user-header.config.ts` | ヘッダーの設定・コンポーネント切り替え |
| `user-footer.config.ts` | フッターの設定・コンポーネント切り替え |
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
// コンポーネント切り替え
export { UserNavigation } from "@/components/AppFrames/User/Sections/Header";
// カスタム版を使う場合：
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
// コンポーネント切り替え
export { UserFooter } from "@/components/AppFrames/User/Sections/Footer";
// カスタム版を使う場合：
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
- 採用者所有のファイル(`src/app/(user)/layout.tsx`・`(protected)/mypage/layout.tsx`・`src/config/ui/user-*.config.ts`)は、この区切りでは旧パスのまま(shim 経由)。1 行スイッチ化の区切りで扱う
- `Header/index.tsx` が自分の Pc / Sp 部品を旧パスの絶対 import で読んでいるのは、移動の区切りで中身を変えないため(fork の差分が当たりやすい)。後の区切りで新パスへ直す

## 採らなかった案

報告書 OPTIONS_CONSIDERED の不採用案と、この置き場を選んだ根拠(報告書 RATIONALE)。

- AppFrames のまま残す: AppFrames を使う側で仕分けると「layout だけが使う物・グループ配下のページだけが使う物・features が使う物」に分かれ、一つの棚にまとめる理由が無かった。fork はヘッダー右の CTA を内部ファイルの直接編集で変え(3 fork)、通知ベルを別々に自作していた(2 fork)= 持ち主と差し替え口が見えない
- src/components の中に枠用の別の棚を作る: 置き場の名前が変わるだけで、使う layout から離れたままになる。部品を使う layout の隣に置けば、page.tsx ↔ `_screen/` と同じ対(layout.tsx ↔ `_layout/`)で持ち主と差し替え口がパスで分かる
- 組み立て物を 1 フォルダに集める: 報告書で不採用(比較は評議会の記録)
