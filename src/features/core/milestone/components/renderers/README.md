# renderers(マイルストーン達成通知のレンダラーの受け口)

`<名前>.ts(x)` に `export const renderer: MilestoneRendererDefinition` を置き、`pnpm generate extensions`。上流の項目は 0(全キーが既定の通知)。
書き方: `src/features/core/milestone/README.md`「レンダラーの登録」/ 仕組み: `scripts/structure/extensions/README.md`
