# User AppFrames

ユーザーアプリ側の枠のうち、まだ `src/app/(user)/_layout/` へ移していない物。

枠の部品(UserLayout・BackgroundLayer・UserPage・PageTitle・Header・Footer・BottomNav・hooks)は **`src/app/(user)/_layout/` へ移動した**(説明・設定ファイル・UserPage の fill / immersive もそちら: [src/app/(user)/_layout/README.md](../../../app/(user)/_layout/README.md))。この dir の旧パス(`Layout/`・`Elements/PageTitle`・`Sections/Header`・`Sections/Footer`・`Sections/BottomNav`・`hooks/`)は `@deprecated 旧パス互換` の re-export shim で、旧入口撤去の区切りで削除する。

## ディレクトリ構成

```
User/
├── Sections/
│   ├── HeaderCustom/    # カスタムヘッダー(プロジェクト固有。config の切り替えで使う旧来の雛形)
│   └── FooterCustom/    # カスタムフッター(同上)
├── contexts/        # 表示制御の Context(UserLayout の Provider と controls が使う)
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

## カスタムコンポーネント

プロジェクト固有のデザインにカスタマイズしたい場合、`HeaderCustom/` または `FooterCustom/` のスケルトンテンプレートを編集し、設定ファイルで切り替えます。

### スケルトンテンプレート

`HeaderCustom/index.tsx` と `FooterCustom/index.tsx` には、共通フック(`@/app/(user)/_layout/hooks`)を使用したスケルトンテンプレートが用意されています。デザインのみをカスタマイズすれば、設定ファイルとの連携やロジックは自動的に機能します。

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
- アンマウント時は**そのコンポーネントの指定だけ**を外す（他の Hide* の指定は残る）。退出アニメーション中の旧ページの Hide* が新ページの Hide* より後に外れても、新ページの指定が効いたまま
- 複数の Hide* が同時にあるときは、後からマウントした方の指定が優先
- 自作の表示制御は `useHeaderVisibility()` 等の `setOverride(id, partial)` / `clearOverride(id)`（id は `useId()`）を使う。`setVisibility` / `reset` は基本の値を操作するもので、`reset` は Hide* の指定を消さない（実装: `contexts/createVisibilityContext.tsx`）
- ブレークポイント: `sm`（640px）を境界としてSP/PCを判定
