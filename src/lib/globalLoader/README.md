# globalLoader

## Overview

- 画面全体を覆うローダーの閉じた lib。表示の状態(lib の中の store)・出し入れのフック・描画の部品を持つ。入口 `@/lib/globalLoader`
- 読む lib = `isClient`、棚 = `components`(package.json の `peers`。描画は棚の `ScreenLoader`)

## Usage

- `GlobalScreenLoader` を root layout(`src/app/layout.tsx`)に置く(上流は置き済み)
- 出し入れは `useGlobalLoader()` の `showLoader` / `hideLoader`

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

- 旧パスからの書き換え: `@/stores/globalLoader`・`@/hooks/useGlobalLoader`・`@/components/Overlays/Loading/GlobalScreenLoader` は消えた(lint deprecated-imports が `@/lib/globalLoader` を案内する)。旧 `useGlobalLoaderStore` の `setOptions(o)` + `setVisible(true)` は `showLoader(o)`、`setVisible(false)` は `hideLoader()`

## API

- `GlobalScreenLoader` — 表示中は body 直下へ portal で描く(SSR / hydration 中は何も描かない)
- `useGlobalLoader()` — `{ showLoader, hideLoader }`
  - `showLoader(message?: string | LoaderOptions)` — 文字列は `{ message }` と同じ。呼ぶたびに前の options を置き換える
  - `hideLoader()` — 消して options を空に戻す
- 型: `LoaderOptions`(`message`・`spinnerVariant`・`spinnerClassName`・`messageClassName`・`className`)・`LoaderSpinnerVariant`(`"default"` | `"ring"` | `"circle"`)
- store(`stores/`)は入口から出さない

## Internals

- 描画: 棚の `ScreenLoader`(mode="fullscreen")をそのまま描く(`GlobalScreenLoader.tsx`。種類の型 `LoaderSpinnerVariant` = 棚の `SpinnerVariant`、`spinner.ts`)
- `className` は外側の要素に足す。重ねる層はいつも `cover-layer`(数で持ち上げる指定は無い)
- package.json に `sideEffects` を書かないのは、読み込み時に zustand の store を作るため

## Verification

- `ScreenLoader` と同じ出力になること: 棚の側のテスト `src/components/Overlays/Loading/globalLoaderParity.test.tsx`(既定とすべての種類)
