import type { ReactNode } from "react"

/** boolean: 常時表示/非表示 | ブレークポイント文字列: 指定以上で表示 */
export type ResponsiveToggle = boolean | "sm" | "md" | "lg" | "xl" | "2xl"

export type ArrowVariant = "light" | "dark" | "outline" | "ghost"
export type ArrowSize = "sm" | "md" | "lg"
export type ArrowPosition = "inside" | "outside"

export type RenderArrowProps = {
  direction: "prev" | "next"
  onClick: () => void
  disabled: boolean
}

export type DotVariant = "default" | "line" | "dash"
export type DotPosition = "bottom" | "inside-bottom"

export type RenderDotsProps = {
  count: number
  current: number
  onDotClick: (index: number) => void
}

/** 自動再生の共通オプション */
export type AutoplayOption = boolean | {
  /** 自動再生の間隔（ms）。デフォルト: 4000 */
  delay?: number
  /** ユーザー操作時に自動再生を停止する。デフォルト: true */
  stopOnInteraction?: boolean
}

/** 端のフェードマスク（ScrollSlider用） */
export type MaskOption = boolean | {
  /** 左端のフェード幅（%）。0でフェードなし。デフォルト: 10 */
  left?: number
  /** 右端のフェード幅（%）。0でフェードなし。デフォルト: 10 */
  right?: number
}

/** アニメーションのタイミング設定 */
export type TransitionTiming = {
  /** トランジション時間（ms） */
  duration?: number
  /** イージング関数 */
  easing?: string
}

/**
 * すべてのスライダーが実装する状態制御の契約。
 * controlled（`index` を渡す）/ uncontrolled（`defaultIndex` のみ）のどちらでも使える。
 */
export type SliderControlProps = {
  /** 初期 index（uncontrolled 時のみ使用） */
  defaultIndex?: number
  /** controlled 時の現在 index */
  index?: number
  /** index 変更時のコールバック */
  onIndexChange?: (index: number) => void
  /** 無限ループ */
  loop?: boolean
}

/**
 * すべてのスライダーが ref 経由で公開する命令型 API。
 * autoplay が設定されていない場合でも play/pause は no-op として存在する。
 */
export type SliderImperativeApi = {
  next: () => void
  prev: () => void
  goTo: (index: number) => void
  /** autoplay 未設定時は no-op */
  play: () => void
  /** autoplay 未設定時は no-op */
  pause: () => void
  getState: () => { index: number; count: number; playing: boolean }
}

/** a11y 関連の上書き用 props */
export type SliderA11yProps = {
  /** カルーセル全体の aria-label */
  ariaLabel?: string
  /** aria-roledescription の上書き（デフォルト "carousel"） */
  ariaRoleDescription?: string
}

/** RenderItem のベースシグネチャ（スライダー種別ごとに state を拡張する） */
export type RenderItem<T, State = unknown> = (item: T, index: number, state: State) => ReactNode
