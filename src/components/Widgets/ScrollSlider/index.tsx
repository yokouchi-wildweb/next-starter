"use client"

import {
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import useEmblaCarousel from "embla-carousel-react"
import AutoplayPlugin from "embla-carousel-autoplay"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/_shadcn/carousel"
import { cn } from "@/lib/cn"
import { SliderArrow } from "../_shared/SliderArrow"
import { SliderDots } from "../_shared/SliderDots"
import {
  getCarouselRootA11yProps,
  getLiveRegionA11yProps,
} from "../_shared/a11y"
import { getResponsiveVisibilityClass, isResponsiveToggleVisible } from "../_shared/helpers"
import type {
  ArrowPosition,
  ArrowSize,
  ArrowVariant,
  AutoplayOption,
  DotPosition,
  DotVariant,
  MaskOption,
  RenderArrowProps,
  RenderDotsProps,
  ResponsiveToggle,
  SliderA11yProps,
  SliderControlProps,
  SliderImperativeApi,
} from "../_shared/types"

type EmblaPlugins = Parameters<typeof useEmblaCarousel>[1]

export type ScrollSlideState = {
  isActive: boolean
}

export type ResponsiveSlideSize = {
  default: string
  sm?: string
  md?: string
  lg?: string
  xl?: string
  "2xl"?: string
}

export type ScrollSliderProps<T> = SliderControlProps & SliderA11yProps & {
  items: T[]
  renderItem: (item: T, index: number, state: ScrollSlideState) => ReactNode

  // レイアウト
  peek?: "left" | "right" | "both" | false
  /** 1アイテム時も peek を維持する。デフォルト false */
  keepPeekOnSingle?: boolean
  /** peek 時のスライドサイズ。文字列 or レスポンシブオブジェクト（デフォルト "85%"） */
  slideSize?: string | ResponsiveSlideSize
  gap?: "sm" | "md" | "lg"
  containerWidth?: number | string
  /** Embla の align を直接指定。数値(0〜1) は viewSize に対する比率 */
  align?: "start" | "center" | "end" | number
  /** Embla の containScroll。false で端スライドの中央寄せを強制できる */
  containScroll?: "trimSnaps" | "keepSnaps" | false
  /** 端のフェードマスク。peek 無しでも単独使用可 */
  mask?: MaskOption

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
  /** Embla プラグインを直接渡す（autoplay 以外用） */
  plugins?: EmblaPlugins

  // コールバック
  onActiveClick?: (item: T, index: number) => void

  // 制御用 ref（imperative API）
  ref?: Ref<SliderImperativeApi>
}

function getMaskStyle(canScrollPrev: boolean, canScrollNext: boolean, left: number, right: number) {
  const hasLeft = canScrollPrev && left > 0
  const hasRight = canScrollNext && right > 0
  if (hasLeft && hasRight) {
    return `linear-gradient(to right, transparent 0%, black ${left}%, black ${100 - right}%, transparent 100%)`
  } else if (!hasLeft && hasRight) {
    return `linear-gradient(to right, black 0%, black ${100 - right}%, transparent 100%)`
  } else if (hasLeft && !hasRight) {
    return `linear-gradient(to right, transparent 0%, black ${left}%, black 100%)`
  }
  return undefined
}

const gapStyles = {
  sm: "pl-2",
  md: "pl-4",
  lg: "pl-6",
} as const

const gapNegativeMargin = {
  sm: "-ml-2",
  md: "-ml-4",
  lg: "-ml-6",
} as const

const breakpointMinWidths: Record<string, string> = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
  "2xl": "96rem",
}

function sanitizeId(id: string): string {
  return id.replace(/:/g, "-")
}

function buildResponsiveSlideSizeStyle(id: string, size: ResponsiveSlideSize): string {
  const varName = `--slider-size-${sanitizeId(id)}`
  let css = `[data-slider-id="${id}"] { ${varName}: ${size.default}; }`
  for (const [bp, minWidth] of Object.entries(breakpointMinWidths)) {
    const value = size[bp as keyof Omit<ResponsiveSlideSize, "default">]
    if (value) {
      css += ` @media (min-width: ${minWidth}) { [data-slider-id="${id}"] { ${varName}: ${value}; } }`
    }
  }
  return css
}

