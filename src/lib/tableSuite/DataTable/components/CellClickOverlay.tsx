// src/lib/tableSuite/DataTable/components/CellClickOverlay.tsx

"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/cn";

export type CellClickOverlayProps = {
  /**
   * クリック時のコールバック
   */
  onClick: () => void;
  /**
   * 右端に表示するインジケーター。
   * デフォルト: 目のアイコン
   * ReactNode を渡すことで自由にカスタマイズ可能
   */
  indicator?: React.ReactNode;
  /**
   * オーバーレイ領域のクラス名
   */
  className?: string;
};

/**
 * セル内に配置するクリック可能なオーバーレイコンポーネント
 *
 * - ホバー時にセル全体を覆うクリック領域を表示
 * - 右端にインジケーター（デフォルト: 目のアイコン）を表示
 * - クリックしやすいようにセル全体がクリック領域になる
 *
 * @example
 * <TableCell className="relative">
 *   <span>セルの内容</span>
 *   <CellClickOverlay onClick={() => openDetail(item)} />
 * </TableCell>
 */
export function CellClickOverlay({
  onClick,
  indicator,
  className,
}: CellClickOverlayProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const defaultIndicator = (
    <Eye className="size-4 text-muted-foreground group-hover/cell-overlay:text-foreground transition-colors" />
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        // 基本レイアウト: セルの右端に配置
        "absolute inset-y-0 right-0 z-10",
        "flex items-center justify-end",
        "px-1 py-3",
        "cursor-pointer",
        // 非ホバー時: 透明
        "opacity-0 pointer-events-none",
        // ホバー時: 表示してクリック可能に
        "group-hover:opacity-100 group-hover:pointer-events-auto",
        // 背景グラデーション（右側にインジケーターが見えやすいように）
        "bg-gradient-to-r from-transparent via-transparent to-muted/50",
        // トランジション
        "transition-opacity duration-150",
        // フォーカス時のスタイル
        "focus-visible:opacity-100 focus-visible:pointer-events-auto",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        // グループ名（インジケーターのホバースタイル用）
        "group/cell-overlay",
        className,
      )}
      aria-label="詳細を表示"
    >
      <span className="pointer-events-none">
        {indicator ?? defaultIndicator}
      </span>
    </button>
  );
}
