# Primitives/Button

ボタンの土台 `Button`・`baseButtonClassName`（asChild = radix-ui の Slot）。完成品は `src/components/Form/Button`。

- 読むのは入口 `@/components/Primitives/Button` だけ（`src/components/Primitives/index.ts` は無い）。Radix は統合版の `radix-ui` から読む
- 画面からは通常、完成品を使う。この部品を直接組むのは完成品で足りないときだけ

## data-slot の一覧

fork の CSS が狙ってよい印（`[data-slot="<名前>"]`。id・class 名・DOM の形は約束ではない）。印を消す・名前を変えるのは notice。印は部品のもの。呼び手が props で `data-slot` を渡しても置き換わらない（名前を変えるのは包む上流の部品が型つきの値 `slot` で渡すときだけ。見出しと同じ）。一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`

- `button` — `Button` の `<button>`（asChild のときは子の要素）。同じ要素を描く Carousel の前後のボタンは型つきの値 `slot` で自分の名前（`carousel-previous` / `carousel-next`、一覧は Carousel の README）を渡す。下のナビのメニュー項目も `slot` で枠の印 `bottom-nav-item` を渡す（持ち主は枠。一覧は `src/app/(user)/_layout/README.md`、ここには載せない）
