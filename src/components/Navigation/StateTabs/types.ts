import type { ReactNode } from "react"

/**
 * 状態切り替えタブのアイテム定義
 */
export type StateTabItem = {
  /** 各タブ固有の識別子 */
  value: string
  /** 表示ラベル */
  label: ReactNode
  /** ラベル左に並べる任意のアイコン */
  icon?: ReactNode
  /** 無効化 */
  disabled?: boolean
  /** 個別タブに付与する追加クラス */
  className?: string
}

/**
 * タブのサイズバリアント
 */
export type StateTabSize = "xs" | "sm" | "md" | "lg" | "xl"

/**
 * サイズごとのスタイル定義
 */
export const STATE_TAB_SIZE_STYLES: Record<StateTabSize, string> = {
  xs: "h-8 px-2.5 text-xs",
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
  xl: "h-12 px-6 text-lg",
}
