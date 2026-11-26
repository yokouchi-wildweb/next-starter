# globalLoader

## Overview

- 画面全体を覆うローダーの閉じた lib。表示の状態(lib の中の store)・出し入れのフック・描画の部品を持つ。入口 `@/lib/globalLoader`
- 読む lib = `isClient`、棚 = `components`(package.json の `peers`。描画は棚の `ScreenLoader`)

## Usage

- `GlobalScreenLoader` を root layout(`src/app/layout.tsx`)に置く(上流は置き済み)
- 出すのは `useGlobalLoader()` の `showLoader`。返る終わりの関数を `finally` で呼ぶ(処理ごとに自分の分を持ち、全部の終わりまで出し続ける。D111・D114)

```tsx
import { useGlobalLoader } from "@/lib/globalLoader";

const { showLoader } = useGlobalLoader();
const end = showLoader({ message: "データ処理中…", spinnerVariant: "ring" });
try {
  await run();
} finally {
  end();
}
```

- 旧パスからの書き換え: `@/stores/globalLoader`・`@/hooks/useGlobalLoader`・`@/components/Overlays/Loading/GlobalScreenLoader` は消えた(lint deprecated-imports が `@/lib/globalLoader` を案内する)。旧 `useGlobalLoaderStore` の `setOptions(o)` + `setVisible(true)` は `const end = showLoader(o)`、`setVisible(false)` はその `end()`。引数なしの `hideLoader()` は消えた(型で落ちる。区切り cc-global-loader の codemod が `finally` の形へ移す)

## API

- `GlobalScreenLoader` — 表示中は body 直下へ portal で描く(SSR / hydration 中は何も描かない)
- `useGlobalLoader()` — `{ showLoader }`
  - `showLoader(message?: string | LoaderOptions): () => void` — 文字列は `{ message }` と同じ。出す分を 1 つ足し、その分の終わりの関数を返す
  - 1 つでも残る間は出し続け、文と見た目は残っている中で最後に出した物(先に終わった処理が他の処理の表示を消さない)
  - 終わりの関数は 1 回だけ効く(2 回目以降は何もしない)。別の部品・処理へ渡して呼んでもよい
  - このフックを使う部品が unmount すると、その部品が出してまだ終わっていない分だけを外す(他の部品の分は残る)
- 型: `LoaderOptions`(`message`・`spinnerVariant`・`spinnerClassName`・`messageClassName`・`className`)・`LoaderSpinnerVariant`(`"default"` | `"ring"` | `"circle"`)
- store(`stores/`)は入口から出さない

## Internals

- 状態: lib の中の store が出している分を手形(id)ごとに出した順で持つ(`stores/internalStore.ts`)。表示 = 1 つ以上、options = 並びの最後
- 描画: 棚の `ScreenLoader`(mode="fullscreen")をそのまま描く(`GlobalScreenLoader.tsx`。種類の型 `LoaderSpinnerVariant` = 棚の `SpinnerVariant`、`spinner.ts`)
- `className` は外側の要素に足す。重ねる層はいつも `cover-layer`(数で持ち上げる指定は無い)
- package.json に `sideEffects` を書かないのは、読み込み時に zustand の store を作るため

## Verification

- `ScreenLoader` と同じ出力になること: 棚の側のテスト `src/components/Overlays/Loading/globalLoaderParity.test.tsx`(既定とすべての種類)
- 重なり・1 回だけ効く終わり・unmount の分: `src/lib/globalLoader/useGlobalLoader.test.tsx`
