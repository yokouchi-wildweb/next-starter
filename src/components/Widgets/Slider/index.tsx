"use client"

import { ReactNode, useCallback, useEffect, useRef, useState } from "react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/_shadcn/carousel"
import { cn } from "@/lib/cn"
import { SliderArrow } from "./SliderArrow"
import { SliderDots } from "./SliderDots"

function getPeekMaskStyle(canScrollPrev: boolean, canScrollNext: boolean) {
  if (canScrollPrev && canScrollNext) {
    // 両側フェード
    return "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)"
  } else if (!canScrollPrev && canScrollNext) {
    // 右のみフェード
    return "linear-gradient(to right, black 0%, black 90%, transparent 100%)"
  } else if (canScrollPrev && !canScrollNext) {
    // 左のみフェード
    return "linear-gradient(to right, transparent 0%, black 10%, black 100%)"
  }
  // フェードなし
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

const responsiveShowClasses: Record<string, string> = {
  sm: "hidden sm:block",
  md: "hidden md:block",
  lg: "hidden lg:block",
  xl: "hidden xl:block",
  "2xl": "hidden 2xl:block",
}

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
  arrowVariant?: "light" | "dark"
  /** peek時のスライドサイズ。例: "85%", "70%", "300px"（デフォルト: "85%"） */
  slideSize?: string
  /** peek時のフェードマスク。falseで隣のスライドがくっきり見える（デフォルト: true） */
  peekFade?: boolean
  /** スライド変更時のコールバック */
  onSlideChange?: (index: number) => void
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
  slideSize = "85%",
  peekFade = true,
  onSlideChange,
}: SliderProps<T>) {
  const effectivePeek = items.length <= 1 ? false : peek
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

  const peekMask = effectivePeek && peekFade
    ? getPeekMaskStyle(canScrollPrev, canScrollNext)
    : undefined

  return (
    <div
      style={containerWidth ? { width: containerWidth, marginLeft: "auto", marginRight: "auto" } : undefined}
    >
      <div className="relative">
        {arrowsVisible && canScrollPrev && (
          <div className={arrowResponsiveClass}>
            <SliderArrow
              direction="prev"
              onClick={() => api?.scrollPrev()}
              variant={arrowVariant}
            />
          </div>
        )}

        <div
          style={effectivePeek ? {
            overflow: "hidden",
            maskImage: peekMask,
            WebkitMaskImage: peekMask,
          } : undefined}
        >
          <Carousel
            setApi={setApi}
            opts={{
              loop,
              align: effectivePeek ? peekAlign[effectivePeek] : "center",
            }}
          >
            <CarouselContent className={gapNegativeMargin[gap]}>
              {items.map((item, index) => (
                <CarouselItem
                  key={index}
                  className={cn(
                    gapStyles[gap],
                    effectivePeek && `basis-[${slideSize}]`,
                    index !== current && "cursor-pointer"
                  )}
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

        {arrowsVisible && canScrollNext && (
          <div className={arrowResponsiveClass}>
            <SliderArrow
              direction="next"
              onClick={() => api?.scrollNext()}
              variant={arrowVariant}
            />
          </div>
        )}
      </div>

      {dotsVisible && (
        <div className={dotsResponsiveClass}>
          <SliderDots
            count={count}
            current={current}
            onDotClick={handleDotClick}
          />
        </div>
      )}
    </div>
  )
}
