# Primitives/Select

## Overview

- 選択（radix-ui）。完成品は `Input/Select`。
- 使う時・直す時の決まり(入口・radix-ui・完成品が先・data-slot の約束)は札 .claude/rules/items/components/Primitives.md にある。この README は部品の説明と印の一覧

## Extension

- fork の CSS は下の一覧の印 `[data-slot="<名前>"]` を狙う。印の数と名前は部品のファイルの物と一致する

### data-slot の一覧

- `select` — `Select`（Root）（Radix の Root / Portal など要素を描かない部品。印の属性は渡るが DOM には出ない）
- `select-group` — `SelectGroup`
- `select-value` — `SelectValue`
- `select-trigger` — `SelectTrigger`
- `select-content` — `SelectContent`
- `select-label` — `SelectLabel`
- `select-item` — `SelectItem`
- `select-separator` — `SelectSeparator`
- `select-scroll-up-button` — `SelectScrollUpButton`
- `select-scroll-down-button` — `SelectScrollDownButton`

## Verification

- 一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`
