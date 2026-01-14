/**
 * SP用メニューアイテム
 *
 * アコーディオン対応
 */

"use client";

import { useState } from "react";
import Link from "next/link";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";

import { ACCORDION_TRANSITION, accordionVariants } from "../animations";
import { MenuItemLabel } from "../MenuItemLabel";
import { MenuItemLink } from "../MenuItemLink";
import { hasChildren, isActionItem, hasValidHref } from "../types";
import type { NavigationMenuItem } from "../types";

export type SpMenuItemProps = {
  readonly item: NavigationMenuItem;
  readonly showIcon?: boolean;
  readonly onNavigate?: () => void;
};

const styles = {
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

  // 子メニューありの場合はアコーディオン
  if (hasChildren(item)) {
    const handleToggle = () => {
      setIsExpanded((prev) => !prev);
    };

    return (
      <div id={`header-sp-accordion-${item.key}`}>
        <div id={`header-sp-accordion-trigger-${item.key}`} className={styles.trigger} onClick={handleToggle}>
          {hasValidHref(item.href) ? (
            <Link
              id={`header-sp-accordion-link-${item.key}`}
              href={item.href}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate?.();
              }}
              className="flex-1"
            >
              <MenuItemLabel label={item.label} icon={item.icon} showIcon={showIcon} />
            </Link>
          ) : (
            <span id={`header-sp-accordion-label-${item.key}`} className="flex-1">
              <MenuItemLabel label={item.label} icon={item.icon} showIcon={showIcon} />
            </span>
          )}
          <ChevronDown
            className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.ul
              id={`header-sp-accordion-children-${item.key}`}
              variants={accordionVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={ACCORDION_TRANSITION}
              className="overflow-hidden"
            >
              {item.children?.map((child) => (
                <li key={child.key} id={`header-sp-accordion-child-${child.key}`}>
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
  if (isActionItem(item)) {
    const handleClick = () => {
      onNavigate?.();
      item.onClick?.();
    };

    return (
      <Button
        id={`header-sp-action-${item.key}`}
        type="button"
        onClick={handleClick}
        disabled={item.disabled}
        variant="ghost"
        className={styles.action}
      >
        <MenuItemLabel label={item.label} icon={item.icon} showIcon={showIcon} />
      </Button>
    );
  }

  // 通常のリンク/非リンクアイテム
  return (
    <MenuItemLink id={`header-sp-link-${item.key}`} href={item.href} className={styles.link} onClick={onNavigate}>
      <MenuItemLabel label={item.label} icon={item.icon} showIcon={showIcon} />
    </MenuItemLink>
  );
};

// 子アイテム用コンポーネント
type SpMenuItemChildProps = {
  readonly item: NavigationMenuItem;
  readonly showIcon?: boolean;
  readonly onNavigate?: () => void;
};

const SpMenuItemChild = ({ item, showIcon = true, onNavigate }: SpMenuItemChildProps) => (
  <MenuItemLink id={`header-sp-child-link-${item.key}`} href={item.href} className={styles.childLink} onClick={onNavigate}>
    <MenuItemLabel label={item.label} icon={item.icon} showIcon={showIcon} />
  </MenuItemLink>
);
