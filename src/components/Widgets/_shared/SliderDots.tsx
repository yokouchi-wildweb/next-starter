"use client"

import { cn } from "@/lib/cn"
import type { DotVariant } from "./types"

type SliderDotsProps = {
  count: number
  current: number
  onDotClick: (index: number) => void
  variant?: DotVariant
}

export function SliderDots({ count, current, onDotClick, variant = "default" }: SliderDotsProps) {
  if (count <= 1) return null

  return (
    <div className="flex justify-center items-center gap-2">
      {Array.from({ length: count }).map((_, index) => {
        const isActive = current === index

        if (variant === "line") {
          return (
            <button
              key={index}
              type="button"
              onClick={() => onDotClick(index)}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                isActive
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`スライド ${index + 1} へ移動`}
              aria-current={isActive || undefined}
            />
          )
        }

        if (variant === "dash") {
          return (
            <button
              key={index}
              type="button"
              onClick={() => onDotClick(index)}
              className={cn(
                "w-4 h-0.5 rounded-full transition-colors",
                isActive
                  ? "bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`スライド ${index + 1} へ移動`}
              aria-current={isActive || undefined}
            />
          )
        }

        return (
          <button
            key={index}
            type="button"
            onClick={() => onDotClick(index)}
            className={cn(
              "size-2 rounded-full transition-colors",
              isActive
                ? "bg-primary"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
            aria-label={`スライド ${index + 1} へ移動`}
            aria-current={isActive || undefined}
          />
        )
      })}
    </div>
  )
}
