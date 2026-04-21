"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import type { AutoplayOption } from "./types"
import { useReducedMotion } from "./useReducedMotion"

type UseSliderAutoplayOptions = {
  /** 自動再生の設定。false/undefined で無効 */
  autoplay: AutoplayOption | undefined
  /** 1 tick ごとに呼ばれる。通常は controller.next */
  onTick: () => void
  /** ホバー中に一時停止。デフォルト true */
  pauseOnHover?: boolean
  /** prefers-reduced-motion 時は自動的に停止。デフォルト true */
  reducedMotion?: boolean
  /** pauseOnHover を有効にするスコープ要素 */
  targetRef: RefObject<HTMLElement | null>
}

export type AutoplayControls = {
  /** 外部から再生を再開する。autoplay が無効な場合は no-op */
  play: () => void
  /** 外部から再生を停止する */
  pause: () => void
  /** ユーザー操作による停止（stopOnInteraction 時のみ有効） */
  stopForInteraction: () => void
  /** 現在再生中か */
  playing: boolean
}

/**
 * 汎用 autoplay タイマー。外部制御 (play/pause)、ホバー一時停止、reduced-motion、
 * stopOnInteraction を吸収する。FadeSlider などの自前実装から利用する。
 */
export function useSliderAutoplay({
  autoplay,
  onTick,
  pauseOnHover = true,
  reducedMotion = true,
  targetRef,
}: UseSliderAutoplayOptions): AutoplayControls {
  const enabled = !!autoplay
  const opts = typeof autoplay === "object" ? autoplay : undefined
  const delay = opts?.delay ?? 4000
  const stopOnInteraction = opts?.stopOnInteraction ?? true

  const [manuallyStopped, setManuallyStopped] = useState(false)
  const [hovering, setHovering] = useState(false)
  const prefersReduced = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onTickRef = useRef(onTick)
  useEffect(() => {
    onTickRef.current = onTick
  })

  useEffect(() => {
    if (!pauseOnHover) return
    const el = targetRef.current
    if (!el) return
    const onEnter = () => setHovering(true)
    const onLeave = () => setHovering(false)
    el.addEventListener("pointerenter", onEnter)
    el.addEventListener("pointerleave", onLeave)
    el.addEventListener("focusin", onEnter)
    el.addEventListener("focusout", onLeave)
    return () => {
      el.removeEventListener("pointerenter", onEnter)
      el.removeEventListener("pointerleave", onLeave)
      el.removeEventListener("focusin", onEnter)
      el.removeEventListener("focusout", onLeave)
    }
  }, [pauseOnHover, targetRef])

  const playing = enabled && !manuallyStopped && !(pauseOnHover && hovering) && !(reducedMotion && prefersReduced)

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    timerRef.current = setInterval(() => onTickRef.current(), delay)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [playing, delay])

  const play = useCallback(() => {
    if (!enabled) return
    setManuallyStopped(false)
  }, [enabled])

  const pause = useCallback(() => {
    setManuallyStopped(true)
  }, [])

  const stopForInteraction = useCallback(() => {
    if (!enabled || !stopOnInteraction) return
    setManuallyStopped(true)
  }, [enabled, stopOnInteraction])

  return { play, pause, stopForInteraction, playing }
}
