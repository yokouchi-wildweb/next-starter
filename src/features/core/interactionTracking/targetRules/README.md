# targetRules(公開 ingest の計測対象の規則の受け口)

`<名前>.<fork の名前>.ts` に `export const rule: InteractionTargetRule`(`targetType` 必須)を置き、`pnpm extensions:generate`。上流の項目は 0。項目が無い targetType は拒否(fail-closed)。
書き方: `src/features/core/interactionTracking/README.md` / 仕組み: `scripts/extensions/README.md`
