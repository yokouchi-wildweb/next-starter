"use client"

import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react"
import { cn } from "@/lib/cn"
import { SliderArrow } from "../_shared/SliderArrow"
import { SliderDots } from "../_shared/SliderDots"
import {
  getCarouselRootA11yProps,
  getLiveRegionA11yProps,
  getSlideA11yProps,
} from "../_shared/a11y"
import { getResponsiveVisibilityClass, isResponsiveToggleVisible } from "../_shared/helpers"
import { useSliderAutoplay } from "../_shared/useSliderAutoplay"
import { useSliderController } from "../_shared/useSliderController"
import { useSliderKeyboard } from "../_shared/useSliderKeyboard"
import { useSliderSwipe } from "../_shared/useSliderSwipe"
import type {
  ArrowPosition,
  ArrowSize,
  ArrowVariant,
  AutoplayOption,
  DotPosition,
  DotVariant,
  RenderArrowProps,
  RenderDotsProps,
  ResponsiveToggle,
  SliderA11yProps,
  SliderControlProps,
  SliderImperativeApi,
} from "../_shared/types"

export type FadeSlideState = {
  isActive: boolean
}

export type FadeTransition =
  | "crossfade"
  | "fadeThrough"
  | {
      kind: "crossfade" | "fadeThrough"
      duration?: number
      easing?: string
      className?: string
    }

export type FadeSliderProps<T> = SliderControlProps & SliderA11yProps & {
  items: T[]
  renderItem: (item: T, index: number, state: FadeSlideState) => ReactNode

  // トランジション
  /** "crossfade" | "fadeThrough"、またはオブジェクトで詳細指定 */
  transition?: FadeTransition
  /** トランジション時間 (ms)。オブジェクト指定の transition.duration が優先 */
  duration?: number
  /** イージング。オブジェクト指定の transition.easing が優先 */
  easing?: string

  // レイアウト
  containerWidth?: number | string
  /** スライド共通ラッパに付与する className。下流カスタム用 */
  slideClassName?: string
  /** viewport に付与する className */
  className?: string

  // 矢印
  showArrows?: ResponsiveToggle
  arrowVariant?: ArrowVariant
  arrowSize?: ArrowSize
  arrowPosition?: ArrowPosition
  renderArrow?: (props: RenderArrowProps) => ReactNode

  // ドット
  showDots?: ResponsiveToggle
  dotVariant?: DotVariant
  dotPosition?: DotPosition
  renderDots?: (props: RenderDotsProps) => ReactNode

  // 操作
  autoplay?: AutoplayOption
  enableKeyboard?: boolean
  enableSwipe?: boolean
  /** 水平スワイプの閾値 (px)。デフォルト 50 */
  swipeThreshold?: number
  /** ホバー/フォーカス中の autoplay 一時停止。デフォルト true */
  pauseOnHover?: boolean
  /** prefers-reduced-motion を尊重する。デフォルト true */
  respectReducedMotion?: boolean

  /** API 予約: 将来ウィンドウ描画を有効化する際に使う。v1 は常に全マウント */
  windowed?: boolean | number

  // コールバック
  onActiveClick?: (item: T, index: number) => void

  // 制御用 ref
  ref?: Ref<SliderImperativeApi>
}

const arrowPositionStyles = {
  inside: { prev: "left-0", next: "right-0" },
  outside: { prev: "right-full mr-2", next: "left-full ml-2" },
} as const

function normalizeTransition(
  transition: FadeTransition | undefined,
  baseDuration: number,
  baseEasing: string,
) {
  if (!transition) {
    return { kind: "crossfade" as const, duration: baseDuration, easing: baseEasing, className: undefined }
  }
  if (typeof transition === "string") {
    return { kind: transition, duration: baseDuration, easing: baseEasing, className: undefined }
  }
  return {
    kind: transition.kind,
    duration: transition.duration ?? baseDuration,
    easing: transition.easing ?? baseEasing,
    className: transition.className,
  }
}

