# viewport

## Overview

- ビューポートの実寸と向きを読むための閉じた lib。実寸の store(`stores/`)・それを書く `ViewportHeightWatcher`・読むフックを持つ。入口 `@/lib/viewport`
- 読む lib・棚の部品は無い(react と zustand だけ)

## Usage

- `ViewportHeightWatcher` は root layout(`src/app/layout.tsx`)が 1 度だけ描く(上流は置き済み)
- 高さが要る部品は CSS で `var(--viewport-height, 100dvh)` を読む(`Layout/FullScreen`・`Layout/KioskFrame`)
- JS で寸法・向きが要るときはフックで読む

```tsx
import { useViewportOrientation } from "@/lib/viewport";

const { isShortHeight } = useViewportOrientation();
return <Stack gap={isShortHeight ? "2xs" : "md"}>...</Stack>;
```

## API

- `ViewportHeightWatcher` — 実寸と `--viewport-height` の書き手
- `useViewportSize()` — `{ width, height }` を読むだけ。計測前・SSR は 0。`height` は `--viewport-height` と同じ値
- `useViewportOrientation(options?)` — `{ orientation, isShortHeight, width, height, shortSide }`
  - `orientation` / `isShortHeight` は matchMedia 由来(レイアウトビューポート基準)なので CSS の `landscape:` / `short:` と同じ判定。ソフトキーボードで visualViewport が縮んでも反転しない
  - `width` / `height` / `shortSide` は `useViewportSize` の実寸
  - `shortHeightMax` の既定 = `SHORT_HEIGHT_MAX_PX`(500)
  - SSR / hydration 中は portrait + isShortHeight=false + 実寸 0
- `useMediaQuery(query)` — CSS メディアクエリの一致を購読(useSyncExternalStore、SSR / hydration 中は false)
- 型: `ViewportSize`・`ViewportOrientation`・`UseViewportOrientationOptions`・`ViewportOrientationState`

## Internals

- `ViewportHeightWatcher` が実寸(visualViewport の幅・高さ、無ければ window.inner*)と `:root` の CSS 変数 `--viewport-height` を書く
- 追随するのは window の resize と visualViewport の resize / scroll(モバイルのアドレスバーの出入り)
- 入口は store の書き込み(setSize)を出していない(書き手は ViewportHeightWatcher だけ)
- `SHORT_HEIGHT_MAX_PX`(500)と `src/styles/core/theme.css` の `short:` バリアント(`max-height: 500px`)は同じ値を 2 か所に持つ(Tailwind のメディアクエリは CSS 変数を読めない)
- package.json に `sideEffects` が無いのは、読み込み時に zustand の store を作るため
