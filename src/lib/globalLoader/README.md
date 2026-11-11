# globalLoader

画面全体を覆うローダーの閉じた lib。表示の状態(lib の中の store)・出し入れのフック・描画の部品を持つ。読む lib = `cn`・`isClient`。棚の部品は型も読まない(D103)。

## 入口(`@/lib/globalLoader`)

- `GlobalScreenLoader` — root layout(`src/app/layout.tsx`)に 1 つだけ置く。表示中は body 直下へ portal で描く(SSR / hydration 中は何も描かない)
- `useGlobalLoader()` — `{ showLoader, hideLoader }`
  - `showLoader(message?: string | LoaderOptions)` — 文字列は `{ message }` と同じ。呼ぶたびに前の options を置き換える
  - `hideLoader()` — 消して options を空に戻す
- 型: `LoaderOptions`(`message`・`spinnerVariant`・`spinnerClassName`・`messageClassName`・`className`・`zIndex`)・`LoaderSpinnerVariant`(`"default"` | `"ring"` | `"circle"`)

store(`stores/`)は入口から出さない。動かすのは `showLoader` / `hideLoader` だけ。

```tsx
import { useGlobalLoader } from "@/lib/globalLoader";

const { showLoader, hideLoader } = useGlobalLoader();
showLoader({ message: "データ処理中…", spinnerVariant: "ring", zIndex: 100 });
try {
  await run();
} finally {
  hideLoader();
}
```

## 描画

棚の `ScreenLoader`(mode="fullscreen")+ `Spinner` と同じ形を自分で持つ(`GlobalScreenLoader.tsx`・種類 → アイコンの対応 `spinner.ts`)。`zIndex` は style、`className` は外側の要素に足す(重ねる層の既定は `overlay-layer`)。

同じ出力になることは棚の側のテスト `src/components/Overlays/Loading/globalLoaderParity.test.tsx` が既定とすべての種類で確かめる。`ScreenLoader` / `Spinner` の見た目を変えるときはこの lib も同じに直す(片方だけだと落ちる)。

## 旧パス

`@/stores/globalLoader`・`@/hooks/useGlobalLoader`・`@/components/Overlays/Loading/GlobalScreenLoader` は消えた(lint deprecated-imports が `@/lib/globalLoader` を案内する)。旧 `useGlobalLoaderStore` の `setOptions(o)` + `setVisible(true)` は `showLoader(o)`、`setVisible(false)` は `hideLoader()` に書き換える。

## package.json

`sideEffects` は書かない(読み込み時に zustand の store を作る)。
