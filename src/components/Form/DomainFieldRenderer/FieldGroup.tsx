"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type FieldGroupProps = {
  /** グループラベル */
  label: string;
  /** 子要素（フィールド群） */
  children: ReactNode;
  /** 折りたたみ可能か */
  collapsible?: boolean;
  /** 初期状態で折りたたむか */
  defaultCollapsed?: boolean;
  /** 背景色（CSSカラーコード形式） */
  bgColor?: string;
  /** 追加のクラス名 */
  className?: string;
};

/**
 * フィールドグループコンポーネント
 * フォームフィールドを視覚的にグループ化して表示する
 */
export function FieldGroup({
  label,
  children,
  collapsible = false,
  defaultCollapsed = false,
  bgColor,
  className,
}: FieldGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const handleToggle = () => {
    if (collapsible) {
      setIsCollapsed((prev) => !prev);
    }
  };

  return (
    <fieldset
      className={cn(
        "rounded-lg border border-border p-4",
        !bgColor && "bg-muted/30",
        className,
      )}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <legend
        className={cn(
          "px-2 text-sm font-medium text-foreground",
          collapsible && "cursor-pointer select-none hover:text-primary transition-colors",
        )}
        onClick={handleToggle}
      >
        <span className="flex items-center gap-2">
          {collapsible && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          )}
          {label}
        </span>
      </legend>
      {!isCollapsed && (
        <div className="flex flex-col gap-4 pt-2">
          {children}
        </div>
      )}
    </fieldset>
  );
}
