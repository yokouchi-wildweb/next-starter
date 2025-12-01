"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Tabs, TabsList, TabsTrigger } from "@/components/_shadcn/tabs"
import { Flex } from "@/components/Layout/Flex"
import { Span } from "@/components/TextBlocks/Span"
import { cn } from "@/lib/cn"

/**
 * 管理画面などで再利用するタブ型ナビゲーション。
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
 * <PageTabs tabs={tabs} size="md" ariaLabel="プロジェクト詳細タブ" />
 *
 * - `tabs`: label / href / matcher 等を設定するだけで URL 遷移付きタブを描画。
 * - `size`: xs~xl の高さバリアント。デフォルトは md。
 * - `listAppearanceClassName`: リスト全体の背景・文字色などを上書き（デフォルトは muted 背景＋外枠）。
 * - `activeTriggerClassName` / `activeLabelClassName`: 選択中/未選択タブの背景・枠線・文字色を上書き。
 * - クリック時は Next.js の `Link` を発火するだけなので、フォーム送信や離脱ガードは利用側で制御する。
 */

type PageTabMatcher = (pathname: string) => boolean

export type PageTabItem = {
  value: string // Radix Tabs の value（各タブ固有）
  label: ReactNode // 表示ラベル（テキスト or リッチ内容）
  href: string // 遷移先 URL
  icon?: ReactNode // ラベル左に並べる任意のアイコン
  matcher?: PageTabMatcher // アクティブ判定をカスタムしたい場合の関数
  prefetch?: boolean // Next.js Link の prefetch オプション
  replace?: boolean // Link の replace オプション
  scroll?: boolean // Link の scroll オプション
  target?: string // Link の target
  className?: string // TabsTrigger に付与する追加クラス
}

type PageTabsSize = "xs" | "sm" | "md" | "lg" | "xl"

const TAB_SIZE_STYLES: Record<PageTabsSize, string> = {
  xs: "h-9 px-3 text-xs",
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-6 text-base",
  xl: "h-16 px-7 text-lg",
}

type PageTabsProps = {
  tabs: PageTabItem[]
  className?: string
  listClassName?: string
  ariaLabel?: string
  size?: PageTabsSize
  listAppearanceClassName?: string
  activeTriggerClassName?: string
  activeLabelClassName?: string
}

export function PageTabs({
  tabs,
  className,
  listClassName,
  ariaLabel = "ページ内タブ",
  size = "md",
  listAppearanceClassName = "bg-muted text-muted-foreground rounded-md border border-border/70 shadow-xs",
  activeTriggerClassName =
    "rounded-none first:rounded-l-md last:rounded-r-md border border-border/70 -ml-px first:ml-0 data-[state=inactive]:bg-muted/60 data-[state=inactive]:text-muted-foreground/80 data-[state=inactive]:border-border data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-sm data-[state=active]:z-[1]",
  activeLabelClassName = "text-primary-foreground",
}: PageTabsProps) {
  const pathname = usePathname()

  if (!tabs.length) {
    return null
  }

  const resolvedValue =
    tabs.find((tab) => (tab.matcher ? tab.matcher(pathname) : pathname === tab.href))?.value ??
    tabs[0]!.value

  const sizeClassName = TAB_SIZE_STYLES[size]

  return (
    <nav aria-label={ariaLabel}>
      <Tabs value={resolvedValue} className={cn("w-full", className)}>
        <TabsList className={cn("w-full", listAppearanceClassName, listClassName)}>
          {tabs.map((tab) => {
            const isActive = tab.value === resolvedValue

            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                asChild
                className={cn(sizeClassName, activeTriggerClassName, tab.className)}
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
                      className={cn("truncate", isActive && activeLabelClassName)}
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
