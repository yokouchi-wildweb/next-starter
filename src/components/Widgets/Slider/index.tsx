"use client"

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/_shadcn/carousel"
import AutoplayPlugin from "embla-carousel-autoplay"

type EmblaPlugins = Parameters<typeof useEmblaCarousel>[1]
import { cn } from "@/lib/cn"
import { SliderArrow, type ArrowVariant, type ArrowSize } from "./SliderArrow"
import { SliderDots, type DotVariant } from "./SliderDots"

function getMaskStyle(
  canScrollPrev: boolean,
  canScrollNext: boolean,
  left: number,
  right: number,
) {
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

/** boolean: 常時表示/非表示 | ブレークポイント文字列: 指定以上で表示 */
export type ResponsiveToggle = boolean | "sm" | "md" | "lg" | "xl" | "2xl"

export type ArrowPosition = "inside" | "outside"

export type RenderArrowProps = {
  direction: "prev" | "next"
  onClick: () => void
  disabled: boolean
}

export type DotPosition = "bottom" | "inside-bottom"

export type RenderDotsProps = {
  count: number
  current: number
  onDotClick: (index: number) => void
}

export type AutoplayOption = boolean | {
  /** 自動再生の間隔（ms）。デフォルト: 4000 */
  delay?: number
  /** ユーザー操作時に自動再生を停止する。デフォルト: true */
  stopOnInteraction?: boolean
}

export type MaskOption = boolean | {
  /** 左端のフェード幅（%）。0でフェードなし。デフォルト: 10 */
  left?: number
  /** 右端のフェード幅（%）。0でフェードなし。デフォルト: 10 */
  right?: number
}

const responsiveShowClasses: Record<string, string> = {
  sm: "hidden sm:block",
  md: "hidden md:block",
  lg: "hidden lg:block",
  xl: "hidden xl:block",
  "2xl": "hidden 2xl:block",
}

const arrowPositionStyles = {
  inside: { prev: "left-0", next: "right-0" },
  outside: { prev: "right-full mr-2", next: "left-full ml-2" },
} as const

type SliderProps<T> = {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  showArrows?: ResponsiveToggle
  showDots?: ResponsiveToggle
  loop?: boolean
  peek?: "left" | "right" | "both" | false
  gap?: "sm" | "md" | "lg"
  containerWidth?: number | string
  onActiveClick?: (item: T, index: number) => void
  arrowVariant?: ArrowVariant
  arrowSize?: ArrowSize
  arrowPosition?: ArrowPosition
  /** variant/size/positionを無視し、矢印を完全カスタム描画する */
  renderArrow?: (props: RenderArrowProps) => ReactNode
  dotVariant?: DotVariant
  dotPosition?: DotPosition
  /** variant/positionを無視し、ドットを完全カスタム描画する */
  renderDots?: (props: RenderDotsProps) => ReactNode
  /** peek時のスライドサイズ。例: "85%", "70%", "300px"（デフォルト: "85%"） */
  slideSize?: string
  /** Emblaのalignを直接指定。peekのデフォルトalignを上書きする。
   *  数値(0〜1): 0=左端, 0.5=中央, 1=右端（viewSizeに対する比率で配置位置を計算）
   *  文字列: "start" | "center" | "end" */
  align?: "start" | "center" | "end" | number
  /** 端のフェードマスク。true=デフォルト(左右10%), false=なし, オブジェクト=左右個別指定。peek無しでも適用可能 */
  mask?: MaskOption
  /** スライド変更時のコールバック */
  onSlideChange?: (index: number) => void
  /** 自動再生。trueでデフォルト設定、オブジェクトで詳細設定 */
  autoplay?: AutoplayOption
  /** emblaプラグインを直接渡す（autoplay以外のプラグイン用） */
  plugins?: EmblaPlugins
  /** EmblaのcontainScrollオプション。falseで端スライドの中央寄せを強制できる。未指定時はEmblaデフォルト（"trimSnaps"） */
  containScroll?: "trimSnaps" | "keepSnaps" | false
  /** 1アイテム時もpeekを維持する。デフォルト: false（従来通り1件以下でpeek無効） */
  keepPeekOnSingle?: boolean
}

const peekAlign = {
  left: "end",
  right: "start",
  both: "center",
} as const

export function Slider<T>({
  items,
  renderItem,
  showArrows = true,
  showDots = true,
  loop = false,
  peek,
  gap = "md",
  containerWidth,
  onActiveClick,
  arrowVariant = "light",
  arrowSize = "md",
  arrowPosition = "inside",
  renderArrow,
  dotVariant = "default",
  dotPosition = "bottom",
  renderDots,
  slideSize = "85%",
  align,
  mask = true,
  onSlideChange,
  autoplay,
  plugins: externalPlugins,
  containScroll,
  keepPeekOnSingle = false,
}: SliderProps<T>) {
  const effectivePeek = (!keepPeekOnSingle && items.length <= 1) ? false : peek

  const emblaPlugins = useMemo<EmblaPlugins>(() => {
    const list: NonNullable<EmblaPlugins> = []
    if (autoplay) {
      const opts = typeof autoplay === "object" ? autoplay : {}
      list.push(AutoplayPlugin({
        delay: opts.delay ?? 4000,
        stopOnInteraction: opts.stopOnInteraction ?? true,
      }))
    }
    if (externalPlugins) {
      list.push(...externalPlugins)
    }
    return list.length > 0 ? list : undefined
  }, [autoplay, externalPlugins])

  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const onSlideChangeRef = useRef(onSlideChange)
  onSlideChangeRef.current = onSlideChange

  useEffect(() => {
    if (!api) return

    const updateState = () => {
      setCount(api.scrollSnapList().length)
      const newIndex = api.selectedScrollSnap()
      setCurrent((prev) => {
        if (prev !== newIndex) {
          onSlideChangeRef.current?.(newIndex)
        }
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

  const handleDotClick = useCallback(
    (index: number) => {
      api?.scrollTo(index)
    },
    [api]
  )

  if (items.length === 0) {
    return null
  }

  const arrowsVisible = showArrows !== false
  const dotsVisible = showDots !== false
  const arrowResponsiveClass = typeof showArrows === "string" ? responsiveShowClasses[showArrows] : undefined
  const dotsResponsiveClass = typeof showDots === "string" ? responsiveShowClasses[showDots] : undefined

  const maskLeft = mask === false ? 0 : mask === true ? 10 : (mask.left ?? 10)
  const maskRight = mask === false ? 0 : mask === true ? 10 : (mask.right ?? 10)
  const maskStyle = mask !== false
    ? getMaskStyle(canScrollPrev, canScrollNext, maskLeft, maskRight)
    : undefined

  const arrowWrapperBase = "absolute top-1/2 -translate-y-1/2 z-10"
  const prevPositionClass = arrowPositionStyles[arrowPosition].prev
  const nextPositionClass = arrowPositionStyles[arrowPosition].next

  const renderArrowElement = (direction: "prev" | "next") => {
    const isPrev = direction === "prev"
    const canScroll = isPrev ? canScrollPrev : canScrollNext
    const onClick = () => (isPrev ? api?.scrollPrev() : api?.scrollNext())
    const posClass = isPrev ? prevPositionClass : nextPositionClass

    // renderArrow: 常時表示し、disabled で制御を委ねる
    if (renderArrow) {
      return (
        <div className={cn(arrowWrapperBase, posClass, arrowResponsiveClass)}>
          {renderArrow({ direction, onClick, disabled: !canScroll })}
        </div>
      )
    }

    // デフォルト: スクロール不可時は非表示
    if (!canScroll) return null
    return (
      <div className={cn(arrowWrapperBase, posClass, arrowResponsiveClass)}>
        <SliderArrow
          direction={direction}
          onClick={onClick}
          variant={arrowVariant}
          size={arrowSize}
        />
      </div>
    )
  }

  return (
    <div
      style={containerWidth ? { width: containerWidth, marginLeft: "auto", marginRight: "auto" } : undefined}
    >
      <div className="relative">
        {arrowsVisible && renderArrowElement("prev")}

        <div
          style={maskStyle ? {
            overflow: "hidden",
            maskImage: maskStyle,
            WebkitMaskImage: maskStyle,
          } : undefined}
        >
          <Carousel
            setApi={setApi}
            opts={{
              loop,
              align: align != null
                ? (typeof align === "number"
                  ? (viewSize: number) => viewSize * align
                  : align)
                : (effectivePeek ? peekAlign[effectivePeek] : "center"),
              ...(containScroll != null && { containScroll }),
            }}
            plugins={emblaPlugins}
          >
            <CarouselContent className={gapNegativeMargin[gap]}>
              {items.map((item, index) => (
                <CarouselItem
                  key={index}
                  className={cn(
                    gapStyles[gap],
                    index !== current && "cursor-pointer"
                  )}
                  style={effectivePeek ? { flexBasis: slideSize } : undefined}
                  onClick={() => {
                    if (index !== current) {
                      api?.scrollTo(index)
                    } else {
                      onActiveClick?.(item, index)
                    }
                  }}
                >
                  {renderItem(item, index)}
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        {arrowsVisible && renderArrowElement("next")}

        {dotsVisible && dotPosition === "inside-bottom" && (
          <div className={cn("absolute bottom-2 left-0 right-0 z-10", dotsResponsiveClass)}>
            {renderDots
              ? renderDots({ count, current, onDotClick: handleDotClick })
              : <SliderDots count={count} current={current} onDotClick={handleDotClick} variant={dotVariant} />
            }
          </div>
        )}
      </div>

      {dotsVisible && dotPosition === "bottom" && (
        <div className={cn("mt-4", dotsResponsiveClass)}>
          {renderDots
            ? renderDots({ count, current, onDotClick: handleDotClick })
            : <SliderDots count={count} current={current} onDotClick={handleDotClick} variant={dotVariant} />
          }
        </div>
      )}
    </div>
  )
}
