// src/components/Overlays/Popover/ActionPopover.tsx

"use client";

import { type ReactNode, useState, useCallback } from "react";
import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  type PopoverContentProps,
} from "./PopoverPrimitives";

// アクションアイテムの定義
export type ActionItem = {
  type?: "action";
  /** ラベル */
  label: string;
  /** アイコン（Lucide icon） */
  icon?: LucideIcon;
  /** クリック時のコールバック */
  onClick?: () => void | Promise<void>;
  /** 無効化 */
  disabled?: boolean;
  /** 危険なアクション（赤色表示） */
  variant?: "default" | "destructive";
  /** 説明文 */
  description?: string;
};

export type SeparatorItem = {
  type: "separator";
};

export type ActionPopoverItem = ActionItem | SeparatorItem;

export type ActionPopoverProps = {
  /** ポップオーバーを開くトリガー要素 */
  trigger: ReactNode;
  /** タイトル（省略可） */
  title?: ReactNode;
  /** アクションリスト */
  actions: ActionPopoverItem[];
  /** アクション実行後に自動で閉じるか */
  closeOnAction?: boolean;
  /** triggerにasChildを適用するか */
  asChild?: boolean;
  /** 制御モード: 開閉状態 */
  open?: boolean;
  /** 制御モード: 開閉状態変更コールバック */
  onOpenChange?: (open: boolean) => void;
} & Omit<PopoverContentProps, "children">;

/**
 * アクションメニュー用ポップオーバー
 *
 * @example
 * <ActionPopover
 *   trigger={<IconButton icon={MoreVertical} />}
 *   actions={[
 *     { label: "編集", icon: Edit, onClick: handleEdit },
 *     { label: "複製", icon: Copy, onClick: handleDuplicate },
 *     { type: "separator" },
 *     { label: "削除", icon: Trash, onClick: handleDelete, variant: "destructive" },
 *   ]}
 * />
 */
export function ActionPopover({
  trigger,
  title,
  actions,
  closeOnAction = true,
  asChild = true,
  open: controlledOpen,
  onOpenChange,
  // PopoverContent props
  size = "sm",
  layer,
  showArrow,
  side,
  sideOffset,
  align = "end",
  alignOffset,
  className,
  ...contentProps
}: ActionPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  // 制御/非制御の判定
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (newOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(newOpen);
      } else {
        setInternalOpen(newOpen);
        onOpenChange?.(newOpen);
      }
    },
    [isControlled, onOpenChange]
  );

  const handleAction = useCallback(
    async (action: ActionItem, index: number) => {
      if (action.disabled || !action.onClick) return;

      const result = action.onClick();

      if (result instanceof Promise) {
        setLoadingIndex(index);
        try {
          await result;
          if (closeOnAction) setOpen(false);
        } finally {
          setLoadingIndex(null);
        }
      } else {
        if (closeOnAction) setOpen(false);
      }
    },
    [closeOnAction, setOpen]
  );

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild={asChild}>{trigger}</PopoverTrigger>
      <PopoverContent
        size={size}
        layer={layer}
        showArrow={showArrow}
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className={cn("p-1", className)}
        {...contentProps}
      >
        {title && (
          <PopoverHeader className="mb-1 px-2">
            <PopoverTitle className="text-xs text-muted-foreground font-normal">
              {title}
            </PopoverTitle>
          </PopoverHeader>
        )}
        <div className="flex flex-col">
          {actions.map((item, index) => {
            if (item.type === "separator") {
              return (
                <div
                  key={`separator-${index}`}
                  className="my-1 h-px bg-border"
                />
              );
            }

            const Icon = item.icon;
            const isLoading = loadingIndex === index;
            const isDestructive = item.variant === "destructive";

            return (
              <button
                key={`action-${index}`}
                type="button"
                onClick={() => handleAction(item, index)}
                disabled={item.disabled || isLoading}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  "outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  item.disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer",
                  isDestructive
                    ? "text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                )}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      isLoading && "animate-spin"
                    )}
                  />
                )}
                <span className="flex-1 text-left">
                  {isLoading ? "処理中..." : item.label}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

export default ActionPopover;
