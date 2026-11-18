# Primitives/Tooltip

## Overview

- ツールチップの薄い部品（radix-ui に印だけを足した物、クラスなし）と名前空間 `TooltipPrimitive`。完成品は `src/components/Overlays/Tooltip`（`Tooltip` / `TooltipProvider` / `HelpTip`）。`TooltipProvider`・`TooltipRoot`・`TooltipPortal` は要素なし（印なし）。
- 使う時・直す時の決まり(入口・radix-ui・完成品が先・data-slot の約束)は札 .claude/rules/items/components/Primitives.md にある。この README は部品の説明と印の一覧

## Extension

- fork の CSS は下の一覧の印 `[data-slot="<名前>"]` を狙う。印の数と名前は部品のファイルの物と一致する

### data-slot の一覧

- `tooltip-trigger` — `TooltipTrigger`（asChild のときは子の要素）
- `tooltip-content` — `TooltipContent`
- `tooltip-arrow` — `TooltipArrow`

## Verification

- 一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`
