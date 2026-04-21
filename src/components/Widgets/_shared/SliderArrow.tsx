"use client"

import { cn } from "@/lib/cn"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ArrowSize, ArrowVariant } from "./types"

type SliderArrowProps = {
  direction: "prev" | "next"
  onClick: () => void
  variant?: ArrowVariant
  size?: ArrowSize
  disabled?: boolean
}

const sizeStyles: Record<ArrowSize, string> = {
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
}

const iconSizeStyles: Record<ArrowSize, string> = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-6",
}

export function SliderArrow({
  direction,
  onClick,
  variant = "light",
  size = "md",
  disabled = false,
}: SliderArrowProps) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight
  const label = direction === "prev" ? "前へ" : "次へ"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center rounded-full transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        sizeStyles[size],
        variant === "light" && "bg-background/50 hover:bg-background/70 text-foreground border backdrop-blur-sm shadow-md",
        variant === "dark" && "bg-foreground/50 hover:bg-foreground/70 text-background border-foreground/20 border backdrop-blur-sm shadow-md",
        variant === "outline" && "bg-transparent hover:bg-accent text-foreground border border-border",
        variant === "ghost" && "bg-transparent hover:bg-accent text-foreground",
      )}
      aria-label={label}
    >
      <Icon className={iconSizeStyles[size]} />
    </button>
  )
}
