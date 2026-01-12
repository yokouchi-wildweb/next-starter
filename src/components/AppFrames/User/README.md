# User AppFrames

ユーザーアプリ側のレイアウトフレームを構成するコンポーネント群。

## ディレクトリ構成

```
User/
├── Layout/          # レイアウトコンポーネント
│   ├── UserLayout.tsx   # アプリ全体のレイアウト（Header + Footer + BottomNav + Provider）
│   └── UserPage.tsx     # ページコンテナ
├── Sections/        # セクション
│   ├── Header/          # ヘッダーナビゲーション
│   ├── HeaderCustom/    # カスタムヘッダー（プロジェクト固有）
│   ├── Footer/          # フッター
│   ├── FooterCustom/    # カスタムフッター（プロジェクト固有）
│   └── BottomNav/       # ボトムナビゲーション（スマホ固定）
│       ├── index.tsx            # BottomNav本体
│       ├── BottomNavItem.tsx    # 個別アイテムコンポーネント
│       ├── BottomNavSpacer.tsx  # スペーサー（表示時のみ高さを確保）
│       └── types.ts             # 型定義
├── Elements/        # 共通UI要素
│   └── PageTitle.tsx    # ページタイトル
├── hooks/           # 共通フック（カスタムコンポーネント用）
│   ├── index.ts             # re-export
│   ├── useHeaderData.ts     # ヘッダー用データ・状態
│   └── useFooterData.ts     # フッター用データ
├── contexts/        # 状態管理Context
│   ├── HeaderVisibilityContext.tsx
│   ├── HeaderNavVisibilityContext.tsx
│   ├── FooterVisibilityContext.tsx
│   └── BottomNavVisibilityContext.tsx
└── controls/        # ページ単位のレイアウト制御コンポーネント
    ├── HeaderControl.tsx
    ├── FooterControl.tsx
    ├── BottomNavControl.tsx
    └── index.ts
```

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
import { useHeaderData } from "@/components/AppFrames/User/hooks";

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
import { useFooterData } from "@/components/AppFrames/User/hooks";

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

## カスタムコンポーネント

プロジェクト固有のデザインにカスタマイズしたい場合、`HeaderCustom/` または `FooterCustom/` のスケルトンテンプレートを編集し、設定ファイルで切り替えます。

### スケルトンテンプレート

`HeaderCustom/index.tsx` と `FooterCustom/index.tsx` には、共通フックを使用したスケルトンテンプレートが用意されています。デザインのみをカスタマイズすれば、設定ファイルとの連携やロジックは自動的に機能します。

### 手順

1. `Sections/HeaderCustom/index.tsx` を編集してデザインをカスタマイズ
2. `src/config/ui/user-header.config.ts` のexportを切り替え

```tsx
// Before
export { UserNavigation } from "@/components/AppFrames/User/Sections/Header";

// After
export { UserNavigation } from "@/components/AppFrames/User/Sections/HeaderCustom";
```

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

## controls - レイアウト制御コンポーネント

ページ単位でヘッダー・フッターの表示/非表示を制御できる。
スマホ（sp）とPC（pc）で個別に指定可能。

### インポート

```tsx
import { HideHeader, HideFooter, HideBottomNav } from "@/components/AppFrames/User/controls";
```

### HideHeader / HideFooter

```tsx
// 両方非表示
<HideHeader sp pc />

// スマホのみ非表示
<HideHeader sp />

// PCのみ非表示
<HideHeader pc />
```

### HideBottomNav

ボトムナビゲーションを非表示にする。
**デフォルト**: スマホのみ表示（PCは非表示）

```tsx
// 両方非表示（props未指定で両方非表示）
<HideBottomNav />

// スマホのみ非表示
<HideBottomNav sp />
```

### 使用例

```tsx
// src/app/(user)/onboarding/page.tsx
import { HideHeader, HideFooter } from "@/components/AppFrames/User/controls";

export default function OnboardingPage() {
  return (
    <>
      <HideHeader />
      <HideFooter />
      <div>オンボーディングコンテンツ...</div>
    </>
  );
}
```

### 動作仕様

| 記述 | SP（スマホ） | PC |
|------|-------------|-----|
| `<HideHeader />` | 非表示 | 非表示 |
| `<HideHeader sp />` | 非表示 | 表示 |
| `<HideHeader pc />` | 表示 | 非表示 |
| `<HideHeader sp pc />` | 非表示 | 非表示 |

- **props未指定で両方非表示**（`<HideHeader />`で両方非表示）
- ページ遷移時に自動リセット（アンマウント時にデフォルトに戻る）
- ブレークポイント: `sm`（640px）を境界としてSP/PCを判定
