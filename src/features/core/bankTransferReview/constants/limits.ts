// src/features/core/bankTransferReview/constants/limits.ts
//
// 管理画面の入力の上限(文字数)。判定の hook(useAdminBankTransferReviewDecision)の検査と、
// 部品の「n / 上限」の表示が同じ値を読む。

/** 拒否理由の上限(必須) */
export const REJECT_REASON_MAX = 500;
/** 検証中に移すときのメモの上限(任意) */
export const INVESTIGATE_NOTE_MAX = 500;
/** 管理者メモの上限 */
export const ADMIN_MEMO_MAX = 2000;
