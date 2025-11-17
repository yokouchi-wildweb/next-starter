// hooks/useToggleScroll.ts

'use client'

import { useCallback, useRef } from 'react'

export const useDisableScroll = (lockToTop: boolean = true) => {

  const isDisabled = useRef(false)
  const originalOverflow = useRef<string | null>(null)
  const scrollPosition = useRef({ x: 0, y: 0 })

  const disableScroll = useCallback(() => {
    if (typeof window === 'undefined' || isDisabled.current) return

    const body = document.body
    if (originalOverflow.current === null) {
      originalOverflow.current = window.getComputedStyle(body).overflow
    }

    if (!lockToTop) {
      scrollPosition.current = { x: window.scrollX, y: window.scrollY }
      window.scrollTo(scrollPosition.current.x, scrollPosition.current.y)
    } else {
      window.scrollTo(0, 0)
    }

    body.style.overflow = 'hidden'
    isDisabled.current = true
  }, [lockToTop])

  const enableScroll = useCallback(() => {
    if (typeof window === 'undefined' || !isDisabled.current) return

    const body = document.body
    if (originalOverflow.current !== null) {
      body.style.overflow = originalOverflow.current
    }

    isDisabled.current = false
  }, [])

  const toggleScroll = useCallback(() => {
    if (isDisabled.current) {
      enableScroll()
    } else {
      disableScroll()
    }
  }, [disableScroll, enableScroll])

  return {
    isDisabled: isDisabled.current,
    disableScroll,
    enableScroll,
    toggleScroll,
  }
}