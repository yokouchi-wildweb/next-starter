// src/lib/tableSuite/shared/CellClickOverlay.tsx

"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/Form/Button";
import { InBlock } from "@/components/Layout/InBlock";
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
    <Button
      type="button"
      variant="none"
      size="none"
      iconSizing="none"
      slot="cell-click-overlay"
      // クリックの伝播は下の onClick が止める(Button の既定の止め方には頼らない = 生の button と同じ)
      propagateClick
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={getCellClickOverlayClassName(fullWidth, className)}
      aria-label="詳細を表示"
    >
      <InBlock data-slot="cell-click-indicator" className="pointer-events-none">
        {indicator}
      </InBlock>
    </Button>
  );
}
