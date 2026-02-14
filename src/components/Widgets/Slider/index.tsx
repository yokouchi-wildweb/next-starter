"use client"

import { ReactNode, useCallback, useEffect, useState } from "react"
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

type SliderProps<T> = {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  showArrows?: boolean
  showDots?: boolean
  loop?: boolean
  peek?: "left" | "right" | "both" | false
  gap?: "sm" | "md" | "lg"
  containerWidth?: number | string
  onActiveClick?: (item: T, index: number) => void
  arrowVariant?: "light" | "dark"
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
}: SliderProps<T>) {
  const effectivePeek = items.length <= 1 ? false : peek
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  useEffect(() => {
    if (!api) return

    const updateState = () => {
      setCount(api.scrollSnapList().length)
      setCurrent(api.selectedScrollSnap())
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

  return (
    <div
      style={containerWidth ? { width: containerWidth, marginLeft: "auto", marginRight: "auto" } : undefined}
    >
      <div className="relative">
        {showArrows && canScrollPrev && (
          <SliderArrow
            direction="prev"
            onClick={() => api?.scrollPrev()}
            variant={arrowVariant}
          />
        )}

        <div
          style={effectivePeek ? {
            overflow: "hidden",
            maskImage: getPeekMaskStyle(canScrollPrev, canScrollNext),
            WebkitMaskImage: getPeekMaskStyle(canScrollPrev, canScrollNext),
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
                    effectivePeek && "basis-[85%]",
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

        {showArrows && canScrollNext && (
          <SliderArrow
            direction="next"
            onClick={() => api?.scrollNext()}
            variant={arrowVariant}
          />
        )}
      </div>

      {showDots && (
        <SliderDots
          count={count}
          current={current}
          onDotClick={handleDotClick}
        />
      )}
    </div>
  )
}
