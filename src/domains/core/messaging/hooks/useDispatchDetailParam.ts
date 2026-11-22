"use client";

// src/domains/core/messaging/hooks/useDispatchDetailParam.ts
//
// 送信の詳細のモーダルの開き先 = 一覧の URL の ?dispatch=<送信の id>(D130。詳細の別の画面は無い)。
// - dispatchId = 今の ?dispatch の値(無ければ null = 閉じている)。URL を直に開いても一覧の上にモーダルが開く
// - hrefOf(id) = 今の住所 + ?dispatch=<id>(ほかの検索の値は残す)。一覧の行はこれへ移る(履歴に積むので「戻る」で閉じる)
// - close() = 一覧の行から開いた時は履歴を 1 つ戻す(「戻る」と同じ)、URL を直に開いた時は ?dispatch を外して置き換える
//   (戻る先が別のページになるのを避ける)。markOpened() を行を押した時に呼ぶ

import { useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useRouter } from "@/lib/unsavedGuard";

/** 送信の詳細の検索の名前 */
export const DISPATCH_DETAIL_PARAM = "dispatch";

/** 一覧の住所(既定 /admin/messaging)の上で送信の詳細を開く住所 */
export function dispatchDetailHref(listPath: string, dispatchId: string): string {
  return `${listPath}?${DISPATCH_DETAIL_PARAM}=${encodeURIComponent(dispatchId)}`;
}

export function useDispatchDetailParam() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const dispatchId = params.get(DISPATCH_DETAIL_PARAM) || null;
  // この画面の中で行から開いたか(開いた時だけ「戻る」で閉じる)
  const openedHere = useRef(false);

  const hrefOf = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params.toString());
      next.set(DISPATCH_DETAIL_PARAM, id);
      return `${pathname}?${next.toString()}`;
    },
    [params, pathname],
  );

  const markOpened = useCallback(() => {
    openedHere.current = true;
  }, []);

  const close = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      router.back();
      return;
    }
    const next = new URLSearchParams(params.toString());
    next.delete(DISPATCH_DETAIL_PARAM);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return { dispatchId, hrefOf, markOpened, close };
}
