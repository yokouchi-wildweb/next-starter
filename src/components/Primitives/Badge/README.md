# Primitives/Badge

バッジの土台 `BadgeCore`（asChild = radix-ui の Slot）。完成品は `src/components/Badge`（`SolidBadge` / `SoftBadge` / `BookmarkTagBadge`）。

- 読むのは入口 `@/components/Primitives/Badge` だけ（`src/components/Primitives/index.ts` は無い）。Radix は統合版の `radix-ui` から読む
- 画面からは通常、完成品を使う。この部品を直接組むのは完成品で足りないときだけ

## data-slot の一覧

fork の CSS が狙ってよい印（`[data-slot="<名前>"]`。id・class 名・DOM の形は約束ではない）。印を消す・名前を変えるのは notice。印は部品のもの。呼び手が props で `data-slot` を渡しても置き換わらない（名前を変えるのは包む上流の部品が型つきの値 `slot` で渡すときだけ。見出しと同じ）。一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`

- `badge` — `BadgeCore` の根の `<span>`（asChild のときは子の要素。子が自分の data-slot を持てば子の名前が残る）
- `solid-badge` — `SolidBadge`（`src/components/Badge`）が `slot="solid-badge"` で渡す `BadgeCore` の根
- `bookmark-tag-badge` — `BookmarkTagBadge` が `slot="bookmark-tag-badge"` で渡す `BadgeCore` の根
