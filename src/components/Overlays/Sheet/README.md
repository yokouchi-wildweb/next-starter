# Overlays/Sheet

## Overview

画面の辺から出る板（下のシート・横の引き出し）。Radix Dialog の上に作っているので、フォーカスは板の中に留まり、ESC・背景を押す・閉じるボタンで閉じ、開いている間は裏のスクロールが止まる。閉じている間は描かない。

## Usage

```tsx
import { Sheet } from "@/components/Overlays/Sheet";

<Sheet open={open} onOpenChange={setOpen} side="bottom" title="絞り込み">
  <FilterForm />
</Sheet>
```

## API

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `open` / `onOpenChange` | `boolean` / `(open: boolean) => void` | - | 表示状態と状態変更 |
| `side` | `"bottom" \| "top" \| "left" \| "right"` | `"bottom"` | 出る辺 |
| `title` / `titleSrOnly` | `ReactNode` / `boolean` | - | 題。省略時は sr-only の既定の題（「ダイアログ」） |
| `size` | `number \| string` | bottom / top `"85dvh"`、left / right `"20rem"` | bottom / top = 最大の高さ（中身は板の中でスクロール）、left / right = 幅（画面の幅 - 2rem まで） |
| `className` / `overlayClassName` | `string` | - | 板 / 背景に足すクラス（色・ぼかし・角丸・余白） |
| `container` | `HTMLElement \| null` | - | portal の先の要素（省略 = body）。渡すと背景と板はその要素の中で `absolute` に重なる（スマホ幅の容器の中に出す等） |
| `scrollable` | `boolean` | `true` | 本体をスクロールの箱にするか。`false` = 高さだけ渡し、スクロールと板の外へはみ出す物（横に開く子メニュー等）は中身が持つ |
| `showCloseButton` | `boolean` | `true` | 板の内側の右上の閉じるボタン |
| `handle` | `boolean` | `true` | side bottom のつまみ。つまみを下へ引いて `dismissDistance` を超えて離すと閉じ、超えなければ戻る（つまみだけが引けるので中身のスクロールとは競わない）。bottom 以外では出ない |
| `dismissDistance` | `number` | `120` | 引いて閉じる距離（px） |
| `onOpenAutoFocus` / `onCloseAutoFocus` | `(event: Event) => void` | - | フォーカスの制御（Modal と同じ） |

## Internals

- 印(data-slot): 板 `sheet`・背景 `sheet-overlay`・つまみ `sheet-handle`・閉じるボタン `sheet-close`。板と背景の印は上流の包む部品が型つきの値 `slot` / `overlaySlot` で変える（管理の SP のサイドバーは `admin-sidebar`）。
