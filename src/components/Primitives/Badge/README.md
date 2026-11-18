# Primitives/Badge

## Overview

- バッジの土台 `BadgeCore`（asChild = radix-ui の Slot）。完成品は `src/components/Badge`（`SolidBadge` / `SoftBadge` / `BookmarkTagBadge`）。
- 使う時・直す時の決まり(入口・radix-ui・完成品が先・data-slot の約束)は札 .claude/rules/items/components/Primitives.md にある。この README は部品の説明と印の一覧

## Extension

- fork の CSS は下の一覧の印 `[data-slot="<名前>"]` を狙う。印の数と名前は部品のファイルの物と一致する

### data-slot の一覧

- `badge` — `BadgeCore` の根の `<span>`（asChild のときは子の要素。子が自分の data-slot を持てば子の名前が残る）
- `solid-badge` — `SolidBadge`（`src/components/Badge`）が `slot="solid-badge"` で渡す `BadgeCore` の根
- `bookmark-tag-badge` — `BookmarkTagBadge` が `slot="bookmark-tag-badge"` で渡す `BadgeCore` の根

## Verification

- 一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`
