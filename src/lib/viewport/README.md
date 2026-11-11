# viewport

ビューポートの実寸と向きを読むための閉じた lib。実寸の store(`stores/`)・それを書く `ViewportHeightWatcher`・読むフックを持つ。読む lib・棚の部品は無い(react と zustand だけ)。

## 書き手は 1 つ

- 実寸(visualViewport の幅・高さ、無ければ window.inner*)と `:root` の CSS 変数 `--viewport-height` を書くのは `ViewportHeightWatcher` だけ。root layout(`src/app/layout.tsx`)が 1 度だけ描く
- 追随するのは window の resize と visualViewport の resize / scroll(モバイルのアドレスバーの出入り)
- store の書き込み(setSize)は入口から出さない。他の部品は計測も setProperty もしない。高さが要る部品は CSS で `var(--viewport-height, 100dvh)` を読む(`Layout/FullScreen`・`AppFrames/Kiosk` の KioskFrame)

## 入口(`@/lib/viewport`)

- `ViewportHeightWatcher` — 上の書き手。root layout 以外で描かない
- `useViewportSize()` — `{ width, height }` を読むだけ。計測前・SSR は 0。`height` は `--viewport-height` と同じ値
- `useViewportOrientation(options?)` — `{ orientation, isShortHeight, width, height, shortSide }`
  - `orientation` / `isShortHeight` は matchMedia 由来(レイアウトビューポート基準)なので CSS の `landscape:` / `short:` と同じ判定。ソフトキーボードで visualViewport が縮んでも反転しない
  - `width` / `height` / `shortSide` は `useViewportSize` の実寸
  - `shortHeightMax` の既定 = `SHORT_HEIGHT_MAX_PX`(500)。`src/styles/core/theme.css` の `short:` バリアントと手で揃える(Tailwind のメディアクエリは CSS 変数を読めない)
  - SSR / hydration 中は portrait + isShortHeight=false + 実寸 0
- `useMediaQuery(query)` — CSS メディアクエリの一致を購読(useSyncExternalStore、SSR / hydration 中は false)
- 型: `ViewportSize`・`ViewportOrientation`・`UseViewportOrientationOptions`・`ViewportOrientationState`

```tsx
import { useViewportOrientation } from "@/lib/viewport";

const { isShortHeight } = useViewportOrientation();
return <Stack space={isShortHeight ? 1 : 4}>...</Stack>;
```

## 旧パス

`@/stores/viewportSize`・`@/hooks/useViewportOrientation`・`@/hooks/useMediaQuery`・`@/components/Fanctional/ViewportHeightWatcher` は消えた(lint deprecated-imports が `@/lib/viewport` を案内する)。旧 store の `setSize` は外から使えない(書き手は ViewportHeightWatcher だけ)。

## package.json

`sideEffects` は書かない(読み込み時に zustand の store を作る)。
