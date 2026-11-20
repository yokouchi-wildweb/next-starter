"use client"

import { useEffect, type RefObject } from "react"

type UseSliderSwipeOptions = {
  enabled: boolean
  targetRef: RefObject<HTMLElement | null>
  /** 水平方向のスワイプ判定の閾値 (px)。デフォルト 50 */
  threshold?: number
  /** 左スワイプ（次へ）発火時 */
  onSwipeLeft: () => void
  /** 右スワイプ（前へ）発火時 */
  onSwipeRight: () => void
  /** スワイプ開始時のコールバック（autoplay 停止等に使う） */
  onSwipeStart?: () => void
}

/**
 * 水平スワイプのみを検出する。垂直スクロールは妨げない。
 * pointer events を使用し、タッチ / マウス / ペンを統一的に扱う。
 */
export function useSliderSwipe({
  enabled,
  targetRef,
  threshold = 50,
  onSwipeLeft,
  onSwipeRight,
  onSwipeStart,
}: UseSliderSwipeOptions) {
  useEffect(() => {
    if (!enabled) return
    const el = targetRef.current
    if (!el) return

    let startX: number | null = null
    let startY: number | null = null
    let pointerId: number | null = null
    let decided: "horizontal" | "vertical" | null = null

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return
      startX = e.clientX
      startY = e.clientY
      pointerId = e.pointerId
      decided = null
    }

    const onMove = (e: PointerEvent) => {
      if (pointerId !== e.pointerId || startX === null || startY === null) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (decided === null) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          decided = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical"
          if (decided === "horizontal") {
            onSwipeStart?.()
          }
        }
      }
    }

    const onUp = (e: PointerEvent) => {
      if (pointerId !== e.pointerId || startX === null) return
      const dx = e.clientX - startX
      startX = null
      startY = null
      pointerId = null
      if (decided !== "horizontal") {
        decided = null
        return
      }
      decided = null
      if (Math.abs(dx) < threshold) return
      if (dx < 0) onSwipeLeft()
      else onSwipeRight()
    }

    const onCancel = () => {
      startX = null
      startY = null
      pointerId = null
      decided = null
    }

    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointercancel", onCancel)
    el.addEventListener("pointerleave", onCancel)
    return () => {
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointercancel", onCancel)
      el.removeEventListener("pointerleave", onCancel)
    }
  }, [enabled, targetRef, threshold, onSwipeLeft, onSwipeRight, onSwipeStart])
}
