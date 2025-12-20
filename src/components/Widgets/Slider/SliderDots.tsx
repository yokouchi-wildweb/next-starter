"use client"

import { cn } from "@/lib/cn"

type SliderDotsProps = {
  count: number
  current: number
  onDotClick: (index: number) => void
}

export function SliderDots({ count, current, onDotClick }: SliderDotsProps) {
  if (count <= 1) return null

  return (
    <div className="flex justify-center gap-2 mt-4">
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onDotClick(index)}
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
  )
}
