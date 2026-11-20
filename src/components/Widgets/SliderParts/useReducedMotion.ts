"use client"

import { useEffect, useState } from "react"

/**
 * `prefers-reduced-motion: reduce` を監視する。
 * SSR 時は false を返し、マウント後に実値に追従する。
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(mql.matches)
    update()
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
  }, [])

  return reduced
}
