"use client"

import { useState, type ReactNode } from "react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/Primitives/Tabs"
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

/** タブの見た目。segment = 背景の上の塗りのタブ(既定) | underline = 下の境界線と選んだタブの下線(PageTab の UnderlineTabs と同じ形) */
export type StateTabsVariant = "segment" | "underline"

const VARIANT_DEFAULTS: Record<
  StateTabsVariant,
  { listAppearanceClassName: string; triggerClassName: string; activeLabelClassName: string }
> = {
  segment: {
    listAppearanceClassName: "bg-muted text-muted-foreground rounded-md border border-border/70 p-1",
    triggerClassName:
      "rounded-sm data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground/80 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
    activeLabelClassName: "text-primary-foreground",
  },
  underline: {
    listAppearanceClassName: "h-auto rounded-none border-b border-border bg-transparent p-0",
    triggerClassName:
      "relative rounded-none border-0 bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=inactive]:text-muted-foreground hover:text-foreground/80 data-[state=active]:text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:after:bg-primary",
    activeLabelClassName: "text-primary font-medium",
  },
}

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
  /** 見た目(既定 "segment" = 今の形)。外観のクラスを渡せばそれが勝つ */
  variant?: StateTabsVariant
  /** タブの列と同じ行の右端に置く物(絞り込みのボタン・追加の入力等)。列は残りの幅で縮む */
  listEnd?: ReactNode
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
  variant = "segment",
  listAppearanceClassName = VARIANT_DEFAULTS[variant].listAppearanceClassName,
  triggerClassName = VARIANT_DEFAULTS[variant].triggerClassName,
  activeLabelClassName = VARIANT_DEFAULTS[variant].activeLabelClassName,
  listEnd,
}: StateTabsProps) {
  // 非制御モードでも現在値をここで持つ(アクティブなラベルのクラスを現在値で決めるため)
  const [internalValue, setInternalValue] = useState(defaultValue ?? tabs[0]?.value)
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  if (!tabs.length) {
    return null
  }

  const sizeClassName = STATE_TAB_SIZE_STYLES[size]

  const handleValueChange = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue)
    }
    onValueChange?.(nextValue)
  }

  const tabList = (
    <TabsList className={cn("w-full", listAppearanceClassName, listClassName)}>
      {tabs.map((tab) => {
        const isActive = tab.value === currentValue

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
  )

  return (
    <Tabs
      value={currentValue}
      onValueChange={handleValueChange}
      className={cn("w-full", className)}
    >
      <nav aria-label={ariaLabel}>
        {listEnd == null ? (
          tabList
        ) : (
          <Flex align="center" gap="md" className="w-full">
            <div className="min-w-0 flex-1">{tabList}</div>
            <div className="shrink-0">{listEnd}</div>
          </Flex>
        )}
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
