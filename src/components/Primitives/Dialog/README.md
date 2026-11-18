# Primitives/Dialog

## Overview

- ダイアログの低レベル部品（`DialogBase.tsx` = shadcn の部品、`Dialog.tsx` = 層・ネストの判定を足した公開の部品 `DialogPrimitives` など）。印は `DialogBase.tsx` が付け、`Dialog.tsx` は包むだけ。完成品は `src/components/Overlays`（`Dialog` / `Modal` …）。
- 使う時・直す時の決まり(入口・radix-ui・完成品が先・data-slot の約束)は札 .claude/rules/items/components/Primitives.md にある。この README は部品の説明と印の一覧

## API

- `DialogContent` の省略できる指定(層は選べず、いつも `floating`): `overlayClassName`（背景に足すクラス）、`container`（portal の先の要素。渡すと背景と本体は `absolute`）、`closeButtonClassName`（右上の閉じるボタンに足すクラス）、`fullscreen`（全画面。Modal と Dialog の `fullscreen` はこれを渡す）。どれも省略時の出力は変わらない

## Extension

- fork の CSS は下の一覧の印 `[data-slot="<名前>"]` を狙う。印の数と名前は部品のファイルの物と一致する

### data-slot の一覧

- `dialog` — `DialogPrimitives`（Root）（Radix の Root / Portal など要素を描かない部品。印の属性は渡るが DOM には出ない）
- `dialog-trigger` — `DialogTrigger`
- `dialog-portal` — `DialogPortal`（Radix の Root / Portal など要素を描かない部品。印の属性は渡るが DOM には出ない）
- `dialog-close` — `DialogClose`・`DialogContent` の右上の閉じるボタン
- `dialog-overlay` — `DialogOverlay`（幕）
- `dialog-content` — `DialogContent`
- `dialog-header` — `DialogHeader`
- `dialog-footer` — `DialogFooter`
- `dialog-title` — `DialogTitle`
- `dialog-description` — `DialogDescription`

## Verification

- 一覧と部品のファイルの印の照合: `pnpm test src/components/Primitives/slots.test.mjs`