export function FadeSlider<T>({
  items,
  renderItem,

  transition,
  duration = 400,
  easing = "ease-in-out",

  containerWidth,
  slideClassName,
  className,

  showArrows = true,
  arrowVariant = "light",
  arrowSize = "md",
  arrowPosition = "inside",
  renderArrow,

  showDots = true,
  dotVariant = "default",
  dotPosition = "bottom",
  renderDots,

  autoplay,
  enableKeyboard = true,
  enableSwipe = true,
  swipeThreshold = 50,
  pauseOnHover = true,
  respectReducedMotion = true,

  onActiveClick,

  defaultIndex,
  index: controlledIndex,
  onIndexChange,
  loop = false,

  ariaLabel,
  ariaRoleDescription,

  ref,
}: FadeSliderProps<T>) {
  const sliderId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)

  const controller = useSliderController({
    count: items.length,
    defaultIndex,
    index: controlledIndex,
    onIndexChange,
    loop,
  })

  const t = normalizeTransition(transition, duration, easing)

  const autoplayControls = useSliderAutoplay({
    autoplay,
    onTick: controller.next,
    pauseOnHover,
    reducedMotion: respectReducedMotion,
    targetRef: rootRef,
  })

  useSliderKeyboard({
    enabled: enableKeyboard,
    targetRef: rootRef,
    onPrev: () => {
      autoplayControls.stopForInteraction()
      controller.prev()
    },
    onNext: () => {
      autoplayControls.stopForInteraction()
      controller.next()
    },
    onHome: () => {
      autoplayControls.stopForInteraction()
      controller.goTo(0)
    },
    onEnd: () => {
      autoplayControls.stopForInteraction()
      controller.goTo(items.length - 1)
    },
  })

  useSliderSwipe({
    enabled: enableSwipe,
    targetRef: rootRef,
    threshold: swipeThreshold,
    onSwipeLeft: controller.next,
    onSwipeRight: controller.prev,
    onSwipeStart: autoplayControls.stopForInteraction,
  })

  useImperativeHandle(
    ref,
    () => ({
      next: controller.next,
      prev: controller.prev,
      goTo: controller.goTo,
      play: autoplayControls.play,
      pause: autoplayControls.pause,
      getState: () => ({
        index: controller.index,
        count: controller.count,
        playing: autoplayControls.playing,
      }),
    }),
    [controller, autoplayControls]
  )

  const handleDotClick = useCallback(
    (i: number) => {
      autoplayControls.stopForInteraction()
      controller.goTo(i)
    },
    [controller, autoplayControls]
  )

  if (items.length === 0) return null

  const arrowsVisible = isResponsiveToggleVisible(showArrows)
  const dotsVisible = isResponsiveToggleVisible(showDots)
  const arrowResponsiveClass = getResponsiveVisibilityClass(showArrows)
  const dotsResponsiveClass = getResponsiveVisibilityClass(showDots)

  const renderArrowElement = (direction: "prev" | "next") => {
    const isPrev = direction === "prev"
    const canGo = isPrev ? controller.canPrev : controller.canNext
    const onClick = () => {
      autoplayControls.stopForInteraction()
      if (isPrev) controller.prev()
      else controller.next()
    }
    const posClass = isPrev ? arrowPositionStyles[arrowPosition].prev : arrowPositionStyles[arrowPosition].next
    const wrapperBase = "absolute top-1/2 -translate-y-1/2 z-10"

    if (renderArrow) {
      return (
        <div className={cn(wrapperBase, posClass, arrowResponsiveClass)}>
          {renderArrow({ direction, onClick, disabled: !canGo })}
        </div>
      )
    }
    if (!canGo) return null
    return (
      <div className={cn(wrapperBase, posClass, arrowResponsiveClass)}>
        <SliderArrow direction={direction} onClick={onClick} variant={arrowVariant} size={arrowSize} />
      </div>
    )
  }

  const viewportStyle: CSSProperties = {
    display: "grid",
    ...(containerWidth ? { width: containerWidth, marginLeft: "auto", marginRight: "auto" } : {}),
  }

  const styleTag = buildFadeSliderStyle(sliderId, t.kind, t.duration, t.easing)

  return (
    <div
      ref={rootRef}
      data-fade-slider-id={sliderId}
      data-transition={t.kind}
      tabIndex={enableKeyboard ? 0 : undefined}
      style={containerWidth ? { width: containerWidth, marginLeft: "auto", marginRight: "auto" } : undefined}
      className={cn("outline-none focus-visible:ring-2 focus-visible:ring-ring rounded", className)}
      {...getCarouselRootA11yProps({ ariaLabel, ariaRoleDescription })}
      {...getLiveRegionA11yProps(!!autoplay)}
    >
      <style dangerouslySetInnerHTML={{ __html: styleTag }} />
      <div className="relative">
        {arrowsVisible && renderArrowElement("prev")}

        <div
          style={viewportStyle}
          className="relative"
          data-fade-viewport={sliderId}
        >
          {items.map((item, index) => {
            const isActive = index === controller.index
            return (
              <div
                key={index}
                data-active={isActive}
                data-fade-slide={sliderId}
                {...getSlideA11yProps({ index, count: controller.count, isActive })}
                onClick={isActive ? () => onActiveClick?.(item, index) : undefined}
                className={cn(
                  isActive && onActiveClick ? "cursor-pointer" : undefined,
                  t.className,
                  slideClassName,
                )}
                style={{ gridArea: "1 / 1" }}
              >
                {renderItem(item, index, { isActive })}
              </div>
            )
          })}
        </div>

        {arrowsVisible && renderArrowElement("next")}

        {dotsVisible && dotPosition === "inside-bottom" && (
          <div className={cn("absolute bottom-2 left-0 right-0 z-10", dotsResponsiveClass)}>
            {renderDots ? (
              renderDots({ count: controller.count, current: controller.index, onDotClick: handleDotClick })
            ) : (
              <SliderDots
                count={controller.count}
                current={controller.index}
                onDotClick={handleDotClick}
                variant={dotVariant}
              />
            )}
          </div>
        )}
      </div>

      {dotsVisible && dotPosition === "bottom" && (
        <div className={cn("mt-4", dotsResponsiveClass)}>
          {renderDots ? (
            renderDots({ count: controller.count, current: controller.index, onDotClick: handleDotClick })
          ) : (
            <SliderDots
              count={controller.count}
              current={controller.index}
              onDotClick={handleDotClick}
              variant={dotVariant}
            />
          )}
        </div>
      )}
    </div>
  )
}

