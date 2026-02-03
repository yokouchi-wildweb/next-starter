"use client"

import type { ReactNode } from "react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/_shadcn/tabs"
import { Flex } from "@/components/Layout/Flex"
import { Span } from "@/components/TextBlocks/Span"
import { cn } from "@/lib/cn"

import type { StateTabItem, StateTabSize } from "./types"
import { STATE_TAB_SIZE_STYLES } from "./types"

/**
 * 状態切り替え用タブコンポーネント
 *
 * URL遷移を伴わないページ内タブ切り替えに使用する。
 *
 * @example
 * ```tsx
 * <StateTabs
 *   tabs={[
 *     { value: "log", label: "抽選ログ", icon: <ScrollText className="size-4" /> },
 *     { value: "stock", label: "在庫状況", icon: <Package className="size-4" /> },
 *   ]}
 *   defaultValue="log"
 *   onValueChange={(value) => console.log(value)}
 * >
 *   <StateTabsContent value="log">
 *     <LogPanel />
 *   </StateTabsContent>
 *   <StateTabsContent value="stock">
 *     <StockPanel />
 *   </StateTabsContent>
 * </StateTabs>
 * ```
 */

type StateTabsProps = {
  /** タブ定義の配列 */
  tabs: StateTabItem[]
  /** 子要素（StateTabsContent を配置） */
  children: ReactNode
  /** 制御モード用の現在値 */
  value?: string
  /** 非制御モード用の初期値 */
  defaultValue?: string
  /** タブ変更時のコールバック */
  onValueChange?: (value: string) => void
  /** タブのサイズ */
  size?: StateTabSize
  /** ルート要素のクラス */
  className?: string
  /** タブリストのクラス */
  listClassName?: string
  /** タブリストの aria-label */
  ariaLabel?: string
  /** タブリスト全体の外観クラス */
  listAppearanceClassName?: string
  /** 各トリガーの外観クラス */
  triggerClassName?: string
  /** アクティブ時のラベルクラス */
  activeLabelClassName?: string
}

export function StateTabs({
  tabs,
  children,
  value,
  defaultValue,
  onValueChange,
  size = "md",
  className,
  listClassName,
  ariaLabel = "タブ切り替え",
  listAppearanceClassName = "bg-muted text-muted-foreground rounded-md border border-border/70 p-1",
  triggerClassName = "rounded-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
  activeLabelClassName = "text-primary-foreground",
}: StateTabsProps) {
  if (!tabs.length) {
    return null
  }

  const resolvedDefaultValue = defaultValue ?? tabs[0]?.value
  const sizeClassName = STATE_TAB_SIZE_STYLES[size]

  return (
    <Tabs
      value={value}
      defaultValue={value === undefined ? resolvedDefaultValue : undefined}
      onValueChange={onValueChange}
      className={cn("w-full", className)}
    >
      <nav aria-label={ariaLabel}>
        <TabsList className={cn("w-full", listAppearanceClassName, listClassName)}>
          {tabs.map((tab) => {
            const isControlled = value !== undefined
            const isActive = isControlled
              ? tab.value === value
              : tab.value === resolvedDefaultValue

            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={tab.disabled}
                className={cn(sizeClassName, triggerClassName, tab.className)}
              >
                <Flex align="center" justify="center" gap="xs" className="w-full">
                  {tab.icon}
                  <Span
                    weight="normal"
                    className={cn(
                      "truncate",
                      isActive && activeLabelClassName
                    )}
                  >
                    {tab.label}
                  </Span>
                </Flex>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </nav>
      {children}
    </Tabs>
  )
}

/**
 * StateTabs のコンテンツパネル
 */
type StateTabsContentProps = {
  /** タブの value と対応する識別子 */
  value: string
  /** コンテンツ */
  children: ReactNode
  /** 追加クラス */
  className?: string
  /** 非アクティブ時もDOMに保持するか */
  forceMount?: boolean
}

export function StateTabsContent({
  value,
  children,
  className,
  forceMount,
}: StateTabsContentProps) {
  return (
    <TabsContent
      value={value}
      forceMount={forceMount ? true : undefined}
      className={cn(
        "w-full",
        className,
        forceMount && "data-[state=inactive]:hidden"
      )}
    >
      {children}
    </TabsContent>
  )
}
