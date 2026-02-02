// src/lib/tableSuite/shared/CellClickOverlay.tsx

"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/cn";

export type CellClickOverlayProps = {
  /** クリック時のコールバック */
  onClick: () => void;
  /** 右端に表示するインジケーター（デフォルト: 目のアイコン） */
  indicator?: React.ReactNode;
  /** オーバーレイ領域のクラス名 */
  className?: string;
  /** セル全体をクリック領域にする（デフォルト: false） */
  fullWidth?: boolean;
};

const DEFAULT_INDICATOR = <Eye className="size-4 text-muted-foreground" />;

/**
 * セル内に配置するクリック可能なオーバーレイコンポーネント
 * ホバー時にクリック領域とインジケーターを表示する
 */
export function CellClickOverlay({
  onClick,
  indicator = DEFAULT_INDICATOR,
  className,
  fullWidth = false,
}: CellClickOverlayProps) {
  return (
    <button
      type="button"
      data-slot="cell-click-overlay"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute z-10 flex items-center justify-end px-2",
        "cursor-pointer opacity-0 pointer-events-none",
        "group-hover:opacity-100 group-hover:pointer-events-auto",
        "transition-opacity duration-150",
        fullWidth
          ? "inset-0 bg-black/10 hover:bg-black/20"
          : "inset-y-0 right-0 bg-gradient-to-r from-transparent via-transparent to-muted/50",
        "text-muted-foreground hover:text-primary",
        "focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className,
      )}
      aria-label="詳細を表示"
    >
      <span data-slot="cell-click-indicator" className="pointer-events-none">
        {indicator}
      </span>
    </button>
  );
}
