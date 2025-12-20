"use client"

import { ReactNode, useCallback, useEffect, useState } from "react"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/_shadcn/carousel"
import { cn } from "@/lib/cn"

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
  arrowStyle?: "outside" | "overlay"
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
  arrowStyle = "overlay",
}: SliderProps<T>) {
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
      className="relative"
      style={containerWidth ? { width: containerWidth, marginLeft: "auto", marginRight: "auto" } : undefined}
    >
      <Carousel
        setApi={setApi}
        opts={{
          loop,
          align: peek ? peekAlign[peek] : "center",
        }}
        className={cn(
          showArrows && arrowStyle === "outside" && "px-8",
          showArrows && arrowStyle === "overlay" && "px-4"
        )}
      >
        <CarouselContent className={gapNegativeMargin[gap]}>
          {items.map((item, index) => (
            <CarouselItem
              key={index}
              className={cn(
                gapStyles[gap],
                peek && "basis-[85%]",
                index !== current && "cursor-pointer"
              )}
              onClick={() => {
                if (index !== current) {
                  api?.scrollTo(index)
                }
              }}
            >
              {renderItem(item, index)}
            </CarouselItem>
          ))}
        </CarouselContent>

        {showArrows && (
          <>
            {canScrollPrev && (
              <CarouselPrevious
                className={cn(
                  "size-10 left-0",
                  arrowStyle === "overlay" && "bg-background/80 backdrop-blur-sm shadow-md hover:bg-background"
                )}
              />
            )}
            {canScrollNext && (
              <CarouselNext
                className={cn(
                  "size-10 right-0",
                  arrowStyle === "overlay" && "bg-background/80 backdrop-blur-sm shadow-md hover:bg-background"
                )}
              />
            )}
          </>
        )}
      </Carousel>

      {showDots && count > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: count }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleDotClick(index)}
              className={cn(
                "size-2 rounded-full transition-colors",
                current === index
                  ? "bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`スライド ${index + 1} へ移動`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
