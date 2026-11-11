# Primitives/Tabs

タブ（radix-ui）。完成品は `Navigation/PageTab`・`Navigation/StateTabs`・`Overlays/TabbedModal`。

- 読むのは入口 `@/components/Primitives/Tabs` だけ（`src/components/Primitives/index.ts` は無い）。Radix は統合版の `radix-ui` から読む
- 画面からは通常、完成品を使う。この部品を直接組むのは完成品で足りないときだけ

## data-slot の一覧

fork の CSS が狙ってよい印（`[data-slot="<名前>"]`。id・class 名・DOM の形は約束ではない）。印を消す・名前を変えるのは notice。印は部品の既定で、呼び手が props で渡した `data-slot` があればそちらが付く（shadcn の形）。一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`

- `tabs` — `Tabs` の根
- `tabs-list` — `TabsList`
- `tabs-trigger` — `TabsTrigger`
- `tabs-content` — `TabsContent`
