"use client"

import { cn } from "@/lib/cn"
import { ChevronLeft, ChevronRight } from "lucide-react"

type SliderArrowProps = {
  direction: "prev" | "next"
  onClick: () => void
  variant?: "light" | "dark"
}

export function SliderArrow({ direction, onClick, variant = "light" }: SliderArrowProps) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight
  const positionClass = direction === "prev" ? "left-0" : "right-0"
  const label = direction === "prev" ? "前へ" : "次へ"

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-10 size-8 flex items-center justify-center rounded-full border backdrop-blur-sm shadow-md",
        positionClass,
        variant === "light" && "bg-background/50 hover:bg-background/70 text-foreground",
        variant === "dark" && "bg-foreground/50 hover:bg-foreground/70 text-background border-foreground/20"
      )}
      aria-label={label}
    >
      <Icon className="size-5" />
    </button>
  )
}
