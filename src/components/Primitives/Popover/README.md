# Primitives/Popover

## Overview

- ポップオーバーの低レベル部品（層・サイズ・ダイアログの中での振る舞い）。完成品は `src/components/Overlays/Popover`（その入口もこの名前を再輸出する）。`Popover.tsx` の中の `[data-slot="dialog-…"]` はダイアログの要素を見分けるセレクタで、この部品の印ではない。
- 使う時・直す時の決まり(入口・radix-ui・完成品が先・data-slot の約束)は札 .claude/rules/items/components/Primitives.md にある。この README は部品の説明と印の一覧

## Extension

- fork の CSS は下の一覧の印 `[data-slot="<名前>"]` を狙う。印の数と名前は部品のファイルの物と一致する

### data-slot の一覧

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

## Verification

- 一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`
