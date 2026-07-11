// src/components/Overlays/Tooltip/HelpTip.tsx

"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";

import { cn } from "@/lib/cn";

import { Tooltip, type TooltipLayer } from "./Tooltip";

const ICON_SIZE_CLASS = {
  sm: "size-3",
  md: "size-3.5",
  lg: "size-4",
};

export type HelpTipProps = {
  /** 表示ラベル（テーブルヘッダー名など） */
  label: React.ReactNode;
  /** ホバー/タップで表示する説明文 */
  help: React.ReactNode;
  /** ヘルプアイコンのサイズ */
  iconSize?: "sm" | "md" | "lg";
  /** ツールチップの表示位置 */
  side?: "top" | "right" | "bottom" | "left";
  /** z-indexレイヤー */
  layer?: TooltipLayer;
  /** ラッパーの追加クラス */
  className?: string;
  /** アイコンの追加クラス */
  iconClassName?: string;
  /** ツールチップコンテンツの追加クラス */
  contentClassName?: string;
};

/**
 * ラベル + ヘルプアイコン + ホバー説明
 *
 * テーブルヘッダーやフォームラベルなど「名前だけでは意味が伝わらない項目」に
 * ?アイコン付きのホバー説明を添える。デスクトップはホバー、
 * タッチデバイスはタップで開閉（Radix Tooltip はタップでは開かないため自前制御）。
 *
 * クリックで開く操作性が必要な場合や長文・リッチコンテンツは InfoPopover を使う。
 *
 * @example
 * // DataTable のヘッダー
 * {
 *   header: <HelpTip label="詳細CTR" help="詳細クリック ÷ インプレッション" />,
 *   render: ...
 * }
 */
export function HelpTip({
  label,
  help,
  iconSize = "md",
  side = "top",
  layer,
  className,
  iconClassName,
  contentClassName,
}: HelpTipProps) {
  const [open, setOpen] = React.useState(false);
  // タップ判定用: pointerdown 時点の pointerType と開閉状態を保持し、
  // click 発火までの間に Radix が閉じても正しくトグルできるようにする
  const lastPointerType = React.useRef("");
  const wasOpenAtPointerDown = React.useRef(false);

  return (
    <Tooltip
      content={help}
      open={open}
      onOpenChange={setOpen}
      side={side}
      layer={layer}
      className={contentClassName}
    >
      <span
        tabIndex={0}
        onPointerDown={(e) => {
          lastPointerType.current = e.pointerType;
          wasOpenAtPointerDown.current = open;
        }}
        onClick={() => {
          if (lastPointerType.current !== "touch") return;
          setOpen(!wasOpenAtPointerDown.current);
        }}
        className={cn(
          "inline-flex items-center gap-1 cursor-help",
          className
        )}
      >
        {label}
        <HelpCircle
          className={cn(
            "shrink-0 text-muted-foreground",
            ICON_SIZE_CLASS[iconSize],
            iconClassName
          )}
        />
      </span>
    </Tooltip>
  );
}

export default HelpTip;
