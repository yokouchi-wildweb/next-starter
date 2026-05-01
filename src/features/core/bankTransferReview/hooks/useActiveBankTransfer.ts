// src/features/core/bankTransferReview/hooks/useActiveBankTransfer.ts
//
// 自分の進行中の自社銀行振込（active）を SWR で購読するフック。
// ウォレットトップに置く ActiveTransferBanner などで使用する。
//
// SWR デフォルトの focus revalidation が効くため、ユーザーが銀行アプリ等から
// 戻ってきた時点で自動的に最新化される。ポーリングは行わない（即時モード下では
// state は user-driven な遷移でしか変わらないため不要）。
//
// 認証ガード:
//   API エンドポイント側で session 必須なので、未ログイン時は 401 が返り
//   SWR の error として表面化する。呼び出し側はバナーを描画しない（サイレントフェイル）
//   形でハンドリングすることを想定。

"use client";

import useSWR from "swr";

import {
  getActiveBankTransfer,
  type ActiveBankTransferResponse,
} from "@/features/core/bankTransferReview";

/** SWR のキャッシュキー（API パスをそのまま採用して衝突を避ける） */
const SWR_KEY = "/api/wallet/purchase/bank-transfer/active";

export function useActiveBankTransfer() {
  return useSWR<ActiveBankTransferResponse>(SWR_KEY, () => getActiveBankTransfer());
}
