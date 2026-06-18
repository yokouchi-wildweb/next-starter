"use client"

import Link from "next/link"

import { Tabs, TabsList, TabsTrigger } from "@/components/_shadcn/tabs"
import { Flex } from "@/components/Layout/Flex"
import { Span } from "@/components/TextBlocks/Span"
import { cn } from "@/lib/cn"

import type { PageTabItem, PageTabSize } from "./types"
import { TAB_SIZE_STYLES } from "./types"
import { useActiveTab } from "./useActiveTab"

/**
 * ボタン/背景色型のタブナビゲーション
 *
 * @example
 * const tabs: PageTabItem[] = [
 *   { value: "overview", label: "概要", href: `/admin/projects/${id}` },
 *   { value: "members", label: "メンバー", href: `/admin/projects/${id}/members` },
 *   {
 *     value: "logs",
 *     label: "履歴",
 *     href: `/admin/projects/${id}/logs`,
 *     matcher: (pathname) => pathname.startsWith(`/admin/projects/${id}/logs`),
 *   },
 * ]
 *
 * <SolidTabs tabs={tabs} size="md" ariaLabel="プロジェクト詳細タブ" />
 *
 * - `tabs`: label / href / matcher 等を設定するだけで URL 遷移付きタブを描画。
 * - `size`: xs~xl の高さバリアント。デフォルトは md。
 * - `listAppearanceClassName`: リスト全体の背景・文字色などを上書き（デフォルトは muted 背景＋外枠）。
 * - `activeTriggerClassName` / `activeLabelClassName`: 選択中/未選択タブの背景・枠線・文字色を上書き。
 * - クリック時は Next.js の `Link` を発火するだけなので、フォーム送信や離脱ガードは利用側で制御する。
 */

type SolidTabsProps = {
  tabs: PageTabItem[]
  className?: string
  listClassName?: string
  ariaLabel?: string
  size?: PageTabSize
  listAppearanceClassName?: string
  activeTriggerClassName?: string
  activeLabelClassName?: string
}

export function SolidTabs({
  tabs,
  className,
  listClassName,
  ariaLabel = "ページ内タブ",
  size = "md",
  listAppearanceClassName = "bg-muted text-muted-foreground rounded-md border border-border/70 shadow-xs",
  activeTriggerClassName = "rounded-none first:rounded-l-md last:rounded-r-md border border-border/70 -ml-px first:ml-0 data-[state=inactive]:bg-muted/60 data-[state=inactive]:text-muted-foreground/80 data-[state=inactive]:border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-sm data-[state=active]:z-[1]",
  activeLabelClassName = "text-primary-foreground",
}: SolidTabsProps) {
  const resolvedValue = useActiveTab(tabs)

  if (!tabs.length) {
    return null
  }

  const sizeClassName = TAB_SIZE_STYLES[size]

  return (
    <nav aria-label={ariaLabel} className="w-full">
      <Tabs value={resolvedValue} className={cn("w-full", className)}>
        <TabsList className={cn("w-full", listAppearanceClassName, listClassName)}>
          {tabs.map((tab) => {
            const isActive = tab.value === resolvedValue

            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                asChild
                className={cn("min-w-0", sizeClassName, activeTriggerClassName, tab.className)}
              >
                <Link
                  href={tab.href}
                  prefetch={tab.prefetch}
                  replace={tab.replace}
                  scroll={tab.scroll}
                  target={tab.target}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Flex align="center" justify="center" gap="xs" className="w-full">
                    {tab.icon}
                    <Span
                      weight="normal"
                      className={cn("min-w-0 truncate", isActive && activeLabelClassName)}
                    >
                      {tab.label}
                    </Span>
                  </Flex>
                </Link>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
    </nav>
  )
}
