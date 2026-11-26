// src/hooks/useDisableScroll.ts

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { acquireBodyScrollLock, releaseBodyScrollLock } from '@/utils/bodyScrollLock'

/**
 * body のスクロールを無効化するフック。
 *
 * - 複数インスタンスが同時にロックしても参照カウントで管理され、解放順に依存しない
 *   (ロック管理の実体は utils/bodyScrollLock)
 * - Radix Dialog 等、別機構のスクロールロックと重なっても body を永久ロックしない
 * - unmount 時にこのインスタンスが保持しているロックは自動解放される
 *   (consumer 側で enableScroll を呼び忘れても body が固まらない)
 *
 * @param lockToTop true: ロック時にページ先頭へスクロール / false: 現在位置を維持
 */
export const useDisableScroll = (lockToTop: boolean = true) => {

  // 同期的な二重取得/二重解放ガード用 (render 中は参照しない)
  const isDisabledRef = useRef(false)
  // 利用側へ返すリアクティブな状態
  const [isDisabled, setIsDisabled] = useState(false)
  const scrollPosition = useRef({ x: 0, y: 0 })
  // 片付け(unmount・<Activity> に隠された時)で一時に外したロック。戻った時の effect で掛け直す(利用側の状態はロック中のまま)
  const suspendedRef = useRef(false)

  const disableScroll = useCallback(() => {
    if (typeof window === 'undefined' || isDisabledRef.current) return

    if (!lockToTop) {
      scrollPosition.current = { x: window.scrollX, y: window.scrollY }
      window.scrollTo(scrollPosition.current.x, scrollPosition.current.y)
    } else {
      window.scrollTo(0, 0)
    }

    acquireBodyScrollLock(document.body)
    isDisabledRef.current = true
    setIsDisabled(true)
  }, [lockToTop])

  const enableScroll = useCallback(() => {
    if (typeof window === 'undefined' || !isDisabledRef.current) return

    // 一時に外している間(隠れている間)は body のロックを持っていない: 二重に外さない
    if (suspendedRef.current) suspendedRef.current = false
    else releaseBodyScrollLock(document.body)
    isDisabledRef.current = false
    setIsDisabled(false)
  }, [])

  const toggleScroll = useCallback(() => {
    if (isDisabledRef.current) {
      enableScroll()
    } else {
      disableScroll()
    }
  }, [disableScroll, enableScroll])

  // 片付けで保持中のロックを外す (unmount で body を固めない。未保持なら no-op)。
  // <Activity> に隠されて戻ると effect が走り直すので、隠れる時に外したロックを掛け直す (スクロール位置は動かさない)
  useEffect(() => {
    if (suspendedRef.current && typeof window !== 'undefined') {
      acquireBodyScrollLock(document.body)
      suspendedRef.current = false
    }
    return () => {
      if (typeof window === 'undefined' || !isDisabledRef.current || suspendedRef.current) return
      releaseBodyScrollLock(document.body)
      suspendedRef.current = true
    }
  }, [])

  return {
    isDisabled,
    disableScroll,
    enableScroll,
    toggleScroll,
  }
}
