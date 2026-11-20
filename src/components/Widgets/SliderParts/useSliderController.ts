"use client"

import { useCallback, useState } from "react"

type UseSliderControllerOptions = {
  count: number
  defaultIndex?: number
  index?: number
  onIndexChange?: (index: number) => void
  loop?: boolean
}

export type SliderController = {
  index: number
  count: number
  next: () => void
  prev: () => void
  goTo: (index: number) => void
  setIndex: (index: number) => void
  canPrev: boolean
  canNext: boolean
  isControlled: boolean
}

/**
 * controlled/uncontrolled を透過的に扱うヘッドレス状態コントローラ。
 * FadeSlider のように状態管理ライブラリを持たない実装の土台として使う。
 */
export function useSliderController({
  count,
  defaultIndex = 0,
  index,
  onIndexChange,
  loop = false,
}: UseSliderControllerOptions): SliderController {
  const isControlled = index !== undefined
  const [internalIndex, setInternalIndex] = useState(() => clamp(defaultIndex, count))
  const currentIndex = isControlled ? clamp(index, count) : Math.min(internalIndex, Math.max(0, count - 1))

  const setIndex = useCallback(
    (next: number) => {
      if (count <= 0) return
      const resolved = loop
        ? ((next % count) + count) % count
        : clamp(next, count)
      if (resolved === currentIndex) return
      if (!isControlled) setInternalIndex(resolved)
      onIndexChange?.(resolved)
    },
    [count, loop, isControlled, onIndexChange, currentIndex]
  )

  const next = useCallback(() => setIndex(currentIndex + 1), [currentIndex, setIndex])
  const prev = useCallback(() => setIndex(currentIndex - 1), [currentIndex, setIndex])
  const goTo = useCallback((i: number) => setIndex(i), [setIndex])

  return {
    index: currentIndex,
    count,
    next,
    prev,
    goTo,
    setIndex,
    canPrev: loop ? count > 1 : currentIndex > 0,
    canNext: loop ? count > 1 : currentIndex < count - 1,
    isControlled,
  }
}

function clamp(n: number, count: number): number {
  if (count <= 0) return 0
  return Math.max(0, Math.min(count - 1, n))
}
