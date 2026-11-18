# Primitives/Button

## Overview

- ボタンの土台 `Button`・`baseButtonClassName`（asChild = radix-ui の Slot）。完成品は `src/components/Form/Button`。
- 使う時・直す時の決まり(入口・radix-ui・完成品が先・data-slot の約束)は札 .claude/rules/items/components/Primitives.md にある。この README は部品の説明と印の一覧

## API

- `iconSizing`: 既定 `"auto"` = 大きさの class(`size-*`)の無い中の svg を 16px に揃える。`"none"` = 揃えず、呼び手の付けた大きさ(`h-* w-*`・style)のまま(アイコンの大きさを自分で決める押し口: 表のセルの押し口・アバターの押し口など)。`Form/Button` も同じ名前で受ける

## Extension

- fork の CSS は下の一覧の印 `[data-slot="<名前>"]` を狙う。印の数と名前は部品のファイルの物と一致する

### data-slot の一覧

- `button` — `Button` の `<button>`（asChild のときは子の要素）。同じ要素を描く Carousel の前後のボタンは型つきの値 `slot` で自分の名前（`carousel-previous` / `carousel-next`、一覧は Carousel の README）を渡す。下のナビのメニュー項目も `slot` で枠の印 `bottom-nav-item` を渡す（持ち主は枠。一覧は `src/app/(user)/_layout/README.md`、ここには載せない）。表の部品 tableSuite のセルの押し口も `slot` で `cell-click-overlay` を渡す（持ち主は tableSuite、ここには載せない）

## Verification

- 一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`
