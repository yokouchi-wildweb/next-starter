# Primitives/Slot

radix-ui の Slot の名前空間（`Slot.Root` / `Slot.Slottable`）の再輸出。要素を描かないので印は無い。

- 読むのは入口 `@/components/Primitives/Slot` だけ（`src/components/Primitives/index.ts` は無い）。Radix は統合版の `radix-ui` から読む
- 画面からは通常、完成品を使う。この部品を直接組むのは完成品で足りないときだけ

## data-slot の一覧

なし（要素を描かない）。照合: `pnpm test src/components/Primitives/slots.test.mjs`
