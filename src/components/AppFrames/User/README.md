# User AppFrames

ユーザーアプリ側の枠のうち、まだ `src/app/(user)/_layout/` へ移していない物。

枠の部品(UserLayout・BackgroundLayer・UserPage・PageTitle・Header・Footer・BottomNav・hooks)は **`src/app/(user)/_layout/` へ移動した**(説明・設定ファイル・UserPage の fill / immersive もそちら: [src/app/(user)/_layout/README.md](../../../app/(user)/_layout/README.md))。この dir の旧パス(`Layout/`・`Elements/PageTitle`・`Sections/Header`・`Sections/Footer`・`Sections/BottomNav`・`hooks/`)は `@deprecated 旧パス互換` の re-export shim で、旧入口撤去の区切りで削除する。

## ディレクトリ構成

```
User/
├── Sections/
│   ├── HeaderCustom/    # カスタムヘッダー(プロジェクト固有。config の切り替えで使う旧来の雛形)
│   └── FooterCustom/    # カスタムフッター(同上)
├── contexts/        # @deprecated 表示制御の Context(Hide* も枠の部品も使わない。UserLayout が互換の Provider を置くだけ。旧入口撤去の区切りで削除)
│   ├── HeaderVisibilityContext.tsx
│   ├── HeaderNavVisibilityContext.tsx
│   ├── FooterVisibilityContext.tsx
│   └── BottomNavVisibilityContext.tsx
└── controls/        # ページ単位で枠の部位を隠す印(Hide*)
    ├── frameParts.ts    # 部位一覧(唯一の元。印の属性と styles/frame-controls.generated.css の規則を作る)
    ├── HeaderControl.tsx
    ├── HeaderNavControl.tsx
    ├── FooterControl.tsx
    ├── BottomNavControl.tsx
    ├── frameControls.test.tsx
    └── index.ts
```

---

## カスタムコンポーネント

> **廃止予定**: config の部品切り替え(HeaderCustom / FooterCustom)は旧来の方式で、旧入口撤去の区切りで削除します。新しく差し替えるときは、`src/app/(user)/_layout/UserLayout.<project>.tsx`(ドット区切り名のカスタム)で既定の `UserLayout` に `header` / `footer` slot として自分の部品を渡し、`src/app/(user)/layout.tsx` をそちらへ向けます。手順: [src/app/(user)/_layout/README.md](../../../app/(user)/_layout/README.md)「layout.tsx と slot」。それまでは下の切り替えも動きます(UserLayout は slot 省略時に config の部品を描く)。

プロジェクト固有のデザインにカスタマイズしたい場合、`HeaderCustom/` または `FooterCustom/` のスケルトンテンプレートを編集し、設定ファイルで切り替えます。

### スケルトンテンプレート

`HeaderCustom/index.tsx` と `FooterCustom/index.tsx` には、共通フック(`@/app/(user)/_layout/hooks`)を使用したスケルトンテンプレートが用意されています。デザインのみをカスタマイズすれば、設定ファイルとの連携やロジックは自動的に機能します。雛形の部品は `data-frame-part`(`header` / `header-nav` / `footer`)を持つので Hide* の印で隠れる。編集・コピーしてもこの属性は残す。

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

ページ単位でヘッダー・ヘッダーのナビ・フッター・ボトムナビを隠す。スマホ（sp）とPC（pc）で個別に指定可能。
Hide* は印 `<span hidden data-frame-hide>` を描くだけで、隠すのは生成 CSS(`:has()`)。仕組み・効かない置き方・経緯: [src/app/(user)/_layout/README.md](../../../app/(user)/_layout/README.md)「枠の部位を隠す(Hide* と印)」

### インポート

```tsx
import { HideHeader, HideHeaderNav, HideFooter, HideBottomNav } from "@/components/AppFrames/User/controls";
```

### HideHeader / HideHeaderNav / HideFooter

```tsx
// 両方非表示
<HideHeader sp pc />

// スマホのみ非表示
<HideHeader sp />

// PCのみ非表示
<HideHeader pc />
```

### HideBottomNav

ボトムナビゲーション(高さ分のスペーサーを含む)を隠す。
**デフォルト**: スマホのみ表示（PCは非表示。`src/config/ui/user-bottom-menu.config.ts` の `BOTTOM_NAV_VISIBILITY`）。`pc={false}` は PC に出す指定ではない(何もしない)。PC にも出すなら config の `pc: true`

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
- `sp={false}` / `pc={false}` は「そのデバイスでは隠さない」= 何もしない(隠す方向だけ)
- 描いている部品が画面にある間だけ効く。複数あれば足し算(どれか 1 つが隠せば隠す)
- server / client どちらの部品からも描ける。UserLayout の外枠の中に描く(portal の中では効かない)
- 自作の表示制御(context の `setOverride` / `setVisibility` を直接呼ぶ物)は Hide* に置き換える。context は Hide* から切り離され、旧入口撤去の区切りで削除する
- ブレークポイント: `sm`（640px）を境界としてSP/PCを判定
