// src/lib/tableSuite/shared/CellClickOverlay.tsx

"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { getCellClickOverlayClassName } from "./cellClickOverlayStyles";

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

const DEFAULT_INDICATOR = <Eye className="size-4" />;

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
      className={getCellClickOverlayClassName(fullWidth, className)}
      aria-label="詳細を表示"
    >
      <span data-slot="cell-click-indicator" className="pointer-events-none">
        {indicator}
      </span>
    </button>
  );
}
