// src/components/Primitives/Dialog/DialogBare.ts
// 見た目も印(data-slot)も持たない Radix Dialog の部品。自分で形を描く板(Overlays/Sheet など)が使う。
// 印・class・イベントは呼び手が渡す(DialogBase の部品は印を固定で付けるので、呼び手の印を残したいときはこちら)

"use client";

import { Dialog as RadixDialog } from "radix-ui";

/** 幕(Radix Dialog.Overlay そのまま) */
export const DialogBareOverlay = RadixDialog.Overlay;
/** 本体(Radix Dialog.Content そのまま) */
export const DialogBareContent = RadixDialog.Content;
/** 閉じる操作(Radix Dialog.Close そのまま) */
export const DialogBareClose = RadixDialog.Close;
