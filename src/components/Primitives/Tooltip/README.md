# Primitives/Tooltip

ツールチップの薄い部品（radix-ui に印だけを足した物、クラスなし）と名前空間 `TooltipPrimitive`。完成品は `src/components/Overlays/Tooltip`（`Tooltip` / `TooltipProvider` / `HelpTip`）。`TooltipProvider`・`TooltipRoot`・`TooltipPortal` は要素なし（印なし）。

- 読むのは入口 `@/components/Primitives/Tooltip` だけ（`src/components/Primitives/index.ts` は無い）。Radix は統合版の `radix-ui` から読む
- 画面からは通常、完成品を使う。この部品を直接組むのは完成品で足りないときだけ

## data-slot の一覧

fork の CSS が狙ってよい印（`[data-slot="<名前>"]`。id・class 名・DOM の形は約束ではない）。印を消す・名前を変えるのは notice。印は部品のもの。呼び手が props で `data-slot` を渡しても置き換わらない（名前を変えるのは包む上流の部品が型つきの値 `slot` で渡すときだけ。見出しと同じ）。一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`

- `tooltip-trigger` — `TooltipTrigger`（asChild のときは子の要素）
- `tooltip-content` — `TooltipContent`
- `tooltip-arrow` — `TooltipArrow`
