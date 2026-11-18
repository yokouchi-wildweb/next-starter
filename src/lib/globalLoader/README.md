# globalLoader

画面全体を覆うローダーの閉じた lib。表示の状態(lib の中の store)・出し入れのフック・描画の部品を持つ。読む lib = `isClient`、棚 = `components`(package.json の `peers`。描画は棚の `ScreenLoader`、当議会 D208)。

## 入口(`@/lib/globalLoader`)

- `GlobalScreenLoader` — root layout(`src/app/layout.tsx`)に 1 つだけ置く。表示中は body 直下へ portal で描く(SSR / hydration 中は何も描かない)
- `useGlobalLoader()` — `{ showLoader, hideLoader }`
  - `showLoader(message?: string | LoaderOptions)` — 文字列は `{ message }` と同じ。呼ぶたびに前の options を置き換える
  - `hideLoader()` — 消して options を空に戻す
- 型: `LoaderOptions`(`message`・`spinnerVariant`・`spinnerClassName`・`messageClassName`・`className`)・`LoaderSpinnerVariant`(`"default"` | `"ring"` | `"circle"`)

store(`stores/`)は入口から出さない。動かすのは `showLoader` / `hideLoader` だけ。

```tsx
import { useGlobalLoader } from "@/lib/globalLoader";

const { showLoader, hideLoader } = useGlobalLoader();
showLoader({ message: "データ処理中…", spinnerVariant: "ring" });
try {
  await run();
} finally {
  hideLoader();
}
```

## 描画

棚の `ScreenLoader`(mode="fullscreen")をそのまま描く(`GlobalScreenLoader.tsx`。種類の型 `LoaderSpinnerVariant` = 棚の `SpinnerVariant`、`spinner.ts`)。`className` は外側の要素に足す(重ねる層はいつも `cover-layer`。数で持ち上げる指定は無い、当議会 D189)。

`ScreenLoader` と同じ出力になることは棚の側のテスト `src/components/Overlays/Loading/globalLoaderParity.test.tsx` が既定とすべての種類で確かめる。

## 旧パス

`@/stores/globalLoader`・`@/hooks/useGlobalLoader`・`@/components/Overlays/Loading/GlobalScreenLoader` は消えた(lint deprecated-imports が `@/lib/globalLoader` を案内する)。旧 `useGlobalLoaderStore` の `setOptions(o)` + `setVisible(true)` は `showLoader(o)`、`setVisible(false)` は `hideLoader()` に書き換える。

## package.json

`sideEffects` は書かない(読み込み時に zustand の store を作る)。
