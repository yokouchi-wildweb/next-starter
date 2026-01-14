"use client";

import { useState } from "react";
import Link from "next/link";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";

export type SpNavigationMenuItem = {
  readonly key: string;
  readonly label: string;
  readonly href?: string | null;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly icon?: LucideIcon;
  readonly children?: SpNavigationMenuItem[];
};

export type SpMenuItemProps = {
  readonly item: SpNavigationMenuItem;
  readonly showIcon?: boolean;
  readonly onNavigate?: () => void;
};

const className = {
  action:
    "h-auto w-full justify-start px-3 py-2 text-left transition-colors hover:bg-muted hover:text-primary disabled:opacity-60",
  link: "block rounded-md px-3 py-2 transition-colors hover:bg-muted hover:text-primary",
  trigger:
    "flex w-full items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-muted hover:text-primary cursor-pointer",
  childLink:
    "block rounded-md py-3 pl-8 pr-3 text-sm transition-colors hover:bg-muted hover:text-primary",
} as const;

export const SpMenuItem = ({ item, showIcon = true, onNavigate }: SpMenuItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = item.icon;
  const hasChildren = item.children && item.children.length > 0;
  const isActionItem = typeof item.onClick === "function";

  // アイコン付きラベルのレンダリング
  const renderLabel = () => (
    <span className="inline-flex items-center gap-1.5">
      {showIcon && Icon && <Icon className="size-4" />}
      {item.label}
    </span>
  );

  // 子メニューありの場合はアコーディオン
  if (hasChildren) {
    const href = item.href ?? undefined;
    const hasLink = href != null && href !== "";

    const handleToggle = () => {
      setIsExpanded((prev) => !prev);
    };

    return (
      <div>
        <div className={className.trigger} onClick={handleToggle}>
          {hasLink ? (
            <Link
              href={href}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.();
              }}
              className="flex-1"
            >
              {renderLabel()}
            </Link>
          ) : (
            <span className="flex-1">{renderLabel()}</span>
          )}
          <ChevronDown
            className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {item.children?.map((child) => (
                <li key={child.key}>
                  <SpMenuItemChild item={child} showIcon={showIcon} onNavigate={onNavigate} />
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // アクション（onClick）の場合
  if (isActionItem) {
    const handleClick = () => {
      onNavigate?.();
      item.onClick?.();
    };

    return (
      <Button
        type="button"
        onClick={handleClick}
        disabled={item.disabled}
        variant="ghost"
        className={className.action}
      >
        {renderLabel()}
      </Button>
    );
  }

  // 通常のリンク/非リンクアイテム
  const href = item.href ?? undefined;
  const hasLink = href != null && href !== "";

  if (hasLink) {
    return (
      <Link href={href} onClick={onNavigate} className={className.link}>
        {renderLabel()}
      </Link>
    );
  }

  return <span className={className.link}>{renderLabel()}</span>;
};

// 子アイテム用コンポーネント
type SpMenuItemChildProps = {
  readonly item: SpNavigationMenuItem;
  readonly showIcon?: boolean;
  readonly onNavigate?: () => void;
};

const SpMenuItemChild = ({ item, showIcon = true, onNavigate }: SpMenuItemChildProps) => {
  const Icon = item.icon;
  const href = item.href ?? undefined;
  const hasLink = href != null && href !== "";

  const renderLabel = () => (
    <span className="inline-flex items-center gap-1.5">
      {showIcon && Icon && <Icon className="size-4" />}
      {item.label}
    </span>
  );

  if (hasLink) {
    return (
      <Link href={href} onClick={onNavigate} className={className.childLink}>
        {renderLabel()}
      </Link>
    );
  }

  return <span className={className.childLink}>{renderLabel()}</span>;
};
