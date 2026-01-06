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
│   ├── Footer/          # フッター（スクロール内）
│   └── BottomNav/       # ボトムナビゲーション（スマホ固定）
│       ├── index.tsx            # BottomNav本体
│       ├── BottomNavItem.tsx    # 個別アイテムコンポーネント
│       ├── BottomNavSpacer.tsx  # スペーサー（表示時のみ高さを確保）
│       ├── useBottomNavItems.ts # ★メニュー・高さ設定（編集ポイント）
│       └── types.ts             # 型定義
├── Elements/        # 共通UI要素
│   └── PageTitle.tsx    # ページタイトル
├── contexts/        # 状態管理Context
│   ├── HeaderVisibilityContext.tsx
│   ├── FooterVisibilityContext.tsx
│   └── BottomNavVisibilityContext.tsx
└── controls/        # ページ単位のレイアウト制御コンポーネント
    ├── HeaderControl.tsx
    ├── FooterControl.tsx
    ├── BottomNavControl.tsx
    └── index.ts
```

---

## controls - レイアウト制御コンポーネント

ページ単位でヘッダー・フッターの表示/非表示を制御できる。
スマホ（sp）とPC（pc）で個別に指定可能。

### インポート

```tsx
import { HideHeader, HideFooter } from "@/components/AppFrames/User/controls";
```

### HideHeader

ヘッダーを非表示にする。

```tsx
// 両方非表示
<HideHeader sp pc />

// スマホのみ非表示
<HideHeader sp />

// PCのみ非表示
<HideHeader pc />
```

### HideFooter

フッターを非表示にする。

```tsx
// 両方非表示
<HideFooter sp pc />

// スマホのみ非表示
<HideFooter sp />

// PCのみ非表示
<HideFooter pc />
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

### HideBottomNav

ボトムナビゲーションを非表示にする。
**デフォルト**: スマホのみ表示（PCは非表示）

```tsx
// 両方非表示（props未指定で両方非表示）
<HideBottomNav />

// スマホのみ非表示（デフォルトがスマホ表示なので、これで完全非表示になる）
<HideBottomNav sp />
```

---

## BottomNav - スマホ用ボトムナビゲーション

スマホ表示時に画面下部に固定表示されるナビゲーション。

### 特徴

- スマホのみ表示（デフォルト）
- 画面下部に固定（`fixed bottom-0`）
- カレントページは色が変わる（`text-primary`）
- Lucide-reactアイコンを使用

### 設定ファイル

**`src/config/user-bottom-menu.config.ts`** を編集してカスタマイズ：

```tsx
import { Home, LogIn, User } from "lucide-react";
import type { BottomNavItem } from "@/components/AppFrames/User/Sections/BottomNav/types";

// ============================================
// 基本設定
// ============================================

/** ボトムナビゲーションを有効にするか */
export const BOTTOM_NAV_ENABLED = true;

/** ボトムナビの高さ（px） */
export const BOTTOM_NAV_HEIGHT = 64;

// ============================================
// メニューアイテム設定
// ============================================

/** 認証済みユーザー用メニュー */
export const AUTHENTICATED_MENU_ITEMS: BottomNavItem[] = [
  { key: "home", label: "ホーム", href: "/", icon: Home },
  { key: "mypage", label: "マイページ", href: "/mypage", icon: User },
];

/** 未認証ユーザー用メニュー */
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
