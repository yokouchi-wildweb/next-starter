// src/lib/tableSuite/shared/cellClickOverlayStyles.ts

import { cn } from "@/lib/cn";

/**
 * CellClickOverlay のスタイルを生成する(Button/Button variant / size none に渡す)
 * ポップオーバーモードとコールバックモードで共通利用
 */
export const getCellClickOverlayClassName = (
  fullWidth: boolean,
  className?: string,
) =>
  cn(
    "absolute z-10 flex items-center justify-end px-2",
    "cursor-pointer opacity-0 pointer-events-none",
    "group-hover:opacity-100 group-hover:pointer-events-auto",
    "transition-opacity duration-150",
    fullWidth
      ? "inset-0 bg-background/30 hover:bg-background/50"
      : "inset-y-0 right-0 bg-gradient-to-r from-transparent via-transparent to-muted/50",
    "text-muted-foreground hover:text-primary",
    "focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    // 押し口は Button/Button(variant / size none)で描く。Button の土台の角丸・文字の大きさと太さを生の button と同じに戻す(折り返さない whitespace-nowrap はセルの値と同じなので残す)
    "rounded-none text-[length:inherit] font-normal",
    className,
  );
