# Primitives/Popover

ポップオーバーの低レベル部品（層・サイズ・ダイアログの中での振る舞い）。完成品は `src/components/Overlays/Popover`（その入口もこの名前を再輸出する）。`Popover.tsx` の中の `[data-slot="dialog-…"]` はダイアログの要素を見分けるセレクタで、この部品の印ではない。

- 読むのは入口 `@/components/Primitives/Popover` だけ（`src/components/Primitives/index.ts` は無い）。Radix は統合版の `radix-ui` から読む
- 画面からは通常、完成品を使う。この部品を直接組むのは完成品で足りないときだけ

## data-slot の一覧

fork の CSS が狙ってよい印（`[data-slot="<名前>"]`。id・class 名・DOM の形は約束ではない）。印を消す・名前を変えるのは notice。印は部品のもの。呼び手が props で `data-slot` を渡しても置き換わらない（名前を変えるのは包む上流の部品が型つきの値 `slot` で渡すときだけ。見出しと同じ）。一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`

- `popover` — `PopoverRoot`（Radix の Root / Portal など要素を描かない部品。印の属性は渡るが DOM には出ない）
- `popover-trigger` — `PopoverTrigger`
- `popover-anchor` — `PopoverAnchor`
- `popover-arrow` — `PopoverArrow`
- `popover-close` — `PopoverClose`
- `popover-content` — `PopoverContent`
- `popover-scroll` — `PopoverContent` の中のスクロールの包み
- `popover-header` — `PopoverHeader`
- `popover-title` — `PopoverTitle`
- `popover-description` — `PopoverDescription`
- `popover-body` — `PopoverBody`
- `popover-footer` — `PopoverFooter`
