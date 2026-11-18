# Primitives/Command

## Overview

- コマンドパレット（検索付きリスト、cmdk）。フォームの検索付き選択は `Form/Input/Manual` の `ComboboxInput` など。
- 使う時・直す時の決まり(入口・radix-ui・完成品が先・data-slot の約束)は札 .claude/rules/items/components/Primitives.md にある。この README は部品の説明と印の一覧

## Extension

- fork の CSS は下の一覧の印 `[data-slot="<名前>"]` を狙う。印の数と名前は部品のファイルの物と一致する

### data-slot の一覧

- `command` — `Command` の根
- `command-input-wrapper` — `CommandInput` の外枠（検索アイコンと入力）
- `command-input` — `CommandInput` の入力
- `command-list` — `CommandList`
- `command-empty` — `CommandEmpty`
- `command-group` — `CommandGroup`
- `command-separator` — `CommandSeparator`
- `command-item` — `CommandItem`
- `command-shortcut` — `CommandShortcut`

## Verification

- 一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`
