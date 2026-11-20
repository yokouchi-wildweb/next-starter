"use client"

import { useEffect, type RefObject } from "react"

type UseSliderKeyboardOptions = {
  enabled: boolean
  targetRef: RefObject<HTMLElement | null>
  onPrev: () => void
  onNext: () => void
  onHome?: () => void
  onEnd?: () => void
}

/**
 * スライダー root 要素上でのキーボード操作を有効化する。
 * ArrowLeft/Right + Home/End をハンドル。root が focus できるよう tabIndex=0 を付けることを推奨。
 */
export function useSliderKeyboard({
  enabled,
  targetRef,
  onPrev,
  onNext,
  onHome,
  onEnd,
}: UseSliderKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return
    const el = targetRef.current
    if (!el) return

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault()
          onPrev()
          break
        case "ArrowRight":
          e.preventDefault()
          onNext()
          break
        case "Home":
          if (onHome) {
            e.preventDefault()
            onHome()
          }
          break
        case "End":
          if (onEnd) {
            e.preventDefault()
            onEnd()
          }
          break
      }
    }

    el.addEventListener("keydown", handler)
    return () => el.removeEventListener("keydown", handler)
  }, [enabled, targetRef, onPrev, onNext, onHome, onEnd])
}
