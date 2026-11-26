// src/lib/pageLeave/useOnPageLeave.ts
// cacheComponents の <Activity> は離れたページを隠して状態と ref を保ち、戻ると effect をもう一度走らせる。ref の守りで 1 回だけ
// 走らせる「訪れるたびの初期化」は、戻った時に ref が立ったままで走らない。このフックは、ページを本当に離れた時(隠された時・アンマウント)
// にだけ onLeave を呼ぶので、そこで ref と状態を戻せば、戻った時の effect がもう一度初期化する。
// 開発の StrictMode の作り直し(同じ処理の中ですぐ戻る)は離れたと見なさない: 片付けを次の task へ遅らせ、すぐ戻れば取り消す。
// 意図した状態の保存(下書き・スクロール・二重送信の lock)には使わない(戻ってもそのままが正しい)

"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * ページを本当に離れた時(<Activity> に隠された・アンマウントされた)にだけ onLeave を呼ぶ
 * @param onLeave 離れた時の後片付け(訪れるたびの初期化の ref と状態を戻す)。最新の関数が呼ばれる
 */
export function useOnPageLeave(onLeave: () => void): void {
  const onLeaveRef = useRef(onLeave);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    onLeaveRef.current = onLeave;
  });

  useLayoutEffect(() => {
    // StrictMode の作り直しなら、前の片付けがまだ待っている = 離れていない
    if (pendingRef.current !== null) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }
    return () => {
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
        onLeaveRef.current();
      }, 0);
    };
  }, []);
}
