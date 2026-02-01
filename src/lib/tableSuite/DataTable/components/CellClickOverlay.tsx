// src/lib/tableSuite/DataTable/components/CellClickOverlay.tsx

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
}: CellClickOverlayProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute inset-y-0 right-0 z-10 flex items-center justify-end px-1 py-3",
        "cursor-pointer opacity-0 pointer-events-none",
        "group-hover:opacity-100 group-hover:pointer-events-auto",
        "bg-gradient-to-r from-transparent via-transparent to-muted/50",
        "transition-opacity duration-150",
        "focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className,
      )}
      aria-label="詳細を表示"
    >
      <span className="pointer-events-none">{indicator}</span>
    </button>
  );
}
