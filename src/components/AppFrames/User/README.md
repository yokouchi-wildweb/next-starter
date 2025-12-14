# User AppFrames

ユーザーアプリ側のレイアウトフレームを構成するコンポーネント群。

## ディレクトリ構成

```
User/
├── Layout/          # レイアウトコンポーネント
│   ├── UserLayout.tsx   # アプリ全体のレイアウト（Header + Footer + Provider）
│   └── UserPage.tsx     # ページコンテナ
├── Sections/        # レイアウトセクション
│   ├── Header/          # ヘッダーナビゲーション
│   └── Footer/          # フッター
├── Elements/        # 共通UI要素
│   └── PageTitle.tsx    # ページタイトル
├── contexts/        # 状態管理Context
│   ├── HeaderVisibilityContext.tsx
│   └── FooterVisibilityContext.tsx
└── controls/        # ページ単位のレイアウト制御コンポーネント
    ├── HeaderControl.tsx
    ├── FooterControl.tsx
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
      <HideHeader sp pc />
      <HideFooter sp pc />
      <div>オンボーディングコンテンツ...</div>
    </>
  );
}
```

### 動作仕様

| 記述 | SP（スマホ） | PC |
|------|-------------|-----|
| `<HideHeader sp pc />` | 非表示 | 非表示 |
| `<HideHeader sp />` | 非表示 | 表示 |
| `<HideHeader pc />` | 表示 | 非表示 |
| （記述なし） | 表示 | 表示 |

- デフォルトは表示
- ページ遷移時に自動リセット（アンマウント時にデフォルトに戻る）
- ブレークポイント: `sm`（640px）を境界としてSP/PCを判定
