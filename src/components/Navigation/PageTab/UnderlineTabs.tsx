"use client"

import Link from "next/link"

import { Flex } from "@/components/Layout/Flex"
import { Span } from "@/components/TextBlocks/Span"
import { cn } from "@/lib/cn"

import type { PageTabItem, PageTabSize } from "./types"
import { useActiveTab } from "./useActiveTab"

/**
 * 下線型のタブナビゲーション
 *
 * @example
 * const tabs: PageTabItem[] = [
 *   { value: "pending", label: "未発送", href: "/orders?status=pending" },
 *   { value: "waiting", label: "発送待ち", href: "/orders?status=waiting" },
 *   { value: "shipped", label: "発送済み", href: "/orders?status=shipped" },
 * ]
 *
 * <UnderlineTabs tabs={tabs} size="md" ariaLabel="注文ステータスタブ" />
 */

const UNDERLINE_SIZE_STYLES: Record<PageTabSize, string> = {
  xs: "py-2 px-3 text-xs",
  sm: "py-2.5 px-4 text-sm",
  md: "py-3 px-5 text-sm",
  lg: "py-3.5 px-6 text-base",
  xl: "py-4 px-7 text-lg",
}

type UnderlineTabsProps = {
  tabs: PageTabItem[]
  className?: string
  ariaLabel?: string
  size?: PageTabSize
  /** アクティブ時の下線の色クラス */
  activeUnderlineClassName?: string
  /** アクティブ時のテキスト色クラス */
  activeTextClassName?: string
  /** 非アクティブ時のテキスト色クラス */
  inactiveTextClassName?: string
}

export function UnderlineTabs({
  tabs,
  className,
  ariaLabel = "ページ内タブ",
  size = "md",
  activeUnderlineClassName = "bg-primary",
  activeTextClassName = "text-primary",
  inactiveTextClassName = "text-muted-foreground hover:text-foreground/80",
}: UnderlineTabsProps) {
  const resolvedValue = useActiveTab(tabs)

  if (!tabs.length) {
    return null
  }

  const sizeClassName = UNDERLINE_SIZE_STYLES[size]

  return (
    <nav aria-label={ariaLabel} className={cn("w-full border-b border-border", className)}>
      <ul className="flex list-none">
        {tabs.map((tab) => {
          const isActive = tab.value === resolvedValue

          return (
            <li key={tab.value} className="relative flex-1 min-w-0">
              <Link
                href={tab.href}
                prefetch={tab.prefetch}
                replace={tab.replace}
                scroll={tab.scroll}
                target={tab.target}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block transition-colors",
                  sizeClassName,
                  isActive ? activeTextClassName : inactiveTextClassName,
                  tab.className
                )}
              >
                <Flex align="center" justify="center" gap="xs">
                  {tab.icon}
                  <Span weight={isActive ? "medium" : "normal"} tone="inherit" className="min-w-0 truncate">
                    {tab.label}
                  </Span>
                </Flex>
              </Link>
              {/* アクティブ時の下線 */}
              {isActive && (
                <span
                  className={cn(
                    "absolute bottom-0 left-0 right-0 h-0.5",
                    activeUnderlineClassName
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
