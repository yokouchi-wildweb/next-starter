# Primitives/HoverCard

## Overview

- ホバーカードの薄い部品（radix-ui に印だけを足した物、クラスなし）と名前空間 `HoverCardPrimitive`。完成品は `src/components/Overlays/HoverCard`。`HoverCardRoot`・`HoverCardPortal` は要素なし（印なし）。
- 使う時・直す時の決まり(入口・radix-ui・完成品が先・data-slot の約束)は札 .claude/rules/items/components/Primitives.md にある。この README は部品の説明と印の一覧

## Extension

- fork の CSS は下の一覧の印 `[data-slot="<名前>"]` を狙う。印の数と名前は部品のファイルの物と一致する

### data-slot の一覧

- `hover-card-trigger` — `HoverCardTrigger`（asChild のときは子の要素）
- `hover-card-content` — `HoverCardContent`
- `hover-card-arrow` — `HoverCardArrow`

## Verification

- 一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`