function buildFadeSliderStyle(
  id: string,
  kind: "crossfade" | "fadeThrough",
  duration: number,
  easing: string,
): string {
  const selector = `[data-fade-slider-id="${id}"]`
  const slideSelector = `[data-fade-slide="${id}"]`
  const half = Math.max(1, Math.round(duration / 2))

  const baseRules =
    `${selector} ${slideSelector} {` +
    ` opacity: 0;` +
    ` pointer-events: none;` +
    ` transition-property: opacity;` +
    ` transition-timing-function: ${easing};` +
    `}` +
    `${selector} ${slideSelector}[data-active="true"] {` +
    ` opacity: 1;` +
    ` pointer-events: auto;` +
    `}`

  const timingRules =
    kind === "fadeThrough"
      ? `${selector} ${slideSelector} { transition-duration: ${half}ms; }` +
        `${selector} ${slideSelector}[data-active="true"] { transition-delay: ${half}ms; }`
      : `${selector} ${slideSelector} { transition-duration: ${duration}ms; transition-delay: 0ms; }`

  const reducedMotion =
    `@media (prefers-reduced-motion: reduce) {` +
    ` ${selector} ${slideSelector} {` +
    ` transition-duration: 0ms !important;` +
    ` transition-delay: 0ms !important;` +
    ` }` +
    `}`

  return baseRules + timingRules + reducedMotion
}