const arrowPositionStyles = {
  inside: { prev: "left-0", next: "right-0" },
  outside: { prev: "right-full mr-2", next: "left-full ml-2" },
} as const

const peekAlign = {
  left: "end",
  right: "start",
  both: "center",
} as const

type EmblaAutoplayApi = {
  play?: () => void
  stop?: () => void
  isPlaying?: () => boolean
}

function getAutoplayPlugin(api: CarouselApi | undefined): EmblaAutoplayApi | undefined {
  if (!api) return undefined
  const plugins = api.plugins() as Record<string, unknown>
  return plugins?.autoplay as EmblaAutoplayApi | undefined
}

export function ScrollSlider<T>({
  items,
  renderItem,

  peek,
  keepPeekOnSingle = false,
  slideSize = "85%",
  gap = "md",
  containerWidth,
  align,
  containScroll,
  mask = true,

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
  plugins: externalPlugins,
  onActiveClick,

  defaultIndex,
  index: controlledIndex,
  onIndexChange,
  loop = false,

  ariaLabel,
  ariaRoleDescription,

  ref,
}: ScrollSliderProps<T>) {
  const sliderId = useId()
  const isResponsiveSlideSize = typeof slideSize === "object"
  const slideSizeVarName = `--slider-size-${sanitizeId(sliderId)}`
  const isControlled = controlledIndex !== undefined

  const effectivePeek = !keepPeekOnSingle && items.length <= 1 ? false : peek

  const emblaPlugins = useMemo<EmblaPlugins>(() => {
    const list: NonNullable<EmblaPlugins> = []
    if (autoplay) {
      const opts = typeof autoplay === "object" ? autoplay : {}
      list.push(
        AutoplayPlugin({
          delay: opts.delay ?? 4000,
          stopOnInteraction: opts.stopOnInteraction ?? true,
        })
      )
    }
    if (externalPlugins) list.push(...externalPlugins)
    return list.length > 0 ? list : undefined
  }, [autoplay, externalPlugins])

  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const onIndexChangeRef = useRef(onIndexChange)
  onIndexChangeRef.current = onIndexChange

  useEffect(() => {
    if (!api) return

    const updateState = () => {
      setCount(api.scrollSnapList().length)
      const newIndex = api.selectedScrollSnap()
      setCurrent((prev) => {
        if (prev !== newIndex) onIndexChangeRef.current?.(newIndex)
        return newIndex
      })
      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
    }

    updateState()
    api.on("select", updateState)
    api.on("reInit", updateState)

    return () => {
      api.off("select", updateState)
      api.off("reInit", updateState)
    }
  }, [api])

  // 初期 index（uncontrolled 時のみ）
  useEffect(() => {
    if (!api || isControlled || defaultIndex == null) return
    api.scrollTo(defaultIndex, true)
    // 初回のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api])

  // controlled 同期
  useEffect(() => {
    if (!api || !isControlled || controlledIndex == null) return
    if (api.selectedScrollSnap() !== controlledIndex) {
      api.scrollTo(controlledIndex)
    }
  }, [api, isControlled, controlledIndex])

  useImperativeHandle(
    ref,
    () => ({
      next: () => api?.scrollNext(),
      prev: () => api?.scrollPrev(),
      goTo: (i: number) => api?.scrollTo(i),
      play: () => getAutoplayPlugin(api)?.play?.(),
      pause: () => getAutoplayPlugin(api)?.stop?.(),
      getState: () => ({
        index: api?.selectedScrollSnap() ?? 0,
        count: api?.scrollSnapList().length ?? 0,
        playing: !!getAutoplayPlugin(api)?.isPlaying?.(),
      }),
    }),
    [api]
  )

  const handleDotClick = useCallback(
    (i: number) => {
      api?.scrollTo(i)
    },
    [api]
  )

  if (items.length === 0) return null

  const arrowsVisible = isResponsiveToggleVisible(showArrows)
  const dotsVisible = isResponsiveToggleVisible(showDots)
  const arrowResponsiveClass = getResponsiveVisibilityClass(showArrows)
  const dotsResponsiveClass = getResponsiveVisibilityClass(showDots)

  const maskLeft = mask === false ? 0 : mask === true ? 10 : mask.left ?? 10
  const maskRight = mask === false ? 0 : mask === true ? 10 : mask.right ?? 10
  const maskStyle = mask !== false ? getMaskStyle(canScrollPrev, canScrollNext, maskLeft, maskRight) : undefined

  const arrowWrapperBase = "absolute top-1/2 -translate-y-1/2 z-10"
  const prevPositionClass = arrowPositionStyles[arrowPosition].prev
  const nextPositionClass = arrowPositionStyles[arrowPosition].next

  const renderArrowElement = (direction: "prev" | "next") => {
    const isPrev = direction === "prev"
    const canScroll = isPrev ? canScrollPrev : canScrollNext
    const onClick = () => (isPrev ? api?.scrollPrev() : api?.scrollNext())
    const posClass = isPrev ? prevPositionClass : nextPositionClass

    if (renderArrow) {
      return (
        <div className={cn(arrowWrapperBase, posClass, arrowResponsiveClass)}>
          {renderArrow({ direction, onClick, disabled: !canScroll })}
        </div>
      )
    }

    if (!canScroll) return null
    return (
      <div className={cn(arrowWrapperBase, posClass, arrowResponsiveClass)}>
        <SliderArrow direction={direction} onClick={onClick} variant={arrowVariant} size={arrowSize} />
      </div>
    )
  }

  return (
    <div
      data-slider-id={isResponsiveSlideSize ? sliderId : undefined}
      style={containerWidth ? { width: containerWidth, marginLeft: "auto", marginRight: "auto" } : undefined}
      {...getCarouselRootA11yProps({ ariaLabel, ariaRoleDescription })}
      {...getLiveRegionA11yProps(!!autoplay)}
    >
      {isResponsiveSlideSize && (
        <style dangerouslySetInnerHTML={{ __html: buildResponsiveSlideSizeStyle(sliderId, slideSize) }} />
      )}
      <div className="relative">
        {arrowsVisible && renderArrowElement("prev")}

        <div
          style={
            maskStyle
              ? {
                  overflow: "hidden",
                  maskImage: maskStyle,
                  WebkitMaskImage: maskStyle,
                }
              : undefined
          }
        >
          <Carousel
            setApi={setApi}
            opts={{
              loop,
              align:
                align != null
                  ? typeof align === "number"
                    ? (viewSize: number) => viewSize * align
                    : align
                  : effectivePeek
                  ? peekAlign[effectivePeek]
                  : "center",
              ...(containScroll != null && { containScroll }),
            }}
            plugins={emblaPlugins}
          >
            <CarouselContent className={gapNegativeMargin[gap]}>
              {items.map((item, index) => (
                <CarouselItem
                  key={index}
                  className={cn(gapStyles[gap], index !== current && "cursor-pointer")}
                  style={
                    effectivePeek
                      ? { flexBasis: isResponsiveSlideSize ? `var(${slideSizeVarName})` : slideSize }
                      : undefined
                  }
                  onClick={() => {
                    if (index !== current) {
                      api?.scrollTo(index)
                    } else {
                      onActiveClick?.(item, index)
                    }
                  }}
                >
                  {renderItem(item, index, { isActive: index === current })}
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        {arrowsVisible && renderArrowElement("next")}

        {dotsVisible && dotPosition === "inside-bottom" && (
          <div className={cn("absolute bottom-2 left-0 right-0 z-10", dotsResponsiveClass)}>
            {renderDots ? (
              renderDots({ count, current, onDotClick: handleDotClick })
            ) : (
              <SliderDots count={count} current={current} onDotClick={handleDotClick} variant={dotVariant} />
            )}
          </div>
        )}
      </div>

      {dotsVisible && dotPosition === "bottom" && (
        <div className={cn("mt-4", dotsResponsiveClass)}>
          {renderDots ? (
            renderDots({ count, current, onDotClick: handleDotClick })
          ) : (
            <SliderDots count={count} current={current} onDotClick={handleDotClick} variant={dotVariant} />
          )}
        </div>
      )}
    </div>
  )
}
